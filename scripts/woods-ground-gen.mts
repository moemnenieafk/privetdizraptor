// Слой материала поверхности («оттиск») Леса — Gemini image-to-image по 4 квадрантам.
// Канон: docs/decisions/map-asset-pipeline-canon.md §1.1 ранг 2. Запуск: npx tsx scripts/woods-ground-gen.mts [--layer material|elevation]
// Вход: 8192-webp → 4 квадранта → ≤1024 JPEG в запрос (лимит payload ProxyAPI) → выход 2K → сшивка 4K.
// Идемпотентно: готовый квадрант пропускается. Стоп на 429/402.

import fs from 'node:fs';
import sharp from 'sharp';
import { familyById } from '../src/lib/mapper/palette';

const ROOT = 'C:/cta-project';
const SRC = 'D:/Games/raster/woods/woods-main_0.16-8192.webp';
const OUT = `${ROOT}/map-exports/OBJECTS-MAPS/gen/woods/ground`;
const layer = process.argv.includes('--layer') ? process.argv[process.argv.indexOf('--layer') + 1] : 'material';

function env(name: string): string {
  const m = fs.readFileSync(`${ROOT}/.env.local`, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, 'm'));
  if (!m) throw new Error(`${name} не найден`);
  return m[1].trim().replace(/^["']|["']$/g, '');
}
const hex = (id: string) => familyById(id)!.default;

const PROMPTS: Record<string, string> = {
  material: [
    'This is one quadrant of a larger top-down game map of a forested wilderness (dense conifer taiga, a central rocky massif, marsh ponds, a big lake, a river, dirt roads, a sawmill). Produce a flat GROUND-MATERIAL MAP of exactly this quadrant, keeping the exact layout and scale: every road, track, clearing, shoreline and terrain boundary stays in the same place, shape and size.',
    '',
    'Repaint the ground as flat solid colour zones by material, using exactly these colours:',
    `- forest floor and grass under the trees = ${hex('soil')}`,
    `- dirt roads, tracks, trampled ground, camps = ${hex('dirt')}`,
    `- sand, gravel, scree, quarry floor, lake beach = ${hex('gravel-sand')}`,
    `- concrete, asphalt, building slabs, bunker tops = ${hex('concrete')}`,
    `- lake and river water = ${hex('water')}`,
    `- marsh and swamp = ${hex('swamp')}`,
    `- bare rock ground of the massif and outcrops = ${familyById('rock')!.default}`,
    '',
    'REMOVE everything that is not ground: buildings, sheds, vehicles, fences, log piles, pylons, trees, bushes and all props are deleted — continue the ground material underneath them as if they were never there. Trees are removed entirely: the whole forest becomes the forest-floor colour.',
    'Every zone is one uniform flat colour with a clean hard edge — no gradients, no texture, no shading, no outlines, no lettering, no photographic detail.',
    'This tile must line up with its neighbours: keep the surface flat and consistent right up to all four edges, no vignette, no border.',
    'Output a 1:1 image at 2K.',
  ].join('\n'),
  elevation: [
    'This is one quadrant of a larger top-down game map of a forested wilderness (hills, a central rocky massif with cliffs, ravines, marsh ponds, a big lake, a river). Produce a smooth GRAYSCALE ELEVATION MAP of exactly this quadrant, keeping the exact layout and scale.',
    'Read height from the terrain: hills, ridges, the rocky massif and cliff lines = light grey to white; the lake, marsh ponds and river = dark grey to black; forest floor, clearings and roads = mid grey; smooth gradients on every slope, sharper steps only at cliffs. Ignore buildings, vehicles, trees and props — they do not add height.',
    'Output smooth grayscale only — no colour, no trees, no outlines, no texture, no lettering. Consistent right up to all four edges so it lines up with neighbour tiles. 1:1 image at 2K.',
  ].join('\n'),
};

class BillingStop extends Error {}
async function generate(prompt: string, jpeg: Buffer): Promise<Buffer> {
  const res = await fetch(`${env('GEMINI_PROXY_BASE')}/v1beta/models/${env('GEMINI_IMAGE_MODEL')}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], maxOutputTokens: 4096, imageConfig: { aspectRatio: '1:1', imageSize: '2K' } },
    }),
  });
  if (res.status === 429 || res.status === 402) throw new BillingStop(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string }; inline_data?: { data?: string } }> } }> };
  const img = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.inlineData?.data ?? p.inline_data?.data).find(Boolean);
  if (!img) throw new Error('нет картинки в ответе');
  return Buffer.from(img, 'base64');
}

fs.mkdirSync(OUT, { recursive: true });
const meta = await sharp(SRC).metadata();
const W = meta.width!, H = meta.height!, side = Math.min(W, H); // 8192×8298 → берём квадрат 8192, низ 106 px = край карты
const q = side / 2;
const quads = [[0, 0], [q, 0], [0, q], [q, q]] as const;
const tiles: Buffer[] = [];
for (let i = 0; i < quads.length; i++) {
  const [left, top] = quads[i];
  const out = `${OUT}/${layer}-q${i}.png`;
  if (fs.existsSync(out)) { console.log(`q${i}: есть`); tiles.push(fs.readFileSync(out)); continue; }
  const input = await sharp(SRC).extract({ left, top, width: q, height: q }).resize(1024, 1024).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(`${OUT}/_input-q${i}.jpg`, input);
  console.log(`q${i}: POST ${layer} 2K …`);
  try {
    const png = await generate(PROMPTS[layer], input);
    fs.writeFileSync(out, png); tiles.push(png);
    console.log(`   ${(png.length / 1024).toFixed(0)} KB → ${out}`);
  } catch (e) {
    console.log('   ✖', (e as Error).message);
    if (e instanceof BillingStop) { fs.writeFileSync(`${OUT}/STOP_402.txt`, (e as Error).message); break; }
  }
}
if (tiles.length === 4) {
  const T = 2048;
  const norm = await Promise.all(tiles.map((t) => sharp(t).resize(T, T).png().toBuffer()));
  await sharp({ create: { width: T * 2, height: T * 2, channels: 3, background: '#000' } })
    .composite(norm.map((input, i) => ({ input, left: (i % 2) * T, top: Math.floor(i / 2) * T })))
    .png().toFile(`${OUT}/${layer}-4k.png`);
  console.log(`сшито → ${OUT}/${layer}-4k.png`);
}
