import { NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/server/firebaseAdmin";
import { fetchRazorpayOrderPayments, verifyPaymentSignature } from "@/lib/server/razorpay";
import { finalizePayment, markIntentFailed, PaymentFinalizeError } from "@/lib/server/paymentIntents";

export const runtime = "nodejs";

interface VerifyBody {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

/**
 * Step 2 of checkout: the browser calls this right after Razorpay
 * Checkout.js's `handler` callback fires with the signed (order_id,
 * payment_id, signature) triple. The signature is verified here against
 * RAZORPAY_KEY_SECRET before anything is trusted — a client that fabricates
 * the triple without knowing the secret can't produce a valid signature.
 *
 * This is a convenience path for a fast "done" screen — it is NOT the only
 * way an order gets created. If the browser is killed before this call lands
 * (common on UPI app-switch), /api/payments/webhook performs the identical
 * finalizePayment() independently.
 */
export async function POST(request: Request) {
  try {
    const { uid } = await verifyIdToken(request.headers.get("authorization"));
    const body = (await request.json()) as VerifyBody;

    if (!body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }

    const signatureValid = verifyPaymentSignature({
      orderId: body.razorpayOrderId,
      paymentId: body.razorpayPaymentId,
      signature: body.razorpaySignature,
    });
    if (!signatureValid) {
      await markIntentFailed(body.razorpayOrderId, "Signature verification failed");
      return NextResponse.json({ error: "Payment signature verification failed" }, { status: 400 });
    }

    // Cross-check the captured amount directly from Razorpay's own payments
    // list — the signed triple proves the callback is genuine, not that the
    // amount captured matches what the intent was created for.
    const payments = await fetchRazorpayOrderPayments(body.razorpayOrderId);
    const captured = payments.find((p) => p.paymentId === body.razorpayPaymentId && p.status === "captured");
    if (!captured) {
      return NextResponse.json({ error: "No captured payment found for this order" }, { status: 400 });
    }

    const placedOrder = await finalizePayment({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      expectedAmountPaise: captured.amountPaise,
      callerUid: uid,
    });

    return NextResponse.json({ order: placedOrder });
  } catch (err) {
    console.error("verify error:", err);
    if (err instanceof PaymentFinalizeError) {
      const status = err.code === "customer_mismatch" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    const rawMsg = (err as Error).message || "";
    if (rawMsg.startsWith("Missing Authorization")) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again to confirm your order." },
        { status: 401 }
      );
    }
    // Never expose raw database or internal exception text to the client
    return NextResponse.json(
      {
        error:
          "We're taking a moment to finalize your order. If your money was deducted, your payment is safe and will be confirmed shortly. Please tap 'Retry confirming payment' below.",
      },
      { status: 500 }
    );
  }
}
