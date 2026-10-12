import "server-only";
import { adminDb } from "./firebaseAdmin";
import { decideRateLimit } from "@/lib/rate-limit-policy";

/**
 * Per-IP rate limit for the public, unauthenticated bulk/white-label lead
 * forms (/api/leads/*). Unlike the Ola Maps proxy (mapsRateLimit.ts), these
 * are low-frequency, high-value writes — a Firestore-transaction-backed
 * limiter (same shape as enforceOrderRateLimit in paymentIntents.ts) is the
 * right tradeoff here: it holds across serverless instances, which matters
 * more for a form a scripted abuser could otherwise spam cheaply than the
 * extra read/write cost. Backed by one doc per IP at leadRateLimits/{key}
 * (keyed by `${formType}:${ip}` so bulk and white-label don't share a budget).
 */
export class LeadRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many enquiries submitted. Please wait a moment and try again.");
  }
}

export async function enforceLeadRateLimit(key: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("leadRateLimits").doc(key);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prior = (snap.data()?.attempts as number[] | undefined) ?? [];
    const decision = decideRateLimit(prior, now);
    if (!decision.allowed) throw new LeadRateLimitError(decision.retryAfterSeconds);
    tx.set(ref, { attempts: decision.attempts, updatedAt: now }, { merge: true });
  });
}

/** Best-effort client IP from the standard proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
