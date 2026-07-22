/**
 * Дотягивает сетки контейнеров/рюкзаков (grids + filters) с tarkov.dev и вписывает
 * их в public/images/items/eft/items_database.json (поле properties.grids каждого
 * подходящего предмета). Нужно для блоков «Вместимость» и «Вмещает» на карточке.
 *
 * Правило §11: это разовый серверный сбор в наше зеркало (дамп-файл), НЕ рантайм-фетч.
 * После прогона — ETL: `tsx scripts/etl-items.ts` (перельёт properties_raw в БД).
 *
 * Запуск: node scripts/dump-container-grids.mjs   (нужен живой api.tarkov.dev)
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const GRID = `grids { width height filters { allowedCategories { id name } allowedItems { id name shortName } } }`;
const QUERY = `
  query ContainerGrids {
    items(lang: ru) {
      id
      properties {
        __typename
        ... on ItemPropertiesContainer { ${GRID} }
        ... on ItemPropertiesBackpack { ${GRID} }
      }
    }
  }
`;

async function main() {
  console.log('Fetching container/backpack grids from tarkov.dev...');
  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);

  // id → grids (только у кого сетки реально есть)
  const gridsById = new Map();
  for (const it of json.data.items) {
    const g = it.properties?.grids;
    if (Array.isArray(g) && g.length) gridsById.set(it.id, g);
  }
  console.log(`С сетками: ${gridsById.size} предметов.`);

  const file = path.join(process.cwd(), 'public/images/items/eft/items_database.json');
  const db = JSON.parse(readFileSync(file, 'utf8'));

  let patched = 0;
  for (const it of db) {
    const grids = gridsById.get(it.id);
    if (!grids) continue;
    it.properties = { ...(it.properties ?? {}), grids };
    patched++;
  }
  console.log(`Пропатчено в дампе: ${patched}.`);

  writeFileSync(file, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`Готово: ${path.basename(file)}. Дальше: tsx scripts/etl-items.ts`);
}

main().catch((err) => {
  console.error('Ошибка:', err.message);
  process.exit(1);
});
