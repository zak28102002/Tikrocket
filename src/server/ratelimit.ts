/**
 * Small in-memory fixed-window limiter. Good enough for a single-instance
 * internal tool; swap for Redis/pg-backed when running multiple web instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }
    return { ok: true, retryAfterMs: 0 };
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfterMs: b.resetAt - now };
}
