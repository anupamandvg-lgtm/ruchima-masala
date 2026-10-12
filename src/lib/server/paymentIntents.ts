import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { sanitizeFirestoreData } from "@/lib/sanitize";
import { decideRateLimit } from "@/lib/rate-limit-policy";
import { prepareStockDecrements } from "./productInventory";
import { recordServerAuditLog } from "./auditLogServer";
import { generateUniqueOrderId } from "./orderIdGenerator";
import { generateInvoicePdf } from "./invoice";
import type { OrderDraft } from "@/lib/db";
import type {
  AddressComponents, DeliveryMeta, GstBreakdown, Order, OrderStatus, PaymentMeta, StatusEvent,
} from "@/types";

/**
 * A payment intent is created before the customer ever sees the Razorpay
 * checkout modal, and holds the SERVER-RECOMPUTED draft (never the client's
 * numbers — see recomputeCartTotals in productPricing.ts). It only ever
 * becomes a real `orders/{id}` document once payment is verified — see
 * finalizePayment() below. Until then it's inert: no cost, no
 * customer-visible effect, safe to leave abandoned.
 */
export interface PaymentIntentDoc {
  customerId: string;
  draft: OrderDraft;
  gstBreakdown: GstBreakdown;
  amount: number; // paise
  currency: string;
  status: "created" | "paid" | "failed";
  orderId?: string; // set once materialized
  createdAt: number;
}

export async function createIntent(params: {
  razorpayOrderId: string;
  customerId: string;
  draft: OrderDraft;
  gstBreakdown: GstBreakdown;
  amountPaise: number;
}): Promise<void> {
  const db = adminDb();
  await db.collection("paymentIntents").doc(params.razorpayOrderId).set(
    sanitizeFirestoreData({
      customerId: params.customerId,
      draft: params.draft,
      gstBreakdown: params.gstBreakdown,
      amount: params.amountPaise,
      currency: "INR",
      status: "created" as const,
      createdAt: Date.now(),
    }),
  );
}

export async function markIntentFailed(razorpayOrderId: string, reason: string): Promise<void> {
  const db = adminDb();
  await db.collection("paymentIntents").doc(razorpayOrderId).set(
    { status: "failed", failureReason: reason, failedAt: Date.now() },
    { merge: true },
  );
}

export class PaymentFinalizeError extends Error {
  constructor(message: string, public code: "not_found" | "customer_mismatch" | "amount_mismatch") {
    super(message);
  }
}

/**
 * Per-customer order-creation rate limit. A double-click is already caught on
 * the client, and duplicate orders are impossible (finalizePayment is
 * idempotent), but nothing stopped a scripted client from spraying
 * create-order calls — each one spawns a Razorpay order + an inert intent,
 * which is real API/log/storage cost at volume. This caps a single customer
 * to MAX_ORDERS_PER_WINDOW create-order calls per rolling window.
 *
 * Backed by one Firestore doc per customer (rateLimits/{uid}) holding the
 * epoch ms of recent attempts, pruned to the window on each check inside a
 * transaction so concurrent requests can't race past the cap. This is a
 * coarse abuse-throttle, not a fairness scheduler — deliberately simple and
 * shared, so it holds across serverless instances (an in-memory counter
 * would not). The pure window/cap decision lives in ../rate-limit-policy
 * (dependency-free, unit tested); this function only wraps it in the
 * Firestore transaction.
 */
export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many order attempts. Please wait a moment and try again.");
  }
}

export async function enforceOrderRateLimit(uid: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(uid);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prior = (snap.data()?.attempts as number[] | undefined) ?? [];
    const decision = decideRateLimit(prior, now);
    if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
    tx.set(ref, { attempts: decision.attempts, updatedAt: now }, { merge: true });
  });
}

/**
 * Materializes the real order from a paid intent. Idempotent: if the intent
 * is already "paid" it just re-fetches and returns the existing order rather
 * than writing a second time — this is what makes it safe to call from BOTH
 * the client-facing /verify route and the /webhook route without risking a
 * double-charge or double order for the same payment.
 *
 * `expectedAmountPaise` is Razorpay's own reported captured amount (from the
 * payments fetch or the webhook payload) — cross-checked against what the
 * intent was created for, so a payload that's authentic but paired with a
 * tampered amount (shouldn't be possible, but cheap to check) can't slip by.
 */
