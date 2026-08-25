type Bucket = { tokens: number; updatedAt: number };

const BUCKETS = new Map<string, Bucket>();

export const RATE_TUNING = {
  capacity: 12,
  refillPerMs: 12 / (60 * 60 * 1000),
} as const;

export type RateVerdict =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number };

/** Один Node-процесс на VPS — in-memory достаточно. При масштабировании заменить на Redis. */
export function consume(key: string): RateVerdict {
  const now = Date.now();
  const bucket = BUCKETS.get(key) ?? { tokens: RATE_TUNING.capacity, updatedAt: now };

  const refilled = Math.min(
    RATE_TUNING.capacity,
    bucket.tokens + (now - bucket.updatedAt) * RATE_TUNING.refillPerMs,
  );

  if (refilled < 1) {
    BUCKETS.set(key, { tokens: refilled, updatedAt: now });
    return { allowed: false, retryAfterMs: Math.ceil((1 - refilled) / RATE_TUNING.refillPerMs) };
  }

  BUCKETS.set(key, { tokens: refilled - 1, updatedAt: now });
  return { allowed: true, remaining: Math.floor(refilled - 1) };
}
