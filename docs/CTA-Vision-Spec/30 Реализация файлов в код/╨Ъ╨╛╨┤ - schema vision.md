---
title: Код - schema vision
tags: [cta, vision, code, typescript]
status: parsed-clean
repo_path: src/db/schema/vision.ts
lines: 28
created: 2026-08-24
---

# `src/db/schema/vision.ts`

Две таблицы Drizzle: справочник эталонов и кэш сканов.

- [[Схема данных]]

```typescript
import { pgTable, text, smallint, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import type { ScanResponse } from '@/lib/vision/types';

export const itemIconHashes = pgTable(
  'item_icon_hashes',
  {
    itemId: text('item_id').primaryKey(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    gridW: smallint('grid_w').notNull(),
    gridH: smallint('grid_h').notNull(),
    /** dHash, 16 hex-символов */
    dhash: text('dhash').notNull(),
    iconUrl: text('icon_url').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('item_icon_hashes_dims_idx').on(t.gridW, t.gridH)],
);

export const inventoryScans = pgTable('inventory_scans', {
  /** sha256 изображения — один скриншот не биллится дважды */
  imageHash: text('image_hash').primaryKey(),
  userId: text('user_id'),
  result: jsonb('result').$type<ScanResponse>().notNull(),
  cellPitch: integer('cell_pitch').notNull(),
  visionCalls: smallint('vision_calls').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

Сырой файл: `_src/src/db/schema/vision.ts`. Копируется в репозиторий по пути `src/db/schema/vision.ts`.
