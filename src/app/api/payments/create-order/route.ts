import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/firebaseAdmin";
import { createRazorpayOrder } from "@/lib/server/razorpay";
import { createIntent, enforceOrderRateLimit, RateLimitError } from "@/lib/server/paymentIntents";
import { checkStockAvailability } from "@/lib/server/productInventory";
import { recomputeCartTotals } from "@/lib/server/productPricing";
import type { OrderDraft } from "@/lib/db";
import type { AddressComponents } from "@/types";

export const runtime = "nodejs";

interface CartLineInput {
  productId?: string;
  variantLabel?: string;
  qty?: number;
  name?: string;
}

interface CreateOrderBody {
  customerName?: string;
  phone?: string;
  deliveryAddress?: string;
  addressComponents?: AddressComponents;
  gstin?: string;
  items?: CartLineInput[];
  notes?: string;
  /** The grand total the client displayed at confirm time. ADVISORY ONLY —
   *  never used to charge; only compared against the server's recomputed total
   *  to catch a price that changed mid-session (see the price_changed guard). */
  clientGrandTotal?: number;
}

/**
 * Step 1 of checkout: recompute the real price from productPricing (never
 * trust the client's numbers), check stock, then create a Razorpay order
 * for that amount and stash a paymentIntent holding the verified draft.
 * Nothing is written to /orders yet — see finalizePayment().
 */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));

    // Throttle a single customer's create-order calls before doing any work,
    // so a scripted client can't spray Razorpay orders + inert intents.
    await enforceOrderRateLimit(uid);

    const body = (await request.json()) as CreateOrderBody;

    if (
      !body.customerName?.trim() || !body.phone?.trim() || !body.deliveryAddress?.trim()
      || !Array.isArray(body.items) || body.items.length === 0
    ) {
      return NextResponse.json({ error: "Missing required order fields" }, { status: 400 });
    }

    for (const it of body.items) {
      if (!it.productId || !it.variantLabel || typeof it.qty !== "number") {
        return NextResponse.json({ error: "Invalid item in cart" }, { status: 400 });
      }
    }

    const buyerStateCode = body.addressComponents?.state
      ? stateNameToCode(body.addressComponents.state)
      : undefined;

    // The only source of truth for prices — client-submitted pricePerUnit/lineTotal
    // are ignored entirely.
    const recomputed = await recomputeCartTotals(
      body.items.map((it) => ({ productId: it.productId!, variantLabel: it.variantLabel!, qty: it.qty!, name: it.name })),
      buyerStateCode,
    );
    if ("error" in recomputed) {
      return NextResponse.json({ error: recomputed.error }, { status: 400 });
    }

    // Block order if any requested quantity would exceed available stock.
    // This is the authoritative gate — finalizePayment also decrements
    // stock, but can't reject (payment already captured, no refund path).
    const stockCheck = await checkStockAvailability(recomputed.items);
    if (!stockCheck.ok) {
      return NextResponse.json(
        { error: stockCheck.error, code: "stock_unavailable" },
        { status: 409 },
      );
    }

    // Catch a price that changed while the customer was browsing: if the total
    // they confirmed differs from the freshly-recomputed one, don't silently
    // charge the new amount — surface it so they re-review first. The server
    // total is always authoritative for the actual charge; clientGrandTotal is
    // advisory only. A missing clientGrandTotal (older client) skips the check.
    if (
      typeof body.clientGrandTotal === "number"
      && Math.round(body.clientGrandTotal) !== Math.round(recomputed.grandTotal)
    ) {
      return NextResponse.json(
        {
          error: "Some prices changed since you added items. Please review the updated total.",
          code: "price_changed",
          newTotal: recomputed.grandTotal,
        },
        { status: 409 },
      );
    }

    const draft: OrderDraft = {
      customerName: body.customerName.trim(),
      phone: body.phone.trim(),
      deliveryAddress: body.deliveryAddress.trim(),
      addressComponents: body.addressComponents,
      gstin: body.gstin?.trim() || undefined,
      items: recomputed.items,
      itemTotal: recomputed.itemTotal,
      shippingFee: recomputed.shippingFee,
      taxTotal: recomputed.taxTotal,
      grandTotal: recomputed.grandTotal,
      notes: body.notes?.trim() || undefined,
    };

    const amountPaise = Math.round(draft.grandTotal * 100);
    if (amountPaise <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero" }, { status: 400 });
    }

    // Razorpay's own "receipt" is just a label we choose — Razorpay issues
    // its own opaque order_id, so this doesn't need to double as the lookup
    // key, just something recognizable in the dashboard.
    const receipt = `rm-${uid.slice(0, 8)}-${Date.now()}`;

    const rzpOrder = await createRazorpayOrder({
      receipt,
      amountPaise,
      notes: { customerId: uid, customerPhone: body.phone.trim() },
    });

    await createIntent({
      razorpayOrderId: rzpOrder.orderId,
      customerId: uid,
      draft,
      gstBreakdown: recomputed.gstBreakdown,
      amountPaise,
    });

    return NextResponse.json({
      razorpayOrderId: rzpOrder.orderId,
      keyId: rzpOrder.keyId,
      amount: amountPaise,
      currency: "INR",
      customerName: draft.customerName,
      customerPhone: draft.phone,
    });
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message, code: "rate_limited", retryAfterSeconds: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
      );
    }
    console.error("create-order error:", err);
    const rawMsg = (err as Error).message || "";
    if (rawMsg.startsWith("Missing Authorization")) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again to place your order." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Unable to start checkout right now. Please refresh and try again in a moment." },
      { status: 500 }
    );
  }
}

/** Maps a free-text state name (from Ola Maps reverse geocoding) to its GST
 *  state code. Only Karnataka needs to be distinguished accurately (it's the
 *  only state that flips CGST+SGST vs IGST for this business); anything else
 *  returns undefined and recomputeCartTotals's safe default (IGST) applies. */
function stateNameToCode(stateName: string): string | undefined {
  return /karnataka/i.test(stateName) ? "29" : undefined;
}
