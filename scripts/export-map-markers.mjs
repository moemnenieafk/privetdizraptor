// Экспорт текущих маркеров карты (как на сайте) в SVG для правки в Figma.
// Тянет маркеры из json.tarkov.dev (канон, тот же источник, что кормит наше зеркало),
// проецирует world→пиксели НАШЕЙ формулой (makeCRS: transform + поворот + bounds),
// пишет SVG шириной 4096: один корневой слой, группа <g id="RU-тип"> на каждый тип,
// мелкие цветные кружки, у каждого data-name. Цвета/имена — таксономия с сайта.
//
// Использование: node scripts/export-map-markers.mjs factory
//
// ⚠️ Позиции — по калибровке СТАРОГО Shebuka-арта (другая проекция, чем новый art V4DYA).
// Значит метки лягут близко, но не пиксель-в-пиксель → V4DYA правит расположение в Figma.

import { writeFile } from 'node:fs/promises';

const SPECS = {
  factory: {
    tarkovName: 'factory',
    transform: [1.629, 119.9, 1.629, 139.3], // [scaleX, offsetX, scaleZ, offsetZ] из eft-map-config
    rotation: 90,
    bounds: [[77, -64.5], [-65.5, 67.4]],     // [[y1,x1],[y2,x2]] CRS.Simple
    width: 4096,
    out: 'public/maps/factory/markers-factory.svg',
  },
};

// Таксономия с сайта: ключ в maps-json → { RU-имя, цвет, извлекатель подписи }
const TYPES = [
  { key: 'extracts',         ru: 'Выход',        color: '#5FB85B', label: (e) => e.name || 'выход' },
  { key: 'transits',         ru: 'Переход',      color: '#FF7724', label: (e) => e.description || e.conditions || 'переход' },
  { key: 'spawns',           ru: 'Спавн',        color: '#E6A23C', label: (e) => ((e.categories || []).concat(e.sides || []).join('/')) || 'спавн' },
  { key: 'hazards',          ru: 'Опасность',    color: '#E5484D', label: (e) => e.name || e.hazardType || 'опасность' },
  { key: 'locks',            ru: 'Замок',        color: '#BDA550', label: (e) => e.lockType || 'замок' },
  { key: 'switches',         ru: 'Рычаг',        color: '#C26BE0', label: (e) => e.name || e.id || 'рычаг' },
  { key: 'stationaryWeapons',ru: 'Стационарка',  color: '#8FA3B0', label: (e) => e.name || 'стационарка' },
  { key: 'lootLoose',        ru: 'Лут',          color: '#E68E25', label: () => 'лут' },
  { key: 'lootContainers',   ru: 'Контейнер',    color: '#9A8866', label: (e) => e.name || 'контейнер' },
];

const die = (m) => { console.error(`\n❌ ${m}\n`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Проекция world→CRS-пиксель, порт makeCRS/applyRotation из MapViewerClient.
function makeProject({ transform, rotation }) {
  const [sx, mx, sz, mz] = transform;
  const scaleX = sx, scaleY = -sz, marginX = mx, marginY = mz;
  const a = (rotation || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  // вход latLng: lat, lng. applyRotation → LonLat.project → transformation
  return (lat, lng) => {
    const px = lng * cos - lat * sin;   // projected point .x
    const py = lng * sin + lat * cos;   // projected point .y
    return { x: scaleX * px + marginX, y: scaleY * py + marginY };
  };
}

async function main() {
  const map = process.argv[2];
  if (!map) die(`укажи карту: node scripts/export-map-markers.mjs <${Object.keys(SPECS).join('|')}>`);
  const spec = SPECS[map];
  if (!spec) die(`нет карты "${map}". Известные: ${Object.keys(SPECS).join(', ')}`);

  console.log(`\n🧭 Экспорт маркеров: ${map}\n`);
  const r = await fetch('https://json.tarkov.dev/regular/maps');
  if (!r.ok) die(`json.tarkov.dev/maps → HTTP ${r.status}`);
  const j = await r.json();
  const fact = Object.values(j.data.maps).find((m) => m.normalizedName === spec.tarkovName);
  if (!fact) die(`карта ${spec.tarkovName} не найдена в дампе`);

  const project = makeProject(spec);

  // Габариты холста из спроецированных углов bounds → сохраняем аспект старого арта.
  const cA = project(spec.bounds[0][1], spec.bounds[0][0]); // latLng(y1... ) = (lat=b[0][1], lng=b[0][0])
  const cB = project(spec.bounds[1][1], spec.bounds[1][0]);
  const minX = Math.min(cA.x, cB.x), maxX = Math.max(cA.x, cB.x);
  const minY = Math.min(cA.y, cB.y), maxY = Math.max(cA.y, cB.y);
  const W = spec.width;
  const H = Math.round(W * (maxY - minY) / (maxX - minX));
  const toSvg = (p) => ({
    x: +(( (p.x - minX) / (maxX - minX)) * W).toFixed(1),
    y: +(( (p.y - minY) / (maxY - minY)) * H).toFixed(1),
  });

  const R = 18; // радиус метки (мелкая на 4096)
  const groups = [];
  let total = 0;
  console.log('  тип'.padEnd(20) + 'кол-во');
  for (const t of TYPES) {
    const arr = Array.isArray(fact[t.key]) ? fact[t.key] : [];
    if (!arr.length) { console.log(`  ${t.ru.padEnd(18)}0`); continue; }
    const dots = [];
    for (const e of arr) {
      const pos = e.position;
      if (!pos || typeof pos.x !== 'number') continue;
      const s = toSvg(project(pos.z, pos.x)); // marker latLng = [z, x]
      const y = typeof pos.y === 'number' ? ` y=${pos.y.toFixed(1)}` : '';
      dots.push(`    <circle cx="${s.x}" cy="${s.y}" r="${R}" fill="${t.color}" stroke="#0D0D0F" stroke-width="3" data-name="${esc(t.label(e) + y)}"/>`);
    }
    total += dots.length;
    console.log(`  ${t.ru.padEnd(18)}${dots.length}`);
    groups.push(`  <g id="${esc(t.ru)}" data-name="${esc(t.ru)}" fill="${t.color}">\n${dots.join('\n')}\n  </g>`);
  }

  const svg =
`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect id="Рамка" width="${W}" height="${H}" fill="none" stroke="#333333" stroke-width="2"/>
${groups.join('\n')}
</svg>\n`;

  await writeFile(spec.out, svg, 'utf8');
  console.log(`\n  Итого меток: ${total}  ·  холст ${W}×${H}`);
  console.log(`  → ${spec.out}\n`);
}

main().catch((e) => die(e.message));
