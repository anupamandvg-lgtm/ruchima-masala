"use client";

import {
  addDoc, collection, doc, getDoc, getDocs,
  onSnapshot, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { getIdToken, getIdTokenResult } from "firebase/auth";
import { auth, db } from "./firebase";
import { recordAuditLog } from "./auditLogger";
import type {
  AddressComponents, BulkLead, DeliveryMeta, LeadStatus, LeadStatusEvent, Order,
  OrderLineItem, OrderStatus, ProductInventoryDoc, ProductPricingDoc, StatusEvent,
  WhiteLabelLead,
} from "@/types";

/* ── Order creation ────────────────────────────────────────────────────── */
//
// Order documents are created SERVER-SIDE ONLY, after a verified Razorpay
// payment — see src/lib/server/paymentIntents.ts and the /api/payments/*
// routes. firestore.rules denies client `create` on /orders outright. The
// OrderDraft shape below is only used to build the payment request from the
// checkout form.

export interface OrderDraft {
  customerName: string;
  phone: string;
  deliveryAddress: string;
  addressComponents?: AddressComponents;
  gstin?: string;
  items: OrderLineItem[];
  itemTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
  notes?: string;
}

/* ── Reads (live) ──────────────────────────────────────────────────────── */

export function subscribeMyOrders(
  customerId: string,
  onOrders: (orders: Order[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, "orders"), where("customerId", "==", customerId));
  return retryingListener("subscribeMyOrders", (onSnapshotError) =>
    onSnapshot(
      q,
      (snap) => {
        const orders = snap.docs.map(mapOrder).sort((a, b) => b.createdAt - a.createdAt);
        onOrders(orders);
      },
      onSnapshotError,
    ),
    onError,
  );
}

export function subscribeAllOrders(
  onOrders: (orders: Order[]) => void,
  onError?: (message: string) => void,
  /** Fired with orders that arrived live AFTER the initial load — used to alert
   *  the admin. Never fired for the first snapshot (the existing backlog), so
   *  opening the dashboard doesn't blast an alert for every order already there. */
  onNewOrders?: (orders: Order[]) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  let seededFirstSnapshot = false;
  const knownOrderIds = new Set<string>();

  return retryingListener("subscribeAllOrders", (onSnapshotError) =>
    onSnapshot(
      collection(firestore, "orders"),
      (snap) => {
        const orders = snap.docs.map(mapOrder).sort((a, b) => b.createdAt - a.createdAt);
        onOrders(orders);

        if (!seededFirstSnapshot) {
          snap.docs.forEach((d) => knownOrderIds.add(d.id));
          seededFirstSnapshot = true;
          return;
        }
        if (!onNewOrders) return;

        const freshOrders: Order[] = [];
        for (const change of snap.docChanges()) {
          if (change.type === "added" && !change.doc.metadata.hasPendingWrites) {
            freshOrders.push(mapOrder(change.doc));
            knownOrderIds.add(change.doc.id);
          }
        }
        for (const d of snap.docs) {
          if (!knownOrderIds.has(d.id) && !d.metadata.hasPendingWrites) {
            freshOrders.push(mapOrder(d));
            knownOrderIds.add(d.id);
          }
        }

        if (freshOrders.length > 0) {
          const uniqueFresh = Array.from(new Map(freshOrders.map((o) => [o.id, o])).values());
          onNewOrders(uniqueFresh);
        }
      },
      onSnapshotError,
    ),
    onError,
  );
}

/**
 * A Firestore onSnapshot wrapper that survives transient failures. A denied listen does
 * not auto-retry in the SDK — the listener is dead the moment its error handler fires.
 * On error we tear it down and re-establish it after a short delay, so a cold page load
 * racing auth-token restore (or a rules-propagation window) recovers on its own instead
 * of leaving the UI stuck empty. Errors are swallowed (never re-thrown) to avoid the SDK
 * internal-state corruption unhandled rejections used to cause.
 */
export function retryingListener(
  label: string,
  open: (onSnapshotError: (err: { message: string }) => void) => Unsubscribe,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  let disposed = false;
  let unsubscribe: Unsubscribe | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const listen = () => {
    unsubscribe = open((err) => {
      if (disposed) return;
      console.warn(`${label}: snapshot error — retrying in 2s:`, err.message);
      onError?.(err.message);
      unsubscribe?.();
      retryTimer = setTimeout(listen, 2000);
    });
  };

  listen();
  return () => {
    disposed = true;
    if (retryTimer) clearTimeout(retryTimer);
    unsubscribe?.();
  };
}

/* ── Status updates (admin) ────────────────────────────────────────────── */

/**
 * Updates an order's status (admin only). Reads the current statusHistory first so it
 * can append rather than overwrite. Each operation is wrapped separately so a failure
 * is attributed to the exact step (read vs write) instead of a generic "update failed".
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  by?: string,
): Promise<void> {
  if (!db || !auth) return;
  const ref = doc(db, "orders", orderId);

  // Force-refresh the Firebase ID token before any Firestore write. Tokens
  // expire after 1 hour; a stale token causes permission-denied even when
  // the /admins doc exists and rules are correct.
  if (auth.currentUser) {
    try {
      await getIdToken(auth.currentUser, /* forceRefresh */ true);
    } catch (e) {
      console.warn("[updateOrderStatus] token refresh failed — proceeding with current token:", e);
    }
  }

  let history: StatusEvent[];
  try {
    const snap = await getDoc(ref);
    history = snap.data()?.statusHistory as StatusEvent[] ?? [];
  } catch (err) {
    const e = err as { code?: string; message?: string };
    throw new Error(
      `READ step failed (permission-denied here means the console READ rule is stale, ` +
      `not the update rule): ${e.code ?? ""} ${e.message ?? ""}`.trim(),
    );
  }

  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const adminSnap = await getDoc(doc(db, "admins", uid));
      if (!adminSnap.exists()) {
        throw new Error(
          `WRITE blocked: your account (${uid}) has no /admins/${uid} document in Firestore. ` +
          `Add it manually in the Firebase Console under Firestore → admins → ${uid} → { role: "admin" }.`,
        );
      }
    } catch (err) {
      if ((err as Error).message.startsWith("WRITE blocked:")) throw err;
      console.warn("[updateOrderStatus] couldn't pre-check /admins doc — proceeding:", err);
    }
  }

  const actorEmail = by || auth.currentUser?.email || auth.currentUser?.uid || "admin";
  const newEvent: StatusEvent = {
    status,
    at: Date.now(),
    ...(actorEmail ? { by: actorEmail } : {}),
  };

  try {
    await updateDoc(ref, {
      status,
      statusHistory: [...history, newEvent],
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    throw new Error(
      `Failed to update order status in Firestore: ${e.code ?? ""} ${e.message ?? ""}`.trim(),
    );
  }

  recordAuditLog({
    action: status === "Cancelled" ? "order.cancelled" : "order.status_changed",
    actor: {
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: orderId,
    summary: `Order status set to "${status}" by ${actorEmail}`,
    metadata: { status, orderId },
  }).catch(() => {});
}

/* ── Admin allowlist bootstrap ─────────────────────────────────────────── */

/** Add (or remove) a uid from the admins allowlist: setAdmin("<uid>", true). */
export async function setAdmin(uid: string, active: boolean): Promise<void> {
  if (!db) return;
  const ref = doc(db, "admins", uid);
  if (active) {
    await setDoc(ref, { role: "admin" });
  } else {
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { active: false });
  }
}

/* ── Mapper ────────────────────────────────────────────────────────────── */

function mapOrder(docSnap: { id: string; data: () => Record<string, unknown> }): Order {
  const d = docSnap.data();
  const createdAt = (d.createdAt as { seconds?: number } | number) ?? 0;
  const updatedAt = (d.updatedAt as { seconds?: number } | number) ?? 0;
  const toEpoch = (v: { seconds?: number } | number | undefined) =>
    typeof v === "number" ? v : (v?.seconds ?? 0) * 1000;

  return {
    id: docSnap.id,
    orderId: (d.orderId as string) ?? docSnap.id,
    customerId: (d.customerId as string) ?? "",
    customerName: (d.customerName as string) ?? "",
    phone: (d.phone as string) ?? "",
    gstin: (d.gstin as string) ?? undefined,
    deliveryAddress: (d.deliveryAddress as string) ?? "",
    addressComponents: d.addressComponents ? (d.addressComponents as AddressComponents) : undefined,
    deliveryMeta: d.deliveryMeta ? (d.deliveryMeta as DeliveryMeta) : undefined,
    items: (d.items as OrderLineItem[]) ?? [],
    itemTotal: (d.itemTotal as number) ?? 0,
    shippingFee: (d.shippingFee as number) ?? 0,
    taxTotal: (d.taxTotal as number) ?? 0,
    gstBreakdown: (d.gstBreakdown as Order["gstBreakdown"]) ?? { cgst: 0, sgst: 0, igst: 0 },
    grandTotal: (d.grandTotal as number) ?? 0,
    status: (d.status as OrderStatus) ?? "Placed",
    statusHistory: (d.statusHistory as StatusEvent[]) ?? [],
    notes: (d.notes as string) ?? undefined,
    payment: (d.payment as Order["payment"]) ?? undefined,
    invoiceUrl: (d.invoiceUrl as string) ?? undefined,
    createdAt: toEpoch(createdAt),
    updatedAt: toEpoch(updatedAt),
  };
}

/**
 * Writes carrier booking metadata (Porter / aggregator order id, fare estimate,
 * tracking URL) back onto the order document after the admin books a delivery.
 * Uses a partial update so no other order fields are touched.
 */
export async function updateDeliveryMeta(
  docId: string,
  meta: Partial<DeliveryMeta>,
): Promise<void> {
  if (!db) return;
  // Firestore rejects undefined values — strip them before writing.
  const clean = Object.fromEntries(
    Object.entries(meta).filter(([, v]) => v !== undefined),
  );
  await updateDoc(doc(db, "orders", docId), {
    deliveryMeta: clean,
    updatedAt: serverTimestamp(),
  });

  if (meta.carrierOrderId) {
    recordAuditLog({
      action: "courier.booked",
      actor: {
        uid: auth?.currentUser?.uid,
        email: auth?.currentUser?.email ?? undefined,
        type: "admin",
      },
      targetId: docId,
      summary: `Booked ${meta.carrierId || "courier"} delivery (Carrier Order #${meta.carrierOrderId})`,
      metadata: { docId, ...meta },
    }).catch(() => {});
  }
}

// Re-exported for the rare case admin tools want a one-off order fetch.
export async function getOrder(orderId: string): Promise<Order | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "orders", orderId));
  return snap.exists() ? mapOrder(snap) : null;
}

