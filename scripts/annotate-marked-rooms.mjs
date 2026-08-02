// Разметка marked-room SVG слагами комнат: каждой фигуре (<g filter>…<path/rect>) проставляем
// data-room="<slug>" + class="cta-room" по КООРДИНАТЕ фигуры (устойчиво к смене filter-id при ре-экспорте).
// Запуск: node scripts/annotate-marked-rooms.mjs  (после копирования свежих SVG из map-exports в public).
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = 'public/images/maps/eft/marked-rooms';
// coord (первая точка фигуры) → slug комнаты. Слаги — как в marked_rooms (сид).
const ROOMS = {
  'customs.svg': [[507, 483, 'komnaty-314-obshchezhitiya']],
  'reserve.svg': [[572, 419, 'rb-pkpm'], [632, 379, 'rb-bk'], [135, 63, 'rb-vo']],
  'streets-of-tarkov.svg': [[133, 522, 'strannoy-komnaty'], [452, 563, 'zabroshennogo-zavoda']],
  'lighthouse.svg': [[189, 1483, 'obshchey-spalni']],
};

for (const [file, rooms] of Object.entries(ROOMS)) {
  let svg = readFileSync(`${DIR}/${file}`, 'utf8');
  let n = 0;
  svg = svg.replace(/<g filter="url\(#([^)]+)\)">\s*<(path|rect)([^>]*?)\/>/g, (m, fid, tag, attrs) => {
    if (/data-room=/.test(m)) return m; // идемпотентно
    const dM = attrs.match(/\bd="M\s*([\d.]+)[ ,]([\d.]+)/);
    const rM = attrs.match(/\bx="([\d.]+)"\s+y="([\d.]+)"/);
    const x = dM ? +dM[1] : rM ? +rM[1] : null;
    const y = dM ? +dM[2] : rM ? +rM[2] : null;
    if (x == null) return m;
    let best = null, bd = Infinity;
    for (const [rx, ry, slug] of rooms) {
      const d = Math.hypot(rx - x, ry - y);
      if (d < bd) { bd = d; best = slug; }
    }
    n++;
    return `<g filter="url(#${fid})" data-room="${best}" class="cta-room"><${tag}${attrs}/>`;
  });
  writeFileSync(`${DIR}/${file}`, svg);
  console.log(`${file}: размечено фигур = ${n}`);
}
