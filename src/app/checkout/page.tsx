"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { getIdToken } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { auth } from "@/lib/firebase";
import { formatINR } from "@/lib/format";
import { waLinkToKitchen } from "@/lib/whatsapp";
import { BUSINESS } from "@/lib/config";
import { toFriendlyErrorMessage } from "@/lib/friendlyErrors";
import { AddressPicker } from "@/components/AddressPicker";
import { OrderStatusSteps } from "@/components/OrderStatusSteps";
import { WhatsAppIcon } from "@/components/icons";
import type { AddressComponents, Order } from "@/types";

type Phase = "form" | "processing" | "verifying" | "done";

/* ── Razorpay Checkout.js types (the SDK ships no types of its own) ──────── */

interface RazorpayCheckoutSuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstanceOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayCheckoutSuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayInstanceOptions) => RazorpayInstance;
  }
}

interface CreateOrderResponse {
  razorpayOrderId: string;
  keyId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerPhone: string;
}

class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/**
 * Calls one of our /api/payments/* routes with a fresh Firebase ID token.
 * Always force-refreshes the token first — a stale token is the #1 cause of
 * a spurious 401 mid-checkout (see the same pattern in src/lib/db.ts).
 */
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  if (!auth?.currentUser) {
    throw new ApiError("Your session has expired. Please sign in again to continue.", 401);
  }
  let token: string;
  try {
    token = await getIdToken(auth.currentUser, /* forceRefresh */ true);
  } catch {
    throw new ApiError("Your session has expired. Please sign in again to continue.", 401);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data as { error?: string; code?: string };
    throw new ApiError(err?.error || `Request failed (${res.status})`, res.status, err?.code);
  }
  return data as T;
}

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { items, itemTotal, shippingFeeEstimate, grandTotalEstimate, clear, setCartOpen } = useCart();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("form");
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Held so the "Retry verification" button can replay the exact same
  // signed triple — verify is idempotent, so replaying it is always safe.
  const [pendingVerification, setPendingVerification] = useState<RazorpayCheckoutSuccessResponse | null>(null);

  // Guards against a double-click / rapid re-submit firing create-order twice.
  // The disabled button is only a visual guard; this ref makes submit itself a
  // no-op while one attempt is already in flight, so we never create two
  // Razorpay orders + payment intents for a single checkout.
  const submitting = useRef(false);

  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressComponents, setAddressComponents] = useState<AddressComponents | null>(null);
  const [gstin, setGstin] = useState("");
  const [notes, setNotes] = useState("");
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Restore the last saved structured address for returning customers.
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem(`rm-address-v1-${user.uid}`);
      if (raw) {
        const parsed: AddressComponents = JSON.parse(raw);
        setAddressComponents(parsed);
      }
    } catch { /* storage unavailable or malformed JSON */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Prefill from the verified login number — still editable, since the
  // delivery contact may differ from whoever is signed in.
  useEffect(() => {
    if (user?.phoneNumber) {
      setPhone(user.phoneNumber.replace(/^\+91/, ""));
    }
  }, [user?.phoneNumber]);

  // Not signed in → redirect to login, then back here. Cart + address stay
  // intact (both persisted to localStorage), so a re-login loses no work.
  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fcheckout");
  }, [loading, user, router]);

  // Stable callback so AddressPicker doesn't re-bind autocomplete on every render.
  const handleAddressChange = useCallback((addr: AddressComponents | null) => {
    setAddressComponents(addr);
  }, []);

  /**
   * Step 2 of payment: after Razorpay Checkout.js's `handler` fires with the
   * signed (order_id, payment_id, signature) triple, ask our own server to
   * verify that signature before trusting it (never trust the client-side
   * result alone — see /api/payments/verify's doc comment). Kept outside
   * `submit` so the "Retry verification" button can call it again with the
   * same triple — safe because finalizePayment is idempotent.
   */
  const verifyPayment = useCallback(async (result: RazorpayCheckoutSuccessResponse) => {
    setPendingVerification(result);
    setPhase("verifying");
    setError(null);
    setSessionExpired(false);
    try {
      const { order } = await postJSON<{ order: Order }>("/api/payments/verify", {
        razorpayOrderId: result.razorpay_order_id,
        razorpayPaymentId: result.razorpay_payment_id,
        razorpaySignature: result.razorpay_signature,
      });
      clear();
      setPendingVerification(null);
      setPlacedOrder(order);
      setPhase("done");
    } catch (err) {
      console.error("Payment verification failed:", err);
      if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
      setError(toFriendlyErrorMessage(err));
      // Stay on the "verifying" phase — the retry UI renders when error is set.
    }
  }, [clear]);

  const openRazorpayCheckout = useCallback(
    (order: CreateOrderResponse) => {
      if (typeof window.Razorpay !== "function") {
        setError("Could not load the payment window. Please check your connection and try again.");
        setPhase("form");
        return;
      }

      try {
        const razorpay = new window.Razorpay({
          key: order.keyId,
          order_id: order.razorpayOrderId,
          amount: order.amount,
          currency: order.currency,
          name: BUSINESS.name,
          prefill: { name: order.customerName, contact: order.customerPhone },
          theme: { color: "#C1502E" },
          handler: (result) => {
            void verifyPayment(result);
          },
          modal: {
            ondismiss: () => {
              // User closed the modal — no order was ever created, the
              // intent just sits inert.
              submitting.current = false;
              setPhase("form");
            },
          },
        });
        razorpay.on("payment.failed", (resp) => {
          submitting.current = false;
          setPhase("form");
          setError(
            resp.error?.description
              ? `Payment failed: ${resp.error.description}`
              : "Payment was not completed. You can try again when you're ready.",
          );
        });
        razorpay.open();
      } catch (err) {
        console.error("Razorpay checkout failed:", err);
        submitting.current = false;
        setPhase("form");
        setError("Could not open the payment window. Please check your connection and try again.");
      }
    },
    [verifyPayment],
  );

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-soft">Loading…</div>;
  }

  if (!user) return null;

  if (items.length === 0 && phase !== "done") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="text-5xl" aria-hidden>🛒</span>
        <h1 className="section-title">Your cart is empty</h1>
        <p className="text-sm text-soft">Add something from the shop first.</p>
        <Link href="/shop" className="btn btn-terracotta mt-2">Browse shop</Link>
      </div>
    );
  }

  /* ── "Confirming payment" screen (between Checkout and materialized order) ── */
  if (phase === "verifying") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        {error ? (
          <>
            <span className="text-5xl" aria-hidden>⏳</span>
            <h1 className="section-title mt-4">Confirming payment taking a moment</h1>
            <div className="mt-3 rounded-2xl border border-line bg-paper p-4 text-xs text-soft text-left leading-relaxed shadow-sm">
              <p className="font-bold text-cumin mb-1">Your payment is safe</p>
              <p>{error}</p>
            </div>
            <div className="mt-6 flex flex-col gap-2.5">
              {sessionExpired ? (
                <Link href="/login?next=%2Fcheckout" className="btn btn-terracotta py-3 text-sm font-bold">Sign in again</Link>
              ) : (
                <button
                  className="btn btn-terracotta py-3 text-sm font-bold shadow"
                  onClick={() => pendingVerification && void verifyPayment(pendingVerification)}
                >
                  🔄 Retry confirming payment
                </button>
              )}
              <Link href="/orders" className="btn btn-ghost py-2.5 text-xs">
                📋 Check My Orders
              </Link>
              <a
                href={`https://wa.me/${BUSINESS.phoneIntl}?text=${encodeURIComponent(
                  `Hi ${BUSINESS.name}, I need assistance verifying my order payment. Order ID: ${pendingVerification?.razorpay_order_id || "N/A"}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost py-2.5 text-xs border border-line text-paprika hover:bg-cardamom flex items-center justify-center gap-1.5"
              >
                💬 WhatsApp Support
              </a>
            </div>
          </>
        ) : (
          <>
            <span className="text-5xl" aria-hidden>⏳</span>
            <h1 className="section-title mt-4">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-soft">This only takes a moment. Please don&apos;t close this page.</p>
          </>
        )}
      </div>
    );
  }

  /* ── Confirmation screen (order placed) ─────────────────────────────── */
  if (phase === "done" && placedOrder) {
    const waHref = waLinkToKitchen(placedOrder);
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-turmericgold/20 text-4xl" aria-hidden>
            ✅
          </span>
          <h1 className="section-title mt-4">Payment successful!</h1>
          <p className="mt-1 text-sm text-soft">
            Your order <span className="font-bold text-cumin">{placedOrder.orderId}</span> is paid and in.
            Send it to {BUSINESS.name} on WhatsApp so they can confirm it.
          </p>
        </div>

        <div className="mt-8">
          <OrderStatusSteps status={placedOrder.status} />
        </div>

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-terracotta mt-8 w-full py-4 text-base"
        >
          <WhatsAppIcon className="h-5 w-5" />
          Send order on WhatsApp
        </a>
        <p className="mt-2 text-center text-xs text-soft">
          We&apos;ll see your order and call you to confirm delivery.
          You can also track it anytime from <strong>My Orders</strong>.
        </p>

        <div className="card mt-6 divide-y divide-line/60 text-sm">
          <div className="flex justify-between px-5 py-3">
            <span className="text-soft">Order ID</span>
            <span className="font-bold">{placedOrder.orderId}</span>
          </div>
          <div className="px-5 py-3 text-soft">
            <span className="block text-xs font-semibold text-soft">Delivery to</span>
            {placedOrder.addressComponents ? (
              <>
                <span className="block font-semibold text-cumin">
                  {placedOrder.addressComponents.doorAndBuilding}
                </span>
                <span className="block text-xs">{placedOrder.addressComponents.displayAddress}</span>
              </>
            ) : (
              <span className="block font-semibold text-cumin">{placedOrder.deliveryAddress}</span>
            )}
          </div>
          {placedOrder.items.map((it) => (
            <div key={`${it.productId}-${it.variantLabel}`} className="flex justify-between px-5 py-3">
              <span className="text-soft">
                {it.name} ({it.variantLabel}) ×{it.qty}
              </span>
              <span className="font-semibold">{formatINR(it.lineTotal)}</span>
            </div>
          ))}
          <div className="flex justify-between px-5 py-3 text-soft">
            <span>Items</span><span>{formatINR(placedOrder.itemTotal)}</span>
          </div>
          <div className="flex justify-between px-5 py-3 text-soft">
            <span>Shipping</span><span>{formatINR(placedOrder.shippingFee)}</span>
          </div>
          <div className="flex justify-between px-5 py-3 text-soft">
            <span>GST ({placedOrder.gstBreakdown.igst > 0 ? "IGST" : "CGST+SGST"})</span>
            <span>{formatINR(placedOrder.taxTotal)}</span>
          </div>
          <div className="flex justify-between px-5 py-3 text-base font-bold">
            <span>Total paid</span><span>{formatINR(placedOrder.grandTotal)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/orders" className="btn btn-ghost">Track order</Link>
          <Link href="/shop" className="btn btn-terracotta">Order something else</Link>
        </div>
      </div>
    );
  }

  /* ── Checkout form ───────────────────────────────────────────────────── */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // No-op if a submission is already in flight (double-click / rapid re-tap),
    // so we never fire create-order twice for one checkout.
    if (submitting.current) return;
    setError(null);
    setSessionExpired(false);

    if (!user) return;

    if (!addressComponents) {
      setError("Please search for your delivery address above.");
      return;
    }
    if (addressComponents.doorAndBuilding.trim().length < 3) {
      setError("Please enter your flat / floor / building details.");
      return;
    }

    if (scriptError) {
      setError("Could not load the payment window. Please check your connection and reload the page.");
      return;
    }
    if (!scriptReady) {
      setError("Payment is still loading — please wait a moment and try again.");
      return;
    }

    // Send only what the server needs to independently recompute prices —
    // pricePerUnit/lineTotal are display-only client state and are never sent.
    const lineInputs = items.map((it) => ({
      productId: it.productId,
      name: it.name,
      variantLabel: it.variantLabel,
      qty: it.quantity,
    }));

    const requestBody = {
      customerName: name.trim(),
      phone: `+91 ${phone}`,
      deliveryAddress: [
        addressComponents.doorAndBuilding,
        addressComponents.displayAddress,
        addressComponents.landmark,
      ].filter(Boolean).join(", "),
      addressComponents,
      gstin: gstin.trim() || undefined,
      items: lineInputs,
      notes: notes.trim() || undefined,
      // Advisory: the total we showed. The server recomputes prices from scratch
      // and charges its own total; this only lets it flag a mid-session change.
      clientGrandTotal: grandTotalEstimate,
    };

    submitting.current = true;
    setPhase("processing");
    try {
      // Persist structured address for the next visit.
      try {
        window.localStorage.setItem(
          `rm-address-v1-${user.uid}`,
          JSON.stringify(addressComponents),
        );
      } catch { /* ignore storage errors */ }

      const created = await postJSON<CreateOrderResponse>("/api/payments/create-order", requestBody);
      openRazorpayCheckout(created);
      // Phase stays "processing" while the Razorpay modal is open on top —
      // it moves to "verifying" from the handler, or back to "form" on dismiss/error.
    } catch (err) {
      console.error("Could not start payment:", err);
      if (err instanceof ApiError && err.status === 401) setSessionExpired(true);
      // A price changed mid-session: the shown Total already reflects the live
      // cart, so ask the customer to review it before charging the new amount.
      if (err instanceof ApiError && err.code === "price_changed") {
        setError("Some prices changed since you added items. Please review the updated total above, then pay again.");
      } else if (err instanceof ApiError && err.code === "stock_unavailable") {
        setError((err as Error).message || "One or more items in your cart are out of stock.");
      } else if (err instanceof ApiError && err.status === 429) {
        // Rate-limited: the server's message already says to wait a moment.
        setError((err as Error).message);
      } else {
        setError((err as Error).message || "We couldn't start payment. Please check your connection and try again.");
      }
      setPhase("form");
    } finally {
      // Release the guard once the attempt settles (create-order failed, or the
      // Razorpay modal has been handed control). The modal's own handlers move
      // the flow forward from here; a fresh submit is safe again.
      submitting.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setScriptError(true)}
      />

      <h1 className="section-title mb-2">Checkout</h1>
      <p className="mb-6 text-sm text-soft">
        Payment is collected upfront via Razorpay to confirm your order.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <form onSubmit={submit} className="space-y-6">
          {/* Contact details */}
          <fieldset className="card p-5">
            <legend className="mb-3 text-sm font-semibold text-cumin">Your details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">Full name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <label htmlFor="cphone" className="mb-1.5 block text-sm font-semibold">Mobile number</label>
                <input
                  id="cphone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                  className="field"
                  placeholder="10-digit mobile"
                  required
                />
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="gstin" className="mb-1.5 block text-sm font-semibold">
                GSTIN <span className="text-xs font-normal text-soft">(optional — for input tax credit)</span>
              </label>
              <input
                id="gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase().slice(0, 15))}
                className="field"
                placeholder="e.g. 29ABCDE1234F1Z5"
                maxLength={15}
              />
            </div>
          </fieldset>

          {/* Delivery address */}
          <fieldset className="card p-5">
            <legend className="mb-1 text-sm font-semibold text-cumin">Delivery address</legend>
            <p className="mb-3 text-xs text-soft">
              Pan-India delivery · Shipping charges may apply below a minimum order value.
            </p>
            <AddressPicker value={addressComponents} onChange={handleAddressChange} />
            {addressComponents && (
              <div className="mt-2.5 flex items-center justify-between text-xs text-soft">
                <span>📍 Coordinates saved locally for fast re-ordering</span>
                <button
                  type="button"
                  onClick={() => {
                    setAddressComponents(null);
                    if (user?.uid) {
                      try {
                        window.localStorage.removeItem(`rm-address-v1-${user.uid}`);
                      } catch { /* ignore */ }
                    }
                  }}
                  className="font-medium text-paprika underline hover:text-cumin"
                  title="Right to Erasure under DPDP Act: wipe saved address coordinates from this device"
                >
                  Clear saved address
                </button>
              </div>
            )}
          </fieldset>

          {/* Order note */}
          <fieldset className="card p-5">
            <legend className="mb-1.5 text-sm font-semibold text-cumin">Order note (optional)</legend>
            <input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field"
              placeholder="Any instructions for your order?"
            />
          </fieldset>

          {/* DPDP Act 2023 Statutory Affirmative Consent & Privacy Notice */}
          <div className="rounded-2xl border border-line bg-cardamom/50 p-4 text-xs text-soft space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-cumin">
              <span>🛡️</span>
              <span>DPDP Act, 2023 Statutory Consent</span>
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                id="dpdp-affirmative-consent"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line text-terracotta focus:ring-terracotta shrink-0"
                required
              />
              <span className="leading-relaxed text-cumin/90">
                I hereby grant affirmative consent to {BUSINESS.name} to process my name, mobile number, and address strictly for order fulfilment, courier dispatch, and status alerts as per the{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-paprika underline hover:text-cumin">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-paprika underline hover:text-cumin">
                  Terms of Service
                </Link>.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 text-sm font-medium text-terracotta" role="alert">
              <p>{error}</p>
              {sessionExpired && (
                <Link href="/login?next=%2Fcheckout" className="mt-2 inline-block font-bold underline">
                  Sign in again
                </Link>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={phase === "processing" || !consentAgreed}
            className="btn btn-terracotta w-full py-4 text-base disabled:opacity-50"
            title={!consentAgreed ? "Please check the consent box above to proceed" : ""}
          >
            {phase === "processing" ? "Starting payment…" : `Pay ${formatINR(grandTotalEstimate)}`}
          </button>
        </form>

        {/* Order summary */}
        <aside className="card h-fit p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Summary</h2>
            <button
              onClick={() => setCartOpen(true)}
              className="text-sm font-semibold text-paprika hover:underline"
            >
              Edit cart
            </button>
          </div>
          <ul className="divide-y divide-line/60 text-sm">
            {items.map((it) => (
              <li key={`${it.productId}-${it.variantLabel}`} className="flex justify-between gap-3 py-2.5">
                <span className="text-soft">
                  {it.name} ({it.variantLabel}) ×{it.quantity}
                </span>
                <span className="font-semibold">{formatINR(it.price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between text-soft"><span>Items</span><span>{formatINR(itemTotal)}</span></div>
            <div className="flex justify-between text-soft"><span>Shipping</span><span>{formatINR(shippingFeeEstimate)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total (incl. GST)</span><span>{formatINR(grandTotalEstimate)}</span></div>
          </div>
          <p className="mt-3 rounded-lg bg-cardamom px-3 py-2 text-xs text-soft">
            💡 Prices shown are GST-inclusive. The exact total (and the GST split) is confirmed by our server at payment time.
          </p>
        </aside>
      </div>
    </div>
  );
}