/* ── Product pricing & inventory (admin) ─────────────────────────────────── */
//
// One doc per product at productPricing/{productId} and productInventory/{productId}.
// Public read (storefront needs live price/stock), admin-only write. There is no
// code-constant price anywhere — see src/lib/products.ts's header comment.

export interface ProductPricingWithId extends ProductPricingDoc {
  productId: string;
}
export interface ProductInventoryWithId extends ProductInventoryDoc {
  productId: string;
}

export function subscribeProductPricing(
  onData: (pricing: ProductPricingWithId[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  return retryingListener("subscribeProductPricing", (onSnapshotError) =>
    onSnapshot(
      collection(firestore, "productPricing"),
      (snap) => {
        const pricing = snap.docs.map((d) => ({ productId: d.id, ...(d.data() as ProductPricingDoc) }));
        onData(pricing);
      },
      onSnapshotError,
    ),
    onError,
  );
}

export function subscribeProductInventory(
  onData: (inventory: ProductInventoryWithId[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  return retryingListener("subscribeProductInventory", (onSnapshotError) =>
    onSnapshot(
      collection(firestore, "productInventory"),
      (snap) => {
        const inventory = snap.docs.map((d) => ({ productId: d.id, ...(d.data() as ProductInventoryDoc) }));
        onData(inventory);
      },
      onSnapshotError,
    ),
    onError,
  );
}

/** Admin edit: set a variant's selling/original price. Merges — other variants untouched. */
export async function setVariantPricing(
  productId: string,
  variantLabel: string,
  pricing: { sellingPrice: number; originalPrice?: number },
): Promise<void> {
  if (!db) return;
  const clean = Object.fromEntries(
    Object.entries(pricing).filter(([, v]) => v !== undefined),
  );
  await setDoc(
    doc(db, "productPricing", productId),
    { variants: { [variantLabel]: clean }, updatedAt: Date.now() },
    { merge: true },
  );
  recordAuditLog({
    action: "inventory.price_changed",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: productId,
    summary: `Price for "${productId}" (${variantLabel}) set to ₹${pricing.sellingPrice}`,
    metadata: { productId, variantLabel, ...pricing },
  }).catch(() => {});
}

/** Admin edit: set a variant's stock quantity / low-stock threshold / availability. */
export async function setVariantInventory(
  productId: string,
  variantLabel: string,
  inventory: { stockQty: number; lowStockThreshold: number; available: boolean },
): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "productInventory", productId),
    { variants: { [variantLabel]: inventory }, updatedAt: Date.now() },
    { merge: true },
  );
  recordAuditLog({
    action: "inventory.stock_changed",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: productId,
    summary: `Stock for "${productId}" (${variantLabel}) set to ${inventory.stockQty}`,
    metadata: { productId, variantLabel, ...inventory },
  }).catch(() => {});
}

/** Zeroes/batch-sets stock for multiple variants at once after a production batch. */
export async function batchSetInventory(
  entries: { productId: string; variantLabel: string; stockQty: number; lowStockThreshold: number; available: boolean }[],
): Promise<void> {
  if (!db) return;
  const batch = writeBatch(db);
  for (const entry of entries) {
    batch.set(
      doc(db, "productInventory", entry.productId),
      {
        variants: {
          [entry.variantLabel]: {
            stockQty: entry.stockQty,
            lowStockThreshold: entry.lowStockThreshold,
            available: entry.available,
          },
        },
        updatedAt: Date.now(),
      },
      { merge: true },
    );
  }
  await batch.commit();
  recordAuditLog({
    action: "inventory.stock_changed",
    actor: {
      uid: auth?.currentUser?.uid,
      email: auth?.currentUser?.email ?? undefined,
      type: "admin",
    },
    targetId: "batch",
    summary: `Stock batch-updated for ${entries.length} product variants`,
    metadata: { count: entries.length },
  }).catch(() => {});
}

/* ── B2B leads (bulk wholesale & white-label) ─────────────────────────────── */
//
// Leads are created SERVER-SIDE ONLY by the public, unauthenticated
// /api/leads/* routes (see firestore.rules: create: false on both
// collections) — admins only read and update the pipeline from here.

export type LeadCollection = "bulkLeads" | "whiteLabelLeads";

function mapLead<T extends BulkLead | WhiteLabelLead>(
  docSnap: { id: string; data: () => Record<string, unknown> },
): T {
  const d = docSnap.data();
  return { id: docSnap.id, ...d } as T;
}

export function subscribeBulkLeads(
  onLeads: (leads: BulkLead[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  return retryingListener("subscribeBulkLeads", (onSnapshotError) =>
    onSnapshot(
      collection(firestore, "bulkLeads"),
      (snap) => {
        const leads = snap.docs.map((d) => mapLead<BulkLead>(d)).sort((a, b) => b.createdAt - a.createdAt);
        onLeads(leads);
      },
      onSnapshotError,
    ),
    onError,
  );
}

export function subscribeWhiteLabelLeads(
  onLeads: (leads: WhiteLabelLead[]) => void,
  onError?: (message: string) => void,
): Unsubscribe {
  if (!db) return () => {};
  const firestore = db;
  return retryingListener("subscribeWhiteLabelLeads", (onSnapshotError) =>
    onSnapshot(
      collection(firestore, "whiteLabelLeads"),
      (snap) => {
        const leads = snap.docs.map((d) => mapLead<WhiteLabelLead>(d)).sort((a, b) => b.createdAt - a.createdAt);
        onLeads(leads);
      },
      onSnapshotError,
    ),
    onError,
  );
}

/** Advances (or sets) a lead's pipeline status — New → Contacted → Quoted → Won/Lost. */
export async function updateLeadStatus(
  leadCollection: LeadCollection,
  leadId: string,
  status: LeadStatus,
  by?: string,
): Promise<void> {
  if (!db || !auth) return;
  const ref = doc(db, leadCollection, leadId);

  let history: LeadStatusEvent[];
  try {
    const snap = await getDoc(ref);
    history = snap.data()?.statusHistory as LeadStatusEvent[] ?? [];
  } catch (err) {
    const e = err as { code?: string; message?: string };
    throw new Error(`Failed to read lead before status update: ${e.code ?? ""} ${e.message ?? ""}`.trim());
  }

  const actorEmail = by || auth.currentUser?.email || auth.currentUser?.uid || "admin";
  const newEvent: LeadStatusEvent = { status, at: Date.now(), by: actorEmail };

  await updateDoc(ref, {
    status,
    statusHistory: [...history, newEvent],
    updatedAt: Date.now(),
  });

  recordAuditLog({
    action: "lead.status_changed",
    actor: { uid: auth.currentUser?.uid, email: auth.currentUser?.email ?? undefined, type: "admin" },
    targetId: leadId,
    summary: `${leadCollection === "bulkLeads" ? "Bulk" : "White-label"} lead status set to "${status}" by ${actorEmail}`,
    metadata: { leadCollection, leadId, status },
  }).catch(() => {});
}

/** Records (or clears) the quoted wholesale price for a lead. */
export async function setLeadQuotedPrice(
  leadCollection: LeadCollection,
  leadId: string,
  price: number | undefined,
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, leadCollection, leadId), {
    quotedPrice: price ?? null,
    updatedAt: Date.now(),
  });
  recordAuditLog({
    action: "lead.status_changed",
    actor: { uid: auth?.currentUser?.uid, email: auth?.currentUser?.email ?? undefined, type: "admin" },
    targetId: leadId,
    summary: price !== undefined
      ? `Quoted ₹${price} for ${leadCollection === "bulkLeads" ? "bulk" : "white-label"} lead`
      : `Cleared quoted price for ${leadCollection === "bulkLeads" ? "bulk" : "white-label"} lead`,
    metadata: { leadCollection, leadId, quotedPrice: price },
  }).catch(() => {});
}

/** Saves/updates admin notes on a lead. */
export async function setLeadNotes(
  leadCollection: LeadCollection,
  leadId: string,
  notes: string,
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, leadCollection, leadId), {
    notes,
    updatedAt: Date.now(),
  });
}

