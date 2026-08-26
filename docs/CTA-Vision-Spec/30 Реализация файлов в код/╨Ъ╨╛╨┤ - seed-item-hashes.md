---
title: Код - seed-item-hashes
tags: [cta, vision, code, typescript]
status: parsed-clean
repo_path: scripts/seed-item-hashes.ts
lines: 95
created: 2026-08-24
---

# `scripts/seed-item-hashes.ts`

Заполнение справочника из tarkov.dev GraphQL. Идемпотентен — гоняется по расписанию после патчей и вайпов.

- [[Схема данных]]

```typescript
import { db } from '@/db';
import { itemIconHashes } from '@/db/schema/vision';
import { dhash } from '@/lib/vision/phash';

const TARKOV_API = 'https://api.tarkov.dev/graphql';
const CONCURRENCY = 8;

const QUERY = `{
  items {
    id
    name
    normalizedName
    width
    height
    gridImageLink
  }
}`;

type TarkovItem = {
  id: string;
  name: string;
  normalizedName: string;
  width: number;
  height: number;
  gridImageLink: string | null;
};

async function fetchItems(): Promise<TarkovItem[]> {
  const response = await fetch(TARKOV_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });
  const payload = (await response.json()) as { data?: { items?: TarkovItem[] } };
  return payload.data?.items ?? [];
}

async function processItem(item: TarkovItem): Promise<void> {
  if (!item.gridImageLink) return;

  const image = await fetch(item.gridImageLink);
  if (!image.ok) {
    console.warn(`skip ${item.normalizedName}: ${image.status}`);
    return;
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const hash = await dhash(buffer);

  await db
    .insert(itemIconHashes)
    .values({
      itemId: item.id,
      name: item.name,
      normalizedName: item.normalizedName,
      gridW: item.width,
      gridH: item.height,
      dhash: hash,
      iconUrl: item.gridImageLink,
    })
    .onConflictDoUpdate({
      target: itemIconHashes.itemId,
      set: {
        name: item.name,
        normalizedName: item.normalizedName,
        gridW: item.width,
        gridH: item.height,
        dhash: hash,
        iconUrl: item.gridImageLink,
        updatedAt: new Date(),
      },
    });
}

async function main(): Promise<void> {
  const items = await fetchItems();
  console.log(`fetched ${items.length} items`);

  const queue = [...items];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const item = queue.pop();
      if (!item) return;
      await processItem(item);
    }
  });

  await Promise.all(workers);
  console.log('done');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
```

---

Сырой файл: `_src/scripts/seed-item-hashes.ts`. Копируется в репозиторий по пути `scripts/seed-item-hashes.ts`.
