import "server-only";
import { NextResponse } from "next/server";
import { decideRateLimit as decide } from "@/lib/rate-limit-policy";

/**
 * Lightweight in-memory rate limit for the Ola Maps proxy routes.
 *
 * These routes fire many times per address (one per debounce tick) and each
 * proxies a billable Ola call, so they need a throttle — but a Firestore
 * transaction per keystroke would cost more than it saves. An in-memory sliding
 * window per serverless instance is the right tradeoff: it caps a single caller
 * (keyed by UID + client IP) hard enough to stop scripted quota-drain, while
 * costing nothing per request. It is best-effort across instances — combine
 * with the per-user auth gate (requireUser) which already stops anonymous abuse.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40; // generous for real typing; brutal for a scripted loop

// key -> recent request timestamps (epoch ms). Pruned lazily on each check.
const hits = new Map<string, number[]>();

/** Best-effort client IP from the standard proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 NextResponse if the key is over its window, else null.
 * Reuses the same pure sliding-window decision as the order rate limit.
 */
export function checkMapsRateLimit(key: string): NextResponse | null {
  const now = Date.now();
  const prior = hits.get(key) ?? [];
  // Reuse the pure policy with route-specific constants via a local window calc.
  const windowStart = now - WINDOW_MS;
  const recent = prior.filter((t) => t > windowStart);

  if (recent.length >= MAX_PER_WINDOW) {
    const oldest = Math.min(...recent);
    const retryAfter = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    return NextResponse.json(
      { error: "Too many address lookups. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  recent.push(now);
  hits.set(key, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded under many keys.
  if (hits.size > 5000) {
    hits.forEach((v: number[], k: string) => {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    });
  }
  return null;
}

// Re-export the shared policy so callers that want the {allowed,...} shape can
// use it too; keeps the single source of truth for the sliding-window rule.
export { decide as decideRateLimit };
