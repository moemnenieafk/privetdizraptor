---
title: Код - rate-limit
tags: [cta, vision, code, typescript]
status: parsed-clean
repo_path: src/lib/vision/rate-limit.ts
lines: 31
created: 2026-08-24
---

# `src/lib/vision/rate-limit.ts`

Token bucket in-memory. Достаточно, пока Node-процесс один; при масштабировании заменяется на Redis.

- [[Риски и границы]]

```typescript
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
```

---

Сырой файл: `_src/src/lib/vision/rate-limit.ts`. Копируется в репозиторий по пути `src/lib/vision/rate-limit.ts`.
