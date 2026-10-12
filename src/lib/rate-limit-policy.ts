/**
 * Pure, dependency-free sliding-window rate-limit decision — no Firestore,
 * no I/O, so it's trivially unit-testable (see rate-limit-policy.test.ts).
 * Callers (enforceOrderRateLimit in paymentIntents.ts, enforceLeadRateLimit
 * in leads.ts) wrap this in a Firestore transaction that reads/writes the
 * actual attempt history.
 *
 * Matches rakus-kitchen's src/lib/rate-limit-policy.ts signature exactly
 * (fixed constants, `decideRateLimit(priorAttempts, now)`) rather than an
 * earlier parameterized draft of this file — kept in sync so the pattern
 * stays identical across both projects.
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_ORDERS_PER_WINDOW = 5;

export type RateLimitDecision =
  | { allowed: true; attempts: number[] }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Given the prior attempt timestamps (epoch ms) and "now", prunes attempts
 * outside the rolling window and either returns the list to persist (with
 * `now` appended) or how many seconds to wait before the window frees up.
 */
export function decideRateLimit(priorAttempts: number[], now: number): RateLimitDecision {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = priorAttempts.filter((t) => t > windowStart);

  if (recent.length >= MAX_ORDERS_PER_WINDOW) {
    const oldest = Math.min(...recent);
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, attempts: [...recent, now] };
}
