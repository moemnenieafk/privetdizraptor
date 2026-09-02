// Лес — Фаза 2 эпика woods-asset-epic: Nano Banana flat-gen (2K) + vtracer palette-lock.
// Запуск: npx tsx scripts/woods-gen.mts [--only slug] [--retrace] [--force]
//   без флагов  — анкер (если ещё нет) → батч остальных с анкером вторым вложением
//   --only slug — только этот объект
//   --retrace   — не генерить, только перетрассировать существующие PNG против сабсета
// Стоп на 429/402 (биллинг). Идемпотентно: PNG есть → генерация пропускается.
// Промт — канон docs/img-promt-help/CTA-MAP-OBJECTS-vector-prompts.md (TYPE A), меняется только SUBJECT/PALETTE.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { FACTORY_PALETTE, MATTE_HEX, OUTLINE_HEX, tracePalette, collisionWarnings, familyById } from '../src/lib/mapper/palette';

const ROOT = 'C:/cta-project';
const CUT = `${ROOT}/map-exports/OBJECTS-MAPS/cut/woods`;
const GEN = `${ROOT}/map-exports/OBJECTS-MAPS/gen/woods`;
const SVG = `${GEN}/svg`;
const LOG = `${ROOT}/.tmp-woods/gen-log.json`;
const CAP = 12; // кап поднят V4DYA 2026-09-02: перегон 5 объектов на квадратных кропах 1:1

const require = createRequire(import.meta.url);
// vtracer 1.0.0-alpha.3 живёт в смоук-папке (см. docs/img-promt-help/vtracer-settings.md)
const vt = require(`${ROOT}/map-exports/_vtracer-smoke/node_modules/@visioncortex/vtracer`) as {
  convertBuffer: (buf: Uint8Array, opts: Record<string, unknown>) => string;
};

interface Job {
  slug: string;
  cut: string; // относительно CUT
  subject: string;
  materials: string[];
  mode: 'spline' | 'polygon';
  role?: 'anchor';
}

// Решения грилла 2026-09-02 (вопросы 3–6): анкер = малый валун; массив — уникальный ландмарк;
// тройка построек на трёх семействах.
const JOBS: Job[] = [
  {
    slug: 'boulder-sm', cut: 'landmarks/r2c0-solitary-boulder-east.png', role: 'anchor', mode: 'spline',
    materials: ['rock', 'soil'],
    subject: 'a single rounded granite boulder, roughly egg-shaped in plan, with a flat top facet in ONE uniform tone carrying at most two solid moss patches as simple flat shapes, two or three angular side facets, and a narrow rim of trampled soil at its base. No speckles, no mottling, no lichen texture — every facet is a single flat colour',
  },
  {
    slug: 'boulder-lg', cut: 'landmarks/r2c0-boulder-massif.png', mode: 'spline',
    materials: ['rock', 'soil'],
    subject: 'one huge fractured granite outcrop made of four or five large boulders pressed together, flat cracked tops, deep crevices between the blocks, a thin band of bare soil around the foot',
  },
  {
    slug: 'central-rock-massif', cut: 'landmarks/r1c1-central-rock-massif.png', mode: 'spline',
    materials: ['rock', 'soil', 'foliage', 'gravel-sand'],
    subject: 'a large mountain massif of massive weathered granite boulders densely packed into one rocky mass, tiered rounded stone tops stepping down to the edges, deep cracks between the blocks, scattered dark green shrub clumps in the gaps, and a rim of pale gravel scree and sandy clearings around the foot',
  },
  {
    slug: 'sawmill-main-building', cut: 'buildings/r2c1-sawmill-main-building.png', mode: 'polygon',
    materials: ['rust', 'concrete', 'wood'],
    subject: 'a large derelict single-storey industrial shed on a rectangular concrete footprint, flat corrugated rusted metal roof with one collapsed section exposing wooden roof beams, concrete apron along the long sides',
  },
  {
    slug: 'hilltop-settlement', cut: 'camps/r1c0-hilltop-settlement.png', mode: 'polygon',
    materials: ['cnt-green', 'wood', 'dirt'],
    subject: 'a compact encampment of six to eight small huts with painted green pitched metal roofs, seen from directly above so ONLY the roofs are visible — no walls, no doors, no facades — standing on a bare grey-brown dirt clearing, with a few wooden crates and a low timber fence between them',
  },
  // Вне игровой зоны (размытые на исходнике) исключены: large-brown-hall, blue-hangars — см. cut/woods/_out-of-bounds
  {
    slug: 'r2c2-plane-wreck', cut: 'vehicles/r2c2-plane-wreck.png', mode: 'spline',
    materials: ['plastic-white', 'concrete', 'dirt'],
    subject: 'a crashed twin-engine propeller aircraft wreck seen from directly above, fuselage broken in two, both wings still attached, bare aluminium skin, lying on a scar of churned dirt',
  },
];

