// Сборка тайлов-пирамиды карты из JPG-мастеров (наш HD-арт → Leaflet L.tileLayer).
// Паттерн и грабли — в skill map-stitch. Использование:
//   npm run tiles:factory            (шорткат из package.json)
//   node scripts/build-map-tiles.mjs factory
//
// Что делает: валидирует мастера (квадрат 16384²!), чистит старые тайлы, режет каждый
// этаж в {z}/{y}/{x}.jpg (google-layout), бампает tileVersion в eft-map-config.ts (cache-bust).
//
// ⚠️ Грабли (закреплены в map-stitch):
//  - libvips google-layout пишет {z}/{y}/{x}, вьюер обязан просить /{z}/{y}/{x} (иначе транспон).
//  - НЕквадратный холст → sharp добивает белым нижний ряд. Мастера строго 16384².
//  - Одни URL при перенарезке → браузер отдаёт старые из кэша. Отсюда авто-бамп tileVersion (?v=).

import sharp from 'sharp';
import { rm, readFile, writeFile, access, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

sharp.cache(false);

// Реестр карт: файл-мастер → папка-этаж. Новую карту заводим одним блоком здесь + npm-шорткатом.
const SPECS = {
  factory: {
    configSlug: 'factory',                    // ключ в EFT_MAP_CONFIG, где бампать tileVersion (промоут 2026-08-13)
    src: 'public/maps/factory/16384px/jpg',   // папка JPG-мастеров
    out: 'public/maps/factory/tiles',         // корень пирамиды (folder на этаж)
    tileSize: 256,
    quality: 88,
    expect: 16384,                            // ожидаемая сторона мастера (квадрат)
    floors: [
      { file: '00-Factory-Basement_minus1lvl.jpg', folder: 'basement' },
      { file: '01-Factory-GroundFloor_1lvl.jpg', folder: 'ground' },
      { file: '02-Factory-SecondFloor_2lvl.jpg', folder: 'second' },
      { file: '03-Factory-ThirdFloor_3lvl.jpg', folder: 'third' },
    ],
  },
};

const CONFIG_PATH = 'src/data/eft-map-config.ts';

const die = (msg) => { console.error(`\n❌ ${msg}\n`); process.exit(1); };

async function countTiles(dir) {
  let n = 0;
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (e.isDirectory()) await walk(`${d}/${e.name}`);
      else if (e.name.endsWith('.jpg') || e.name.endsWith('.webp')) n++;
    }
  };
  await walk(dir);
  return n;
}

// Бампнуть tileVersion у нужной карты в eft-map-config.ts (cache-bust ?v=). Возвращает [old,new].
async function bumpVersion(configSlug) {
  let cfg = await readFile(CONFIG_PATH, 'utf8');
  // Ключ карты бывает в кавычках ("factory-hd":) и без (factory:, валидный идентификатор) — ловим оба.
  const esc = configSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const km = cfg.match(new RegExp(`["']?${esc}["']?\\s*:\\s*\\{`));
  if (!km) return null; // карты нет в конфиге — не критично
  const keyAt = km.index;
  const head = cfg.slice(0, keyAt);
  const tail = cfg.slice(keyAt);
  const m = tail.match(/tileVersion:\s*(\d+)/);
  if (!m) return ['—', '—']; // у карты нет tileVersion — пропускаем
  const cur = Number(m[1]);
  const next = cur + 1;
  const newTail = tail.replace(/tileVersion:\s*\d+/, `tileVersion: ${next}`);
  await writeFile(CONFIG_PATH, head + newTail);
  return [cur, next];
}

async function main() {
  const map = process.argv[2];
  if (!map) die(`укажи карту: node scripts/build-map-tiles.mjs <${Object.keys(SPECS).join('|')}>`);
  const spec = SPECS[map];
  if (!spec) die(`нет карты "${map}" в реестре SPECS. Известные: ${Object.keys(SPECS).join(', ')}`);

  console.log(`\n🗺  Сборка тайлов: ${map}\n`);

  // 1) Валидация мастеров (существование + квадрат ожидаемого размера)
  for (const fl of spec.floors) {
    const p = `${spec.src}/${fl.file}`;
    if (!existsSync(p)) die(`нет мастера: ${p}`);
    const meta = await sharp(p, { limitInputPixels: false }).metadata();
    const square = meta.width === spec.expect && meta.height === spec.expect;
    if (!square) {
      die(`${fl.file}: ${meta.width}×${meta.height} — ожидался квадрат ${spec.expect}². ` +
          `НЕквадрат → sharp добьёт белым нижний ряд (см. map-stitch). Переэкспортируй мастер.`);
    }
  }

  // 2) Чистая перенарезка (удаляем весь корень пирамиды — режем все этажи заново)
  await rm(spec.out, { recursive: true, force: true });

  let total = 0;
  const t0 = Date.now();
  for (const fl of spec.floors) {
    const s = Date.now();
    const info = await sharp(`${spec.src}/${fl.file}`, { limitInputPixels: false })
      .jpeg({ quality: spec.quality, mozjpeg: true })
      .tile({ size: spec.tileSize, layout: 'google' })   // → {z}/{y}/{x}.jpg
      .toFile(`${spec.out}/${fl.folder}`);
    const n = await countTiles(`${spec.out}/${fl.folder}`);
    total += n;
    console.log(`  ✓ ${fl.folder.padEnd(9)} ${info.width}×${info.height}  ${n} тайлов  ${((Date.now() - s) / 1000).toFixed(1)}с`);
  }

  // 3) Cache-bust: бампнуть tileVersion в конфиге
  const bump = await bumpVersion(spec.configSlug);

  console.log(`\n  Итого: ${total} тайлов за ${((Date.now() - t0) / 1000).toFixed(1)}с`);
  if (bump) console.log(`  tileVersion (${spec.configSlug}): ${bump[0]} → ${bump[1]} (URL ?v=${bump[1]})`);
  else console.log(`  ⚠ ${spec.configSlug} не найден в ${CONFIG_PATH} — tileVersion не бампнут`);
  console.log(`\n  Готово. Тайлы в ${spec.out} (в .gitignore). Обнови вкладку — свежие подтянутся.\n`);
}

main().catch((e) => die(e.message));
