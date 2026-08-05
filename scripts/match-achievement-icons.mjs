// scripts/match-achievement-icons.mjs
// Сматчить «искомые» иконки достижений (скриншот-кропы внутриигрового рендера:
// гексагон-рамка + голограмма + пиктограмма) с СЫРЫМИ CDN-иконками, которые
// live-клиент EFT кеширует на диск по ID:
//   %LOCALAPPDATA%\Temp\Battlestate Games\EscapeFromTarkov\files\achievement\<id>.png
//
// Матч по ФОРМЕ пиктограммы (не по цвету — голограмма≠белый силуэт):
//   1) из targ-иконки вырезаем ЦЕНТР (убираем рамку по краям + маркер «I» снизу);
//   2) ink-маска (яркие пиксели), обрезка по tight bounding-box → чистая форма;
//   3) CDN-иконка: ink = alpha (пиктограмма на прозрачном фоне) → bbox → форма;
//   4) обе формы → 64×64, сравнение по IoU с допуском на толщину (дилатация) и сдвиг.
// bbox-нормализация убирает разницу масштаба/позиции — сравниваются чистые силуэты.
//
// Запуск (после того как в игре открыл Достижения и клиент докачал иконки):
//   node scripts/match-achievement-icons.mjs
//   node scripts/match-achievement-icons.mjs --cache "D:/path/to/achievement"  --targets "docs/eft/codex/achievments/нужно найти"
//   node scripts/match-achievement-icons.mjs --top 6 --montage
//
// Выход: рейтинг кандидатов per-target + (--montage) картинка-сверка
//   docs/eft/codex/achievments/_match_result.png  (targ | top-N кандидатов)

import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); if (h) return h.slice(n.length + 3);
  const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };

const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const CACHE = val('cache', path.join(LOCALAPPDATA, 'Temp', 'Battlestate Games', 'EscapeFromTarkov', 'files', 'achievement'));
const TARGETS = val('targets', 'docs/eft/codex/achievments/нужно найти');
const TOP = Number(val('top', '5'));
const S = 48; // размер нормализованного дескриптора

// ── дескриптор формы: ink-маска → tight bbox → aspect-preserving вписывание в SxS
//    (интенсивность пиктограммы, mean-subtracted + L2-norm → вектор для NCC) ──
async function descriptor(buf, { useAlpha, crop }) {
  let img = sharp(buf).ensureAlpha();
  const meta = await img.metadata();
  if (crop) {
    const x = Math.round(meta.width * crop.x), y = Math.round(meta.height * crop.y);
    const w = Math.round(meta.width * crop.w), h = Math.round(meta.height * crop.h);
    img = sharp(buf).ensureAlpha().extract({ left: x, top: y, width: w, height: h });
  }
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const intens = new Float32Array(W * H); const ink = new Uint8Array(W * H);
  let minx = W, miny = H, maxx = -1, maxy = -1;
  for (let i = 0; i < W * H; i++) {
    const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2], a = data[i * C + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const v = useAlpha ? (a > 40 ? lum : 0) : lum;          // CDN: фон прозрачный→0; targ: яркость
    intens[i] = v;
    const on = useAlpha ? (a > 40 && lum > 25) : (lum > 115); // маска для bbox
    if (on) { ink[i] = 1; const xx = i % W, yy = (i / W) | 0;
      if (xx < minx) minx = xx; if (xx > maxx) maxx = xx; if (yy < miny) miny = yy; if (yy > maxy) maxy = yy; }
  }
  if (maxx < 0) return null;
  const bw = maxx - minx + 1, bh = maxy - miny + 1;
  const scale = (S - 4) / Math.max(bw, bh);                  // aspect-preserving, поля 2px
  const offx = Math.round((S - bw * scale) / 2), offy = Math.round((S - bh * scale) / 2);
  const grid = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const sx = minx + Math.floor((x - offx) / scale), sy = miny + Math.floor((y - offy) / scale);
    if (sx >= minx && sx <= maxx && sy >= miny && sy <= maxy) grid[y * S + x] = intens[sy * W + sx];
  }
  // zero-mean + L2-normalize → вектор (NCC = dot)
  let m = 0; for (const v of grid) m += v; m /= grid.length;
  let n = 0; for (let i = 0; i < grid.length; i++) { grid[i] -= m; n += grid[i] * grid[i]; }
  n = Math.sqrt(n) || 1; for (let i = 0; i < grid.length; i++) grid[i] /= n;
  return { vec: grid, bw, bh };
}
// NCC с малыми сдвигами (толерантность к неточному bbox)
function ncc(A, B, sh = 3) {
  let best = -1;
  for (let dy = -sh; dy <= sh; dy++) for (let dx = -sh; dx <= sh; dx++) {
    let s = 0;
    for (let y = 0; y < S; y++) { const by = y + dy; if (by < 0 || by >= S) continue;
      for (let x = 0; x < S; x++) { const bx = x + dx; if (bx < 0 || bx >= S) continue;
        s += A.vec[y * S + x] * B.vec[by * S + bx]; } }
    if (s > best) best = s;
  }
  return best; // диапазон ~[-1..1], выше = похожее
}

