// scripts/jpg-to-webp.mjs
// Пакетная конвертация JPG -> WebP через sharp (уже есть в node_modules).
//
// Запуск:
//   node scripts/jpg-to-webp.mjs                 // конвертация, оригиналы остаются
//   node scripts/jpg-to-webp.mjs --force         // перезаписать уже существующие .webp
//   node scripts/jpg-to-webp.mjs --delete        // удалить исходные .jpg после успешной конвертации
//   node scripts/jpg-to-webp.mjs --q=85          // качество (по умолчанию 82)
//   node scripts/jpg-to-webp.mjs --dir="C:\\путь" // другая папка

import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const DIR = path.resolve(value('dir', 'C:\\cta-project\\!non-related\\jpg-webp'));
const QUALITY = Number(value('q', '82'));
const FORCE = flag('force');
const DELETE_SOURCE = flag('delete');
const CONCURRENCY = Math.max(1, Math.min(os.cpus().length, 8));

const fmt = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const entries = await readdir(DIR, { withFileTypes: true });
const jpgs = entries
  .filter((e) => e.isFile() && /\.jpe?g$/i.test(e.name))
  .map((e) => e.name)
  .sort();

if (jpgs.length === 0) {
  console.log(`Нечего конвертировать: ${DIR}`);
  process.exit(0);
}

console.log(`Папка: ${DIR}`);
console.log(`Найдено JPG: ${jpgs.length} | quality=${QUALITY} | потоков=${CONCURRENCY}`);
console.log(FORCE ? 'Режим: перезапись существующих .webp' : 'Режим: пропуск существующих .webp');
console.log(DELETE_SOURCE ? 'Оригиналы: УДАЛЯЮТСЯ после конвертации\n' : 'Оригиналы: сохраняются\n');

let converted = 0;
let skipped = 0;
let failed = 0;
let bytesIn = 0;
let bytesOut = 0;
let cursor = 0;

async function processOne(name) {
  const src = path.join(DIR, name);
  const dest = path.join(DIR, name.replace(/\.jpe?g$/i, '.webp'));

  if (!FORCE) {
    try {
      await stat(dest);
      skipped += 1;
      console.log(`~ пропуск  ${name} (webp уже есть)`);
      return;
    } catch {
      /* нет файла — конвертируем */
    }
  }

  try {
    const before = (await stat(src)).size;
    const info = await sharp(src)
      .rotate() // применить EXIF-ориентацию
      .webp({ quality: QUALITY, effort: 6, smartSubsample: true })
      .toFile(dest);

    bytesIn += before;
    bytesOut += info.size;
    converted += 1;

    const saved = ((1 - info.size / before) * 100).toFixed(0);
    console.log(`+ ${name} -> ${path.basename(dest)}  ${fmt(before)} -> ${fmt(info.size)}  (-${saved}%)`);

    if (DELETE_SOURCE) await unlink(src);
  } catch (err) {
    failed += 1;
    console.error(`! ОШИБКА ${name}: ${err.message}`);
  }
}

async function worker() {
  while (cursor < jpgs.length) {
    const name = jpgs[cursor];
    cursor += 1;
    await processOne(name);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log('\n--- ИТОГ ---');
console.log(`Сконвертировано: ${converted}`);
console.log(`Пропущено:       ${skipped}`);
console.log(`Ошибок:          ${failed}`);
if (converted > 0) {
  console.log(`Объём: ${fmt(bytesIn)} -> ${fmt(bytesOut)} (экономия ${((1 - bytesOut / bytesIn) * 100).toFixed(1)}%)`);
}