// --- env -----------------------------------------------------------------------
function env(name: string): string {
  const m = fs.readFileSync(`${ROOT}/.env.local`, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, 'm'));
  if (!m) throw new Error(`${name} не найден в .env.local`);
  return m[1].trim().replace(/^["']|["']$/g, '');
}

// --- prompt (TYPE A, канон; только SUBJECT/PALETTE/REFERENCES меняются) ------------
function paletteText(materials: string[]): string {
  return materials
    .map((id) => {
      const f = familyById(id);
      if (!f) throw new Error(`нет семейства ${id}`);
      return `${f.shadow}, ${f.default}, ${f.highlight} for ${f.usage.toLowerCase()} as shadow / base / highlight`;
    })
    .concat([`${familyById('concrete')!.shadow}, ${familyById('concrete')!.default}, ${familyById('concrete')!.highlight} for grey concrete as shadow / base / highlight`, `${OUTLINE_HEX} for the outline`])
    .join('; ');
}

function buildPrompt(job: Job, hasAnchor: boolean): string {
  const refs = hasAnchor
    ? [
        'REFERENCES',
        'The first attached image is the GEOMETRY SOURCE. Reproduce its silhouette, proportions, internal part layout and rotation exactly, matching them precisely even where they differ from the real object. It is a low-resolution map crop — do NOT copy its colours, lighting or rendering; treat it purely as a shape guide.',
        'The second attached image is the STYLE ANCHOR for this entire set. Match its outline weight, fill flatness, number of shading steps, palette and contrast. Only the depicted object differs.',
      ]
    : [
        'REFERENCE: the attached image is the GEOMETRY SOURCE only. Reproduce its silhouette, proportions and rotation. It is a low-resolution map crop — do NOT copy its colours, its lighting or its rendering; treat it purely as a shape guide.',
      ];
  return [
    'Redraw the attached game-map object as a flat vector map asset. The output will be traced and assembled into a top-down game map, so it has to consist of solid flat colour areas with hard edges — that is the purpose of every rule below.',
    '',
    ...refs,
    '',
    `SUBJECT: ${job.subject}`,
    '',
    'CAMERA: orthographic, straight down, camera axis perpendicular to the ground plane. Only horizontal surfaces are visible. Edges that are parallel in the geometry source stay parallel here.',
    '',
    'STEP 1 — MASSES. Block the object out as flat solid shapes, one uniform colour per part, each bounded by a hard edge.',
    'STEP 2 — SHADING. Give each material at most three flat tones: base, one shadow, one highlight, exactly the three values named in PALETTE. Each tone is its own solid area with a hard boundary. Light comes from the upper left.',
    'STEP 3 — LINEWORK. Draw a dark outline of constant weight around the outer silhouette and around each major part. The weight is identical everywhere and does not taper.',
    'STEP 4 — REPEATED STRUCTURE. Draw corrugation, planking, roof ribs, rock facets and seams as clean repeated shapes at even spacing.',
    'STEP 5 — DETAIL BUDGET. Keep every part that is at least 1/40 of the image width. Anything smaller becomes part of the flat colour of the part containing it.',
    '',
    `PALETTE: ${paletteText(job.materials)}. Every area is one of these colours exactly, assigned by material.`,
    '',
    'FRAME: one object, centred, oriented exactly as in the geometry source, with an even margin of about 5 percent of the canvas on all four sides and empty corners.',
    '',
    `BACKGROUND: a single flat saturated magenta (${MATTE_HEX.magenta}) field, one uniform colour from edge to edge. The object keeps its own colours, meets the background only at its outline, and casts nothing onto it.`,
    '',
    'The image reads as a printed vector illustration: flat inks, hard edges, clean paper. Everything the SUBJECT does not name is absent from it — bare background around the object, no ground beyond what the SUBJECT names, no props, no second copy.',
    '',
    'No perspective, no isometric, no tilt. No gradient, no soft shadow, no gloss, no bloom, no noise, no photographic texture, no drop shadow, no border, no lettering.',
  ].join('\n');
}

// --- gemini via Cloudflare proxy (канон src/lib/ai/gemini-image.ts) -------------------
class BillingStop extends Error {}

async function generate(prompt: string, crop: Buffer, anchor: Buffer | null): Promise<Buffer> {
  // ProxyAPI отдаёт 402 «Insufficient balance» на тяжёлый payload (кроп 7 МБ / анкер 2 МБ) — это не баланс.
  // Кроп = гид по форме → ≤1024 px JPEG; анкер ≤1024 px PNG (ANCHOR_PX).
  const cropSmall = await sharp(crop).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  const parts: Array<Record<string, unknown>> = [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: cropSmall.toString('base64') } }];
  if (anchor) parts.push({ inline_data: { mime_type: 'image/png', data: anchor.toString('base64') } });
  const res = await fetch(`${env('GEMINI_PROXY_BASE')}/v1beta/models/${env('GEMINI_IMAGE_MODEL')}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '1:1', imageSize: '2K' } },
    }),
  });
  if (res.status === 429 || res.status === 402) throw new BillingStop(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { data?: string }; inline_data?: { data?: string } }> }; finishReason?: string }> };
  const cparts = json.candidates?.[0]?.content?.parts ?? [];
  const txt = cparts.find((p) => p.text)?.text;
  if (txt) console.log('   model:', txt.slice(0, 160).replace(/\n/g, ' '));
  const img = cparts.map((p) => p.inlineData?.data ?? p.inline_data?.data).find(Boolean);
  if (!img) throw new Error(`нет картинки, finishReason=${json.candidates?.[0]?.finishReason}`);
  return Buffer.from(img, 'base64');
}

// --- чистка: модель дорисовывает снизу полосу исходного кропа (земля/трава) — маскируем маджентой.
// Полоса = ряд, где >90% ширины не-маджента (объект по промпту всегда с полями ~5% и пустыми углами,
// поэтому >90% может дать только сплошная лента фона), в нижних 40% кадра; всё ниже неё — тоже.
async function cleanStrip(png: Buffer, rawBackup: string): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const isMag = (i: number) => Math.abs(data[i] - 0xc0) < 40 && data[i + 1] < 60 && Math.abs(data[i + 2] - 0xc0) < 40;
  let cut = H;
  for (let y = H - 1; y >= H * 0.6; y--) {
    let n = 0; for (let x = 0; x < W; x += 4) if (!isMag((y * W + x) * 4)) n++;
    if (n / (W / 4) > 0.9) cut = y; else if (cut < H) break;
  }
  if (cut === H) return png;
  if (!fs.existsSync(rawBackup)) fs.writeFileSync(rawBackup, png);
  for (let y = cut - 6; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; data[i] = 0xc0; data[i + 1] = 0; data[i + 2] = 0xc0; data[i + 3] = 255; }
  console.log(`   полоса снизу с y=${cut} → маджента (сырьё: ${path.basename(rawBackup)})`);
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

// --- trace ---------------------------------------------------------------------------
function trace(png: Buffer, job: Job): { svg: string; paths: number; colors: string[]; locked: boolean } {
  const palette = tracePalette(job.materials, 'magenta');
  const svg = vt.convertBuffer(new Uint8Array(png), {
    palette, colorMode: 'color', hierarchical: 'stacked', mode: job.mode,
    filterSpeckle: 24, colorPrecision: 8, layerDifference: 16, cornerThreshold: 70,
    lengthThreshold: 6, spliceThreshold: 45, pathPrecision: 2, maxIterations: 10,
  });
  const colors = [...new Set((svg.match(/#[0-9a-fA-F]{6}/g) ?? []).map((s) => s.toUpperCase()))];
  return { svg, paths: (svg.match(/<path/g) ?? []).length, colors, locked: colors.every((c) => palette.includes(c)) };
}

// --- main ----------------------------------------------------------------------------
type LogEntry = { slug: string; at: string; gen: boolean; paths?: number; colors?: number; locked?: boolean; error?: string };
const log: LogEntry[] = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
const save = () => fs.writeFileSync(LOG, JSON.stringify(log, null, 2));

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const retrace = args.includes('--retrace');
const force = args.includes('--force');

fs.mkdirSync(SVG, { recursive: true });
const anchorJob = JOBS.find((j) => j.role === 'anchor')!;
const anchorPng = `${GEN}/${anchorJob.slug}.png`;
let spent = log.filter((e) => e.gen).length;

for (const job of JOBS) {
  if (only && job.slug !== only) continue;
  const out = `${GEN}/${job.slug}.png`;
  console.log(`\n▶ ${job.slug} [${job.materials.join('+')}]`);
  for (const w of collisionWarnings(job.materials)) console.log('   ⚠', w);
  try {
    let png: Buffer;
    let generatedNow = false;
    if (fs.existsSync(out) && !force) {
      png = fs.readFileSync(out);
      console.log('   PNG есть — генерация пропущена');
    } else if (retrace) {
      console.log('   --retrace: PNG нет, пропуск'); continue;
    } else {
      if (spent >= CAP) { console.log(`   КАП ${CAP} исчерпан — стоп`); break; }
      const isAnchor = job.role === 'anchor';
      if (!isAnchor && !fs.existsSync(anchorPng)) { console.log('   анкера нет — сначала утверди boulder-sm'); break; }
      const anchor = isAnchor ? null : await sharp(anchorPng).resize(Number(process.env.ANCHOR_PX ?? 1024)).png().toBuffer();
      console.log(`   POST 2K ${isAnchor ? '(анкер, без style-ref)' : '(+анкер)'} …`);
      png = await generate(buildPrompt(job, !isAnchor), fs.readFileSync(`${CUT}/${job.cut}`), anchor);
      fs.writeFileSync(out, png);
      generatedNow = true;
      spent++;
      log.push({ slug: job.slug, at: new Date().toISOString(), gen: true }); save();
      console.log(`   PNG ${(png.length / 1024).toFixed(0)} KB → ${out}`);
    }
    const cleaned = await cleanStrip(png, `${GEN}/_${job.slug}-raw.png`);
    if (cleaned !== png) { fs.writeFileSync(out + '.tmp', cleaned); fs.renameSync(out + '.tmp', out); png = cleaned; }
    const t = trace(png, job);
    fs.writeFileSync(`${SVG}/${job.slug}.svg`, t.svg);
    const entry = log.find((e) => e.slug === job.slug && e.gen) ?? (log.push({ slug: job.slug, at: new Date().toISOString(), gen: false }), log[log.length - 1]);
    Object.assign(entry, { paths: t.paths, colors: t.colors.length, locked: t.locked }); save();
    console.log(`   SVG ${(t.svg.length / 1024).toFixed(0)} KB | ${t.paths} paths | ${t.colors.length} colors | palette-locked=${t.locked}`);
    if (job.role === 'anchor' && generatedNow && !only) { console.log('\n⏸ Анкер сгенерирован — утверди boulder-sm.png, затем запусти без --only для батча.'); break; }
  } catch (e) {
    const msg = (e as Error).message;
    log.push({ slug: job.slug, at: new Date().toISOString(), gen: false, error: msg }); save();
    if (e instanceof BillingStop) { console.log(`\n⛔ STOP биллинг: ${msg}`); fs.writeFileSync(`${GEN}/STOP_402.txt`, msg); break; }
    console.log('   ✖', msg);
  }
}
console.log(`\nпотрачено генераций в этом логе: ${spent}/${CAP}`);