const MATCH = 0.68; // порог NCC: близнецы=0.9+, отсутствующая цель против чужих=~0.5-0.6 (замерено). Финал — глазами по монтажу.

async function main() {
  const { readFile } = await import('node:fs/promises');
  let cacheFiles;
  try { cacheFiles = (await readdir(CACHE)).filter((f) => f.endsWith('.png')); }
  catch { console.error(`\n❌ Кеш-папка не найдена: ${CACHE}\n   Запусти EFT → Персонаж → Достижения, дай клиенту докачать иконки, потом повтори.`); process.exit(1); }

  // дескрипторы кеша (CDN, alpha-фон)
  const cache = [];
  for (const f of cacheFiles) {
    const d = await descriptor(await readFile(path.join(CACHE, f)), { useAlpha: true });
    if (d) cache.push({ id: f.replace('.png', ''), ...d });
  }

  // --self-test: каждая кеш-иконка → ближайшая среди ОСТАЛЬНЫХ (проверка дискриминативности)
  if (flag('self-test')) {
    console.log(`\nSELF-TEST: ${cache.length} иконок, для каждой ближайший сосед по NCC\n${'─'.repeat(60)}`);
    for (const a of cache) {
      const ranked = cache.filter((b) => b.id !== a.id).map((b) => ({ id: b.id, s: ncc(a, b) })).sort((x, y) => y.s - x.s);
      console.log(`  ${a.id}  →  ${ranked[0].id}  NCC ${ranked[0].s.toFixed(3)}  (2nd ${ranked[1].s.toFixed(3)})`);
    }
    console.log('\nОжидание: пары-близнецы (2 противогаза, 2 черепа) должны стоять топ-1 друг у друга с высоким NCC.');
    return;
  }

  const targFiles = (await readdir(TARGETS)).filter((f) => f.endsWith('.png'));
  console.log(`\nКеш достижений: ${cache.length} иконок  |  искомых: ${targFiles.length}\n${'─'.repeat(60)}`);
  const CROP = { x: 0.15, y: 0.08, w: 0.70, h: 0.66 }; // центр из рамки (без краёв и маркера «I»)
  const results = [];
  for (const tf of targFiles) {
    const t = await descriptor(await readFile(path.join(TARGETS, tf)), { useAlpha: false, crop: CROP });
    if (!t) { console.log(`\n### ${tf}\n  ⚠️  пустой дескриптор (иконка не распозналась)`); continue; }
    const ranked = cache.map((c) => ({ id: c.id, s: ncc(t, c) })).sort((a, b) => b.s - a.s);
    results.push({ tf, ranked });
    console.log(`\n### ${tf}`);
    ranked.slice(0, TOP).forEach((r, i) => {
      const bar = '█'.repeat(Math.max(0, Math.round(r.s * 20))).padEnd(20, '·');
      console.log(`  ${i + 1}. ${r.id}  NCC ${r.s.toFixed(3)}  ${bar}${i === 0 && r.s >= MATCH ? '  ← вероятный матч' : ''}`);
    });
    if (ranked[0].s < MATCH) console.log(`  ⚠️  лучший NCC ${ranked[0].s.toFixed(3)} < ${MATCH} — этой иконки в кеше, похоже, НЕТ (не докачана).`);
  }

  if (flag('montage')) {
    const TW = 98, TH = 112, GAP = 8, PAD = 10, LBL = 22;
    const cols = 1 + TOP, rowH = TH + LBL + GAP, W = PAD * 2 + cols * TW + (cols - 1) * GAP, H = PAD * 2 + results.length * rowH;
    const comps = [];
    for (let ri = 0; ri < results.length; ri++) {
      const y = PAD + ri * rowH;
      const tbuf = await sharp(path.join(TARGETS, results[ri].tf)).resize(TW, TH, { fit: 'contain', background: { r: 30, g: 32, b: 34 } }).png().toBuffer();
      comps.push({ input: tbuf, left: PAD, top: y });
      for (let ci = 0; ci < TOP; ci++) {
        const r = results[ri].ranked[ci]; if (!r) continue;
        const cb = await sharp(path.join(CACHE, `${r.id}.png`)).resize(TW, TH, { fit: 'contain', background: { r: 30, g: 32, b: 34 } })
          .composite([{ input: Buffer.from(`<svg width="${TW}" height="16"><text x="2" y="12" fill="#0f0" font-size="11">${r.s.toFixed(2)}</text></svg>`), top: 0, left: 0 }]).png().toBuffer();
        comps.push({ input: cb, left: PAD + (ci + 1) * (TW + GAP), top: y });
      }
    }
    await mkdir(path.dirname('docs/eft/codex/achievments/_match_result.png'), { recursive: true });
    await sharp({ create: { width: W, height: H, channels: 3, background: { r: 18, g: 20, b: 22 } } }).composite(comps).png()
      .toFile('docs/eft/codex/achievments/_match_result.png');
    console.log(`\n🖼  Сверка: docs/eft/codex/achievments/_match_result.png (слева искомая, справа top-${TOP})`);
  }
  console.log('');
}
main().catch((e) => { console.error(e); process.exit(1); });
