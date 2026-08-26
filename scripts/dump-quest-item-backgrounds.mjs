/**
 * Слим-мапа фонов ячеек для предметов квест-целей: { itemId: backgroundColor }.
 * Источник — json.tarkov.dev/regular/items (канон, §4.12). Читается КЛИЕНТСКИ (QuestNode,
 * QuestItemTracker) → getTarkovBackgroundColor даёт тарковский цвет ячейки:
 *   • обычные предметы (найти в рейде и пр.) — свой backgroundColor из дампа;
 *   • квест-предметы (их нет в /regular/items — лежат в questItems) → 'yellow' (#686628).
 * Тащим ТОЛЬКО id, встречающиеся в целях EFT_QUESTS (мапа маленькая, не весь каталог).
 *
 * Run: node scripts/dump-quest-item-backgrounds.mjs
 */
import { readFileSync, writeFileSync } from 'fs';

const JSON_BASE = 'https://json.tarkov.dev';

async function getJson(path) {
  const res = await fetch(`${JSON_BASE}/${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} от json.tarkov.dev/${path}`);
  const json = await res.json();
  return json?.data ?? json;
}

async function main() {
  console.log('Fetching items from json.tarkov.dev/regular/items ...');
  const data = await getJson('regular/items');
  const itemsRaw = data.items ?? data;
  const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : Object.values(itemsRaw);
  const bgById = new Map(itemsArr.filter((i) => i?.id).map((i) => [i.id, i.backgroundColor ?? null]));

  const quests = JSON.parse(readFileSync('./src/data/quests/eft-quests.json', 'utf-8'));
  const ids = new Set();
  for (const t of quests) {
    for (const o of t.objectives ?? []) {
      // Только представительный item цели (его рисуют ячейки трекера/ноды) + маркер-предмет.
      // acceptedItems (any-of списки) в ячейках не рендерятся — в мапу не тащим.
      if (o.item?.id) ids.add(o.item.id);
      if (o.markerItem?.id) ids.add(o.markerItem.id);
    }
  }

  const out = {};
  let regular = 0;
  let quest = 0;
  for (const id of ids) {
    const bg = bgById.get(id);
    if (bg) { out[id] = bg; regular++; }        // обычный предмет — свой цвет из дампа
    else { out[id] = 'yellow'; quest++; }       // квест-предмет (нет в regular-items) → #686628
  }

  writeFileSync('./src/data/quests/item-backgrounds.json', JSON.stringify(out), 'utf-8');
  console.log(`Done: src/data/quests/item-backgrounds.json — ${ids.size} предметов (${regular} обычных, ${quest} квест→yellow)`);
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