/* ── Admin access diagnostic ───────────────────────────────────────────── */

export interface AdminAccessReport {
  signInEmail: string | null;
  signInUid: string | null;
  tokenEmail: string | null;
  tokenEmailVerified: boolean | null;
  adminDocExists: boolean | null;
  tokenRefreshed: boolean;
  collectionReadWorks: boolean;
  ordersFound: number;
  ordersReadable: number;
  updateProbeWorks: "ok" | "denied" | "error" | null;
}

/**
 * One-click check that tells an admin *why* they can / can't see or update orders.
 * Mirrors rakus-kitchen's checkAdminAccess, minus the RK-sequential-id fallback
 * scan (Ruchima's order ids are random, not sequential, so there's no counter
 * to walk — a denied collection read here just surfaces as ordersFound: 0).
 */
export async function checkAdminAccess(email?: string | null): Promise<AdminAccessReport> {
  if (!db || !auth) throw new Error("Firebase not configured");

  const report: AdminAccessReport = {
    signInEmail: email ?? auth.currentUser?.email ?? null,
    signInUid: auth.currentUser?.uid ?? null,
    tokenEmail: null,
    tokenEmailVerified: null,
    adminDocExists: null,
    tokenRefreshed: false,
    collectionReadWorks: false,
    ordersFound: 0,
    ordersReadable: 0,
    updateProbeWorks: null,
  };

  const current = auth.currentUser;
  if (current) {
    try {
      await getIdToken(current, /* forceRefresh */ true);
      report.tokenRefreshed = true;
    } catch (e) {
      console.warn("[checkAdminAccess] token refresh failed:", e);
    }
    try {
      const t = await getIdTokenResult(current);
      report.tokenEmail = (t.claims.email as string | undefined) ?? null;
      report.tokenEmailVerified =
        typeof t.claims.email_verified === "boolean" ? t.claims.email_verified : null;
    } catch { /* token fetch failed — phone-only or transient */ }
  }

  if (report.signInUid) {
    try {
      report.adminDocExists = (await getDoc(doc(db, "admins", report.signInUid))).exists();
    } catch (e) {
      console.warn("[checkAdminAccess] admins doc read denied:", e);
    }
  }

  try {
    const qs = await getDocs(collection(db, "orders"));
    report.collectionReadWorks = true;
    report.ordersFound = qs.size;
    report.ordersReadable = qs.size;

    const mine = report.signInUid ?? "__none__";
    const probeDoc = qs.docs.find((d) => d.data().customerId !== mine) ?? null;
    if (probeDoc) {
      try {
        await updateDoc(doc(db, "orders", probeDoc.id), {
          status: probeDoc.data().status,
          statusHistory: probeDoc.data().statusHistory,
          updatedAt: serverTimestamp(),
        });
        report.updateProbeWorks = "ok";
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        report.updateProbeWorks = code === "permission-denied" ? "denied" : "error";
        if (code !== "permission-denied") console.error("[probe] non-permission update error:", err);
      }
    }
  } catch {
    // Collection read denied — report stays at ordersFound: 0.
  }

  return report;
}
