/**
 * Minimal fixed-window rate limiter.
 *
 * Security role: throttles abuse of state-changing endpoints (booking, future
 * auth) to blunt brute-force, scraping and spam. It is the first line; combine
 * with validation ([[validation.ts]]) and the honeypot.
 *
 * ⚠️ Scope: this implementation is **in-memory and per-instance**. It is correct
 * for a single Node process (and great as a local/dev safeguard) but does NOT
 * coordinate across serverless instances or a multi-node deploy. For production
 * at scale, back it with a shared store (Upstash Redis / Vercel KV) — the call
 * sites don't change, only this file. See `SECURITY.md`.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

// Opportunistic cleanup so the map can't grow unbounded.
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  /** seconds until the window resets */
  retryAfter: number;
}

/**
 * @param key     stable identifier for the caller + action, e.g. `book:1.2.3.4`
 * @param limit   max requests allowed within the window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now();
  let entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    if (buckets.size > MAX_KEYS) buckets.clear();
    buckets.set(key, entry);
  }

  entry.count += 1;
  const success = entry.count <= limit;

  return {
    success,
    remaining: Math.max(0, limit - entry.count),
    limit,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client IP from standard proxy headers. Behind Vercel/np proxies
 * `x-forwarded-for` is trustworthy; never derive identity/authz from it.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
