// Нарезка объектов карты квадратом 1:1 с воздухом (канон docs/decisions/map-asset-pipeline-canon.md §2).
// Запуск: npx tsx scripts/map-cut-square.mts [--only slug,slug] [--map woods]
// Читает .tmp-<map>/objects/r*.json (поле z6 = [x, y, w, h] в пикселях исходника), пропускает outOfBounds,
// режет квадрат стороной max(w,h)×1.5 вокруг центра bbox из z6-растра → cut/<map>/<category>/<slug>.png.
// Старый кроп (впритык) сохраняется как <slug>.tight.png при первом прогоне.

import fs from 'node:fs';
import sharp from 'sharp';

const args = process.argv.slice(2);
const MAP = args.includes('--map') ? args[args.indexOf('--map') + 1] : 'woods';
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const PAD = 1.5;

const ROOT = 'C:/cta-project';
const OBJ = `${ROOT}/.tmp-${MAP}/objects`;
const CUT = `${ROOT}/map-exports/OBJECTS-MAPS/cut/${MAP}`;
const offsets = JSON.parse(fs.readFileSync(`${ROOT}/.tmp-${MAP}/offsets.json`, 'utf8')) as { src: string; W: number; H: number };

interface Obj { slug: string; category: string; z6: [number, number, number, number]; outOfBounds?: boolean; path?: string; square?: [number, number, number] }

const files = fs.readdirSync(OBJ).filter((f) => /^r\dc\d\.json$/.test(f));
let done = 0, skipped = 0;
for (const f of files) {
  const p = `${OBJ}/${f}`;
  const arr = JSON.parse(fs.readFileSync(p, 'utf8')) as Obj[];
  let touched = false;
  for (const o of arr) {
    if (o.outOfBounds) { skipped++; continue; }
    if (only && !only.has(o.slug)) continue;
    const [x, y, w, h] = o.z6;
    const side = Math.round(Math.max(w, h) * PAD);
    let left = Math.round(x + w / 2 - side / 2), top = Math.round(y + h / 2 - side / 2);
    left = Math.max(0, Math.min(left, offsets.W - side)); top = Math.max(0, Math.min(top, offsets.H - side));
    const s = Math.min(side, offsets.W - left, offsets.H - top);
    const out = `${CUT}/${o.category}/${o.slug}.png`;
    if (fs.existsSync(out) && !fs.existsSync(out.replace(/\.png$/, '.tight.png'))) fs.renameSync(out, out.replace(/\.png$/, '.tight.png'));
    await sharp(offsets.src, { limitInputPixels: false }).extract({ left, top, width: s, height: s }).png().toFile(out);
    o.square = [left, top, s]; o.path = out; touched = true; done++;
    console.log(`${o.slug.padEnd(36)} ${w}x${h} → ${s}² @ ${left},${top}`);
  }
  if (touched) fs.writeFileSync(p, JSON.stringify(arr, null, 2));
}
console.log(`нарезано ${done}, пропущено вне зоны ${skipped}`);