export async function finalizePayment(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  expectedAmountPaise: number;
  callerUid?: string; // present when called from /verify; absent from /webhook
}): Promise<Order> {
  const db = adminDb();
  const intentRef = db.collection("paymentIntents").doc(params.razorpayOrderId);

  const result = await db.runTransaction(async (tx) => {
    const intentSnap = await tx.get(intentRef);
    if (!intentSnap.exists) {
      throw new PaymentFinalizeError(
        `No payment intent for Razorpay order ${params.razorpayOrderId}`,
        "not_found",
      );
    }
    const intent = intentSnap.data() as PaymentIntentDoc;

    if (params.callerUid && intent.customerId !== params.callerUid) {
      throw new PaymentFinalizeError("Payment intent belongs to a different customer", "customer_mismatch");
    }
    if (intent.amount !== params.expectedAmountPaise) {
      throw new PaymentFinalizeError("Captured amount does not match the intent", "amount_mismatch");
    }

    // Already finalized (webhook won the race, or this is a retried call) —
    // return the existing order instead of writing again.
    if (intent.status === "paid" && intent.orderId) {
      const existing = await tx.get(db.collection("orders").doc(intent.orderId));
      if (existing.exists) return mapOrderDoc(existing.id, existing.data()!);
    }

    // --- PHASE 1: ALL READS FIRST (Firestore requirement) ---
    // Generate unique, collision-free, non-sequential order ID (RM-XXXXX).
    // Avoids German Tank Problem (business volume leakage) and eliminates
    // meta/counters write contention.
    const orderId = await generateUniqueOrderId(tx);

    // Read all touched productInventory docs before any writes.
    const applyStockDecrements = await prepareStockDecrements(tx, intent.draft.items);

    // --- PHASE 2: ALL WRITES AFTER ALL READS ARE COMPLETE ---

    const payment: PaymentMeta = {
      provider: "razorpay",
      razorpayOrderId: params.razorpayOrderId,
      razorpayPaymentId: params.razorpayPaymentId,
      amount: intent.amount,
      currency: intent.currency,
      status: "paid",
      createdAt: intent.createdAt,
      paidAt: Date.now(),
    };

    applyStockDecrements();

    const ordersRef = db.collection("orders").doc();
    const orderPayload = sanitizeFirestoreData({
      ...intent.draft,
      orderId,
      customerId: intent.customerId,
      gstBreakdown: intent.gstBreakdown,
      status: "Paid" as OrderStatus,
      statusHistory: [
        { status: "Placed" as OrderStatus, at: intent.createdAt, by: "customer" },
        { status: "Paid" as OrderStatus, at: Date.now(), by: "customer_payment" },
      ] as StatusEvent[],
      payment,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(ordersRef, orderPayload);
    tx.set(intentRef, { status: "paid", orderId: ordersRef.id }, { merge: true });

    return {
      id: ordersRef.id,
      ...intent.draft,
      orderId,
      customerId: intent.customerId,
      gstBreakdown: intent.gstBreakdown,
      status: "Paid" as OrderStatus,
      statusHistory: [
        { status: "Placed" as OrderStatus, at: intent.createdAt, by: "customer" },
        { status: "Paid" as OrderStatus, at: Date.now(), by: "customer_payment" },
      ] as StatusEvent[],
      payment,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } satisfies Order;
  });

  // Server audit log for newly created order
  recordServerAuditLog({
    action: "order.created",
    actor: {
      uid: result.customerId,
      name: result.customerName,
      type: "customer",
    },
    targetId: result.orderId,
    summary: `New order ${result.orderId} placed by ${result.customerName} (₹${result.grandTotal})`,
    metadata: {
      orderId: result.orderId,
      grandTotal: result.grandTotal,
      itemsCount: result.items.length,
    },
  }).catch(() => {});

  // Fire-and-forget: generate the GST invoice PDF and patch invoiceUrl onto
  // the order once ready. Deliberately outside the transaction above — PDF
  // render + Storage upload is slow and holding a Firestore transaction open
  // for it would risk a contention timeout. A failure here never blocks the
  // "payment successful" response; the customer can still see their order,
  // just without a download link until a retry (e.g. a resend from /admin).
  generateInvoicePdf(result)
    .then((invoiceUrl) =>
      db.collection("orders").doc(result.id).set({ invoiceUrl }, { merge: true }),
    )
    .catch((err) => console.error(`[paymentIntents] invoice generation failed for ${result.orderId}:`, err));

  return result;
}

function mapOrderDoc(id: string, d: Record<string, unknown>): Order {
  const toEpoch = (v: Timestamp | number | undefined) =>
    typeof v === "number" ? v : v instanceof Timestamp ? v.toMillis() : 0;
  return {
    id,
    orderId: (d.orderId as string) ?? id,
    customerId: (d.customerId as string) ?? "",
    customerName: (d.customerName as string) ?? "",
    phone: (d.phone as string) ?? "",
    gstin: d.gstin as string | undefined,
    deliveryAddress: (d.deliveryAddress as string) ?? "",
    addressComponents: d.addressComponents as AddressComponents | undefined,
    deliveryMeta: d.deliveryMeta as DeliveryMeta | undefined,
    items: (d.items as Order["items"]) ?? [],
    itemTotal: (d.itemTotal as number) ?? 0,
    shippingFee: (d.shippingFee as number) ?? 0,
    taxTotal: (d.taxTotal as number) ?? 0,
    gstBreakdown: (d.gstBreakdown as GstBreakdown) ?? { cgst: 0, sgst: 0, igst: 0 },
    grandTotal: (d.grandTotal as number) ?? 0,
    status: (d.status as OrderStatus) ?? "Paid",
    statusHistory: (d.statusHistory as StatusEvent[]) ?? [],
    notes: d.notes as string | undefined,
    payment: d.payment as PaymentMeta | undefined,
    invoiceUrl: d.invoiceUrl as string | undefined,
    createdAt: toEpoch(d.createdAt as Timestamp | number | undefined),
    updatedAt: toEpoch(d.updatedAt as Timestamp | number | undefined),
  };
}

/**
 * Webhook dedupe — Razorpay retries webhook deliveries and can send the same
 * event more than once. Each event has a unique `event_id`-ish identifier we
 * derive from (event type + payment id); recording it here before acting on
 * it makes a duplicate delivery a no-op instead of a repeated finalize call.
 * (finalizePayment is already idempotent on its own, so this is a second,
 * cheaper layer that also avoids extra Razorpay API/log noise.)
 */
export async function claimWebhookEvent(eventKey: string): Promise<boolean> {
  const db = adminDb();
  const ref = db.collection("webhookEvents").doc(eventKey);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) throw new Error("__duplicate__");
      tx.set(ref, { receivedAt: Date.now() });
    });
    return true; // first time seeing this event
  } catch (err) {
    if ((err as Error).message === "__duplicate__") return false;
    throw err;
  }
}
