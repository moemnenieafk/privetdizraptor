// Процедурный генератор флэт-вектор растительности (топ-даун) для карт CTA.
// Без AI/биллинга: органические кроны из сглаженных блобов, 3 тона + тёмная обводка,
// свет сверху-слева (хайлайт вверх-влево, тень вниз-вправо). Выход — SVG в gen/vegetation/.
// Запуск: node scripts/map-veg-gen.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'map-exports/OBJECTS-MAPS/gen/vegetation';
fs.mkdirSync(OUT, { recursive: true });

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Замкнутый органический блоб (Catmull-Rom → cubic bezier)
function blob(cx, cy, r, n, jitter, rng, spiky = false) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let rr = r * (1 - jitter + rng() * jitter * 2);
    if (spiky && i % 2) rr *= 0.68;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const p = (i) => pts[((i % n) + n) % n];
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function lobes(cx, cy, r, count, spread, dir, tone, seed, small) {
  const rng = mulberry32(seed);
  let s = '';
  for (let i = 0; i < count; i++) {
    const ox = cx + dir[0] * r * spread + (rng() - 0.5) * r * 0.5;
    const oy = cy + dir[1] * r * spread + (rng() - 0.5) * r * 0.5;
    s += `<path d="${blob(ox, oy, r * small, 8, 0.35, rng)}" fill="${tone}"/>`;
  }
  return s;
}

// palette: [outline, base, shadow, highlight]
const PAL = {
  green:   ['#20261A', '#4E5A3A', '#3A4530', '#6E7C48'],
  olive:   ['#242A18', '#5B6636', '#43502C', '#7C8A4E'],
  dry:     ['#2A2416', '#7A6A3A', '#5A4E2A', '#9E8C4C'],
  conifer: ['#1A2214', '#374828', '#28351E', '#4E6234'],
};

function tree(id, S, palKey, spiky = false, seed = 1) {
  const [outline, base, shadow, high] = PAL[palKey];
  const rng = mulberry32(seed);
  const c = S / 2, r = S * 0.42;
  const basePath = blob(c, c, r, spiky ? 14 : 12, spiky ? 0.28 : 0.18, rng, spiky);
  const w = Math.max(2, S * 0.018);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">`
    + `<defs><clipPath id="clp">${`<path d="${basePath}"/>`}</clipPath></defs>`
    + `<path d="${basePath}" fill="${base}" stroke="${outline}" stroke-width="${w.toFixed(1)}" stroke-linejoin="round"/>`
    + `<g clip-path="url(#clp)">`
    + lobes(c, c, r, 3, 0.32, [0.7, 0.7], shadow, seed + 11, 0.55)   // тень вниз-вправо
    + lobes(c, c, r, 3, 0.30, [-0.7, -0.7], high, seed + 23, 0.42)   // хайлайт вверх-влево
    + (spiky ? `<path d="${blob(c, c, r * 0.22, 8, 0.3, mulberry32(seed + 5))}" fill="${shadow}"/>` : '')
    + `</g></svg>`;
  fs.writeFileSync(path.join(OUT, id + '.svg'), svg);
  return id;
}

function bush(id, S, palKey, seed = 1) {
  const [outline, base, shadow, high] = PAL[palKey];
  const rng = mulberry32(seed);
  const c = S / 2;
  const centers = [[c - S * 0.16, c + S * 0.05], [c + S * 0.15, c + S * 0.02], [c, c - S * 0.15]];
  const w = Math.max(2, S * 0.02);
  let sil = '', clip = '';
  centers.forEach((p, i) => {
    const bp = blob(p[0], p[1], S * 0.24, 9, 0.3, mulberry32(seed + i));
    sil += `<path d="${bp}" fill="${base}" stroke="${outline}" stroke-width="${w.toFixed(1)}" stroke-linejoin="round"/>`;
    clip += `<path d="${bp}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">`
    + `<defs><clipPath id="clp">${clip}</clipPath></defs>`
    + sil
    + `<g clip-path="url(#clp)">`
    + centers.map((p, i) => lobes(p[0], p[1], S * 0.24, 2, 0.3, [0.7, 0.7], shadow, seed + i + 30, 0.55)
      + lobes(p[0], p[1], S * 0.24, 2, 0.28, [-0.7, -0.7], high, seed + i + 40, 0.4)).join('')
    + `</g></svg>`;
  fs.writeFileSync(path.join(OUT, id + '.svg'), svg);
  return id;
}

const made = [
  tree('tree-broadleaf-lg', 256, 'green', false, 7),
  tree('tree-broadleaf-md', 200, 'green', false, 12),
  tree('tree-broadleaf-sm', 150, 'green', false, 31),
  tree('tree-olive-lg', 256, 'olive', false, 4),
  tree('tree-dry-md', 200, 'dry', false, 19),
  tree('tree-conifer-lg', 256, 'conifer', true, 3),
  tree('tree-conifer-md', 200, 'conifer', true, 22),
  bush('bush-green-md', 180, 'green', 5),
  bush('bush-green-sm', 130, 'green', 14),
  bush('bush-dry-sm', 130, 'dry', 27),
];
console.log('готово, ассетов:', made.length, '→', OUT);
made.forEach((m) => console.log('  ', m + '.svg'));
