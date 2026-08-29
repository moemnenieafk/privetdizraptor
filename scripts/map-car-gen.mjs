// Параметрический флэт-вектор седан (топ-даун, перёд вверху) — канон CAR-SEDAN.
// Один силуэт → все машины перекрасом (body/roof) + опц. полицейская ливрея (lightbar+белая крыша).
// Свет сверху-слева. Выход — SVG в gen/vehicles/. Запуск: node scripts/map-car-gen.mjs
import fs from 'node:fs';
const OUT = 'map-exports/OBJECTS-MAPS/gen/vehicles';
fs.mkdirSync(OUT, { recursive: true });

const OL = '#0E1620', GLASS = '#1B2A38', TYRE = '#141414', TYRE_HI = '#2C2C2C';

function shade(hex, f) { // f>0 светлее, f<0 темнее
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * f)));
  return '#' + [m(r), m(g), m(b)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function car({ id, body, roof, cop = false }) {
  const W = 200, H = 430;
  const bx = 40, bw = 120, by = 16, bh = 398, rx = 34;
  const bHi = shade(body, 0.10), bSh = shade(body, -0.12);
  const rTone = roof, rHi = shade(roof, 0.10);
  const ww = 24, wh = 56;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;
  // колёса (под кузовом, торчат по бокам)
  for (const wy of [by + 44, by + bh - 44 - wh]) for (const wx of [bx - 10, bx + bw - ww + 10]) {
    s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="7" fill="${TYRE}" stroke="${OL}" stroke-width="3"/>`;
    s += `<rect x="${wx + 3}" y="${wy + 4}" width="${ww - 10}" height="${wh - 20}" rx="4" fill="${TYRE_HI}"/>`;
  }
  // кузов
  s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${rx}" fill="${body}" stroke="${OL}" stroke-width="5" stroke-linejoin="round"/>`;
  // тень низ-право / хайлайт верх-лево (тонкие полосы вдоль борта)
  s += `<rect x="${bx + bw - 20}" y="${by + 26}" width="14" height="${bh - 52}" rx="7" fill="${bSh}" opacity="0.85"/>`;
  s += `<rect x="${bx + 8}" y="${by + 26}" width="12" height="${bh - 52}" rx="6" fill="${bHi}" opacity="0.8"/>`;
  // капот/багажник линии
  s += `<rect x="${bx + 22}" y="${by + 20}" width="${bw - 44}" height="4" fill="${bSh}"/>`;
  s += `<rect x="${bx + 22}" y="${by + bh - 24}" width="${bw - 44}" height="4" fill="${bSh}"/>`;
  // крыша/кабина
  const cx0 = bx + 18, cw = bw - 36, cy0 = by + 128, ch = 158, crx = 22;
  s += `<rect x="${cx0}" y="${cy0}" width="${cw}" height="${ch}" rx="${crx}" fill="${rTone}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>`;
  s += `<rect x="${cx0 + 8}" y="${cy0 + 10}" width="${cw - 16}" height="10" rx="5" fill="${rHi}" opacity="0.7"/>`;
  // лобовое + заднее стекло (трапеции)
  s += `<polygon points="${cx0 + 8},${cy0} ${cx0 + cw - 8},${cy0} ${cx0 + cw - 20},${cy0 - 22} ${cx0 + 20},${cy0 - 22}" fill="${GLASS}"/>`;
  s += `<polygon points="${cx0 + 8},${cy0 + ch} ${cx0 + cw - 8},${cy0 + ch} ${cx0 + cw - 20},${cy0 + ch + 22} ${cx0 + 20},${cy0 + ch + 22}" fill="${GLASS}"/>`;
  // боковые окна
  s += `<rect x="${cx0 + 6}" y="${cy0 + 28}" width="9" height="${ch - 56}" rx="4" fill="${GLASS}"/>`;
  s += `<rect x="${cx0 + cw - 15}" y="${cy0 + 28}" width="9" height="${ch - 56}" rx="4" fill="${GLASS}"/>`;
  // зеркала
  for (const mx of [bx - 6, bx + bw - 6]) s += `<rect x="${mx}" y="${cy0 + 4}" width="12" height="10" rx="3" fill="${body}" stroke="${OL}" stroke-width="2"/>`;
  // полицейская ливрея: белые двери-полоса уже через roof=white; лайтбар на крыше
  if (cop) {
    const lby = cy0 + 20;
    s += `<rect x="${cx0 + 14}" y="${lby}" width="${(cw - 28) / 2}" height="16" fill="#c02020"/>`;
    s += `<rect x="${cx0 + 14 + (cw - 28) / 2}" y="${lby}" width="${(cw - 28) / 2}" height="16" fill="#2050c0"/>`;
    s += `<rect x="${cx0 + 14}" y="${lby}" width="${cw - 28}" height="16" fill="none" stroke="${OL}" stroke-width="2"/>`;
  }
  s += `</svg>`;
  fs.writeFileSync(`${OUT}/${id}.svg`, s);
  return id;
}

const made = [
  car({ id: 'car-cop', body: '#2C4E86', roof: '#E6E8EA', cop: true }),
  car({ id: 'car-black', body: '#26282B', roof: '#303338' }),
  car({ id: 'car-white', body: '#C7C3BB', roof: '#D8D5CE' }),
  car({ id: 'car-grey', body: '#6E7276', roof: '#7C8084' }),
  car({ id: 'car-darkblue', body: '#2B3550', roof: '#333E5C' }),
  car({ id: 'car-yellow', body: '#3A3A3E', roof: '#B6A24A' }),
];
console.log('машин:', made.length, '→', OUT);
made.forEach((m) => console.log('  ', m + '.svg'));
