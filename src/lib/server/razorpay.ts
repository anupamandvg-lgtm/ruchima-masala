import "server-only";
import crypto from "node:crypto";

/**
 * Razorpay Payment Gateway — server-only client.
 *
 * Talks to Razorpay's REST API directly (no SDK dependency — same choice as
 * src/lib/shiprocket.ts for the courier aggregator): a create-order call,
 * status/payments-fetch calls, and signature verification for both the
 * checkout callback and the webhook.
 *
 * RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET must never reach the
 * browser (no NEXT_PUBLIC_ prefix). RAZORPAY_KEY_ID IS needed client-side —
 * Razorpay's Checkout.js widget takes it directly as `key` — so it's handed
 * back in create-order's response instead of a NEXT_PUBLIC_ env var (it's
 * tied to a specific order at creation time, same role Cashfree's
 * payment_session_id used to play).
 *
 * Unlike Cashfree, Razorpay has no separate sandbox/production API host —
 * test vs. live mode is purely a property of which key you use (rzp_test_…
 * vs rzp_live_…), so there's no equivalent of CASHFREE_ENV here.
 */

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function isConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim());
}

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function requireConfigured(): void {
  if (!isConfigured()) {
    throw new Error("Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
}

/** Reads response JSON defensively — a non-JSON body becomes a readable error. */
async function readJson(response: Response, context: string): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Razorpay ${context} returned a non-JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  const err = data.error as Record<string, unknown> | undefined;
  return (err?.description as string) || fallback;
}

export interface RazorpayOrderResult {
  orderId: string; // Razorpay's own opaque "order_xxx" id
  amount: number; // paise
  currency: string;
  keyId: string; // public — handed to the client for Checkout.js
}

/**
 * Creates a Razorpay order for an amount already computed server-side
 * (paise — Razorpay's own `amount` field is paise too, unlike Cashfree's
 * rupee float, so no conversion is needed at this boundary).
 */
export async function createRazorpayOrder(params: {
  receipt: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResult> {
  requireConfigured();

  const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(params.amountPaise),
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  const data = await readJson(response, "create-order");
  if (!response.ok) {
    throw new Error(errorMessage(data, `Razorpay order creation failed (HTTP ${response.status})`));
  }

  const orderId = data.id as string | undefined;
  if (!orderId) {
    throw new Error("Razorpay order created but returned no id.");
  }

  return {
    orderId,
    amount: Number(data.amount ?? params.amountPaise),
    currency: (data.currency as string) || "INR",
    keyId: process.env.RAZORPAY_KEY_ID!,
  };
}

export interface RazorpayOrderStatus {
  orderId: string;
  status: string; // "created" | "attempted" | "paid"
  amountPaise: number;
  amountPaidPaise: number;
}

/**
 * Fetches the authoritative order status directly from Razorpay. The signed
 * checkout callback (see verifyPaymentSignature) is already strong proof on
 * its own, but this cross-check keeps the same "never trust the client
 * alone" posture the old Cashfree integration used.
 */
export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrderStatus> {
  requireConfigured();

  const response = await fetch(`${RAZORPAY_API_BASE}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  const data = await readJson(response, "fetch-order");
  if (!response.ok) {
    throw new Error(errorMessage(data, `Razorpay order fetch failed (HTTP ${response.status})`));
  }
  return {
    orderId,
    status: (data.status as string) || "created",
    amountPaise: Number(data.amount ?? 0),
    amountPaidPaise: Number(data.amount_paid ?? 0),
  };
}

export interface RazorpayPayment {
  paymentId: string;
  status: string; // "created" | "authorized" | "captured" | "refunded" | "failed"
  amountPaise: number;
}

/**
 * Fetches every payment attempt for an order — used to find the captured
 * attempt's payment id and cross-check the actually-captured amount,
 * mirroring the old fetchCashfreeOrderPayments() double-check.
 */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPayment[]> {
  requireConfigured();

  const response = await fetch(`${RAZORPAY_API_BASE}/orders/${encodeURIComponent(orderId)}/payments`, {
    method: "GET",
    headers: { Authorization: authHeader() },
  });
  const data = await readJson(response, "payments-fetch");
  if (!response.ok) {
    throw new Error(errorMessage(data, `Razorpay payments fetch failed (HTTP ${response.status})`));
  }
  const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
  return items.map((p) => ({
    paymentId: String(p.id ?? ""),
    status: String(p.status ?? ""),
    amountPaise: Number(p.amount ?? 0),
  }));
}

/**
 * Verifies the signed callback triple Razorpay Checkout.js hands the browser
 * on success: HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET),
 * hex-encoded, must equal razorpay_signature. This is what makes the
 * client-side result trustworthy without an extra round trip — unlike
 * Cashfree's payment_session_id, which proved nothing client-side on its own.
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET not configured");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  let signatureBuf: Buffer;
  try {
    signatureBuf = Buffer.from(params.signature, "hex");
  } catch {
    return false;
  }
  const expectedBuf = Buffer.from(expected, "hex");
  if (expectedBuf.length !== signatureBuf.length || expectedBuf.length === 0) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

/**
 * Verifies a Razorpay webhook's signature against the RAW request body:
 * HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET), hex-encoded, delivered in
 * the X-Razorpay-Signature header. Must be called with the body exactly as
 * received — re-serializing parsed JSON is not guaranteed to reproduce the
 * original bytes.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  let signatureBuf: Buffer;
  try {
    signatureBuf = Buffer.from(signatureHeader, "hex");
  } catch {
    return false;
  }
  const expectedBuf = Buffer.from(expected, "hex");
  if (expectedBuf.length !== signatureBuf.length || expectedBuf.length === 0) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
