---
title: Код - types
tags: [cta, vision, code, typescript]
status: parsed-clean
repo_path: src/lib/vision/types.ts
lines: 61
created: 2026-08-24
---

# `src/lib/vision/types.ts`

Единый контракт пайплайна. Дискриминированное объединение `RecognizedSlot` — центральный тип: по `kind` сразу видно, откуда взялось распознавание.

- [[Архитектура пайплайна]]

```typescript
export type GridRect = {
  /** координаты в ячейках сетки, не в пикселях */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GridGeometry = {
  originX: number;
  originY: number;
  /** шаг сетки в пикселях, включая разделитель */
  pitch: number;
  cols: number;
  rows: number;
};

export type ItemCandidate = {
  itemId: string;
  name: string;
  normalizedName: string;
  distance: number;
};

export type RecognizedSlot =
  | {
      kind: 'phash';
      rect: GridRect;
      itemId: string;
      name: string;
      normalizedName: string;
      distance: number;
    }
  | {
      kind: 'vision';
      rect: GridRect;
      itemId: string;
      name: string;
      normalizedName: string;
      confidence: number;
      candidates: ItemCandidate[];
    }
  | {
      kind: 'unknown';
      rect: GridRect;
      candidates: ItemCandidate[];
    };

export type ScanResponse = {
  geometry: GridGeometry;
  slots: RecognizedSlot[];
  visionCalls: number;
  cached: boolean;
};

export type ScanFailure =
  | { error: 'unsupported_media'; message: string }
  | { error: 'too_large'; message: string }
  | { error: 'grid_not_found'; message: string }
  | { error: 'rate_limited'; retryAfterMs: number }
  | { error: 'upstream'; message: string };
```

---

Сырой файл: `_src/src/lib/vision/types.ts`. Копируется в репозиторий по пути `src/lib/vision/types.ts`.
