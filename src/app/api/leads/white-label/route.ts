import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { sanitizeFirestoreData } from "@/lib/sanitize";
import { enforceLeadRateLimit, clientIp, LeadRateLimitError } from "@/lib/server/leadRateLimit";
import { recordServerAuditLog } from "@/lib/server/auditLogServer";
import type { WhiteLabelLead, LeadStatusEvent } from "@/types";

export const runtime = "nodejs";

interface WhiteLabelLeadBody {
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  productsInterested?: string[];
  estimatedQtyKgPerMonth?: number;
  deliveryLocation?: { city?: string; state?: string; pincode?: string };
  brandNameIdea?: string;
  targetMarket?: string;
  needsPackagingDesign?: boolean;
  notes?: string;
  internationalInquiry?: boolean;
}

/**
 * Public, unauthenticated lead-capture for the white-label program form.
 * Same shape as /api/leads/bulk — see that route's comment for the
 * server-only-write rationale (firestore.rules: whiteLabelLeads `create: false`).
 */
export async function POST(request: Request) {
  try {
    await enforceLeadRateLimit(`white-label:${clientIp(request)}`);

    const body = (await request.json()) as WhiteLabelLeadBody;

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
      brandNameIdea: body.brandNameIdea?.trim() || undefined,
      targetMarket: body.targetMarket?.trim() || undefined,
      needsPackagingDesign: Boolean(body.needsPackagingDesign),
      notes: body.notes?.trim() || undefined,
      status: "New" as const,
      internationalInquiry: Boolean(body.internationalInquiry),
      statusHistory,
      createdAt: now,
      updatedAt: now,
    });

    const ref = await adminDb().collection("whiteLabelLeads").add(leadPayload);

    const lead: WhiteLabelLead = { id: ref.id, ...leadPayload } as WhiteLabelLead;

    recordServerAuditLog({
      action: "lead.created",
      actor: { name: lead.contactName, type: "customer" },
      targetId: ref.id,
      summary: `New white-label enquiry from ${lead.businessName} (${lead.estimatedQtyKgPerMonth} kg/month)`,
      metadata: { leadType: "white-label", businessName: lead.businessName, international: lead.internationalInquiry },
    }).catch(() => {});

    return NextResponse.json({ lead });
  } catch (err) {
    if (err instanceof LeadRateLimitError) {
      return NextResponse.json(
        { error: err.message, code: "rate_limited", retryAfterSeconds: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
      );
    }
    console.error("white-label lead error:", err);
    return NextResponse.json(
      { error: "Could not submit your enquiry right now. Please try again or WhatsApp us directly." },
      { status: 500 },
    );
  }
}
