import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { sanitizeFirestoreData } from "@/lib/sanitize";
import { enforceLeadRateLimit, clientIp, LeadRateLimitError } from "@/lib/server/leadRateLimit";
import { recordServerAuditLog } from "@/lib/server/auditLogServer";
import type { BulkLead, LeadStatusEvent } from "@/types";

export const runtime = "nodejs";

interface BulkLeadBody {
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  productsInterested?: string[];
  estimatedQtyKgPerMonth?: number;
  deliveryLocation?: { city?: string; state?: string; pincode?: string };
  notes?: string;
  internationalInquiry?: boolean;
}

/**
 * Public, unauthenticated lead-capture for the wholesale/bulk-order form.
 * No client write to Firestore is possible for this collection (see
 * firestore.rules: bulkLeads `create: false`) — this route, running with
 * the Admin SDK, is the only writer. Validates/sanitizes everything itself
 * since there's no Firebase Auth identity to lean on here.
 */
export async function POST(request: Request) {
  try {
    await enforceLeadRateLimit(`bulk:${clientIp(request)}`);

    const body = (await request.json()) as BulkLeadBody;

    if (
      !body.businessName?.trim() || !body.contactName?.trim() || !body.phone?.trim()
      || !Array.isArray(body.productsInterested) || body.productsInterested.length === 0
      || typeof body.estimatedQtyKgPerMonth !== "number" || body.estimatedQtyKgPerMonth <= 0
      || !body.deliveryLocation?.city?.trim() || !body.deliveryLocation?.state?.trim()
      || !body.deliveryLocation?.pincode?.trim()
    ) {
      return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
    }

    const now = Date.now();
    const statusHistory: LeadStatusEvent[] = [{ status: "New", at: now }];

    const leadPayload = sanitizeFirestoreData({
      businessName: body.businessName.trim(),
      contactName: body.contactName.trim(),
      phone: body.phone.trim(),
      email: body.email?.trim() || undefined,
      gstin: body.gstin?.trim().toUpperCase() || undefined,
      productsInterested: body.productsInterested.map((p) => String(p).trim()).filter(Boolean),
      estimatedQtyKgPerMonth: body.estimatedQtyKgPerMonth,
      deliveryLocation: {
        city: body.deliveryLocation.city.trim(),
        state: body.deliveryLocation.state.trim(),
        pincode: body.deliveryLocation.pincode.trim(),
      },
      notes: body.notes?.trim() || undefined,
      status: "New" as const,
      internationalInquiry: Boolean(body.internationalInquiry),
      statusHistory,
      createdAt: now,
      updatedAt: now,
    });

    const ref = await adminDb().collection("bulkLeads").add(leadPayload);

    const lead: BulkLead = { id: ref.id, ...leadPayload } as BulkLead;

    recordServerAuditLog({
      action: "lead.created",
      actor: { name: lead.contactName, type: "customer" },
      targetId: ref.id,
      summary: `New bulk-order enquiry from ${lead.businessName} (${lead.estimatedQtyKgPerMonth} kg/month)`,
      metadata: { leadType: "bulk", businessName: lead.businessName, international: lead.internationalInquiry },
    }).catch(() => {});

    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof LeadRateLimitError) {
      return NextResponse.json(
        { error: err.message, code: "rate_limited", retryAfterSeconds: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
      );
    }
    console.error("bulk lead error:", err);
    return NextResponse.json(
      { error: "Could not submit your enquiry right now. Please try again or WhatsApp us directly." },
      { status: 500 },
    );
  }
}
