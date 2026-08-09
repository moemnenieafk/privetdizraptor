// Парсер ручной разметки маркеров (SVG V4DYA) → датасет {тип, x, y} по этажам.
// Тип берётся из цвета заливки (палитра сайта + жёлтый #ffcf00 = дверь-ключ),
// позиция — центр bbox фигуры (пиксели холста 16384², калибровка не нужна).
// Вход: public/maps/{map}/markers/{этаж}-markers.svg. Выход: тот же каталог, {map}-markers.json.
//
// Использование: node scripts/parse-map-markers.mjs factory

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SPECS = {
  factory: {
    dir: 'public/maps/factory/markers',
    floors: ['ground', 'basement', 'second', 'third'],
    out: 'public/maps/factory/markers/factory-markers.json',
  },
};

// Цвет заливки → тип (совпадает с таксономией сайта; #ffcf00 — дверь-ключ V4DYA).
const COLOR_TYPE = {
  '#5fb85b': 'extract',
  '#ff7724': 'transit',
  '#e6a23c': 'spawn',
  '#e68e25': 'loot',
  '#9a8866': 'container',
  '#bda550': 'lock',
  '#ffcf00': 'keydoor',
};

const die = (m) => { console.error(`\n❌ ${m}\n`); process.exit(1); };

// bbox-центр из атрибута d (числа как чередующиеся x,y — точно для симметричных фигур/кружков).
function pathCentroid(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  if (nums.length < 2) return null;
  const xs = [], ys = [];
  for (let i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

function parseSvg(svg) {
  const markers = [];
  // <path ... fill="#hex" ... d="..."/>  (порядок атрибутов любой)
  for (const m of svg.matchAll(/<path\b[^>]*\/?>/gi)) {
    const tag = m[0];
    const fill = (tag.match(/fill="(#[0-9a-fA-F]{6})"/) || [])[1]?.toLowerCase();
    const type = fill && COLOR_TYPE[fill];
    if (!type) continue;
    const d = (tag.match(/\bd="([^"]*)"/) || [])[1];
    const c = d && pathCentroid(d);
    if (c) markers.push({ type, x: +c.x.toFixed(1), y: +c.y.toFixed(1) });
  }
  // <rect ... fill="#hex" x= y= width= height= />
  for (const m of svg.matchAll(/<rect\b[^>]*\/?>/gi)) {
    const tag = m[0];
    const fill = (tag.match(/fill="(#[0-9a-fA-F]{6})"/) || [])[1]?.toLowerCase();
    const type = fill && COLOR_TYPE[fill];
    if (!type) continue;
    const g = (a) => Number((tag.match(new RegExp(`\\b${a}="([^"]*)"`)) || [])[1]);
    const x = g('x'), y = g('y'), w = g('width'), h = g('height');
    if ([x, y, w, h].every((n) => Number.isFinite(n))) markers.push({ type, x: +(x + w / 2).toFixed(1), y: +(y + h / 2).toFixed(1) });
  }
  return markers;
}

async function main() {
  const map = process.argv[2];
  if (!map) die(`укажи карту: node scripts/parse-map-markers.mjs <${Object.keys(SPECS).join('|')}>`);
  const spec = SPECS[map];
  if (!spec) die(`нет карты "${map}"`);

  console.log(`\n🔗 Парсинг разметки маркеров: ${map}\n`);
  const dataset = {};
  const totalsByType = {};
  let total = 0;
  for (const fl of spec.floors) {
    const p = `${spec.dir}/${fl}-markers.svg`;
    if (!existsSync(p)) { console.log(`  ${fl}: нет файла (${p})`); dataset[fl] = []; continue; }
    const markers = parseSvg(await readFile(p, 'utf8'));
    dataset[fl] = markers;
    total += markers.length;
    const byType = {};
    for (const m of markers) { byType[m.type] = (byType[m.type] || 0) + 1; totalsByType[m.type] = (totalsByType[m.type] || 0) + 1; }
    console.log(`  ${fl.padEnd(9)} ${markers.length}  (${Object.entries(byType).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  }

  await writeFile(spec.out, JSON.stringify(dataset), 'utf8');
  console.log(`\n  Итого: ${total} меток  ·  по типам: ${Object.entries(totalsByType).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  → ${spec.out}\n`);
}

main().catch((e) => die(e.message));
