// Верификация дообученной модели eftflea против baseline eng на размеченных сэмплах.
// Запуск: node scripts/ocr-train/verify.mjs [N]
// Читает сэмплы из C:\tmp-ocr-verify (png + .gt.txt), OCR-ит обеими моделями, сверяет с ground-truth.
import { createWorker } from 'tesseract.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'C:\\tmp-ocr-verify';
const TESSDATA = 'C:\\cta-project\\public\\tessdata'; // здесь лежит eftflea.traineddata (gzip:false)
const N = parseInt(process.argv[2] || '120', 10);

// цель-строка → как её увидит ценовой/uses воркер (цифры и '/').
const norm = (s) => s.replace(/[^0-9/]/g, '');

const bases = readdirSync(DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
// Отбираем «трудные»: с нулём в числе (риск 0↔6) и все X/Y — плюс общая случайная подборка.
const withGt = bases.map((b) => ({ b, gt: norm(readFileSync(join(DIR, b + '.gt.txt'), 'utf8').trim()) }));
const hard = withGt.filter((x) => /0/.test(x.gt) || x.gt.includes('/'));
const pick = hard.slice(0, N);

async function run(lang, oem, opts) {
  const w = await createWorker(lang, oem, opts);
  await w.setParameters({ tessedit_char_whitelist: '0123456789/', tessedit_pageseg_mode: 7 }); // 7 = SINGLE_LINE
  let ok = 0;
  const misses = [];
  for (const { b, gt } of pick) {
    const { data } = await w.recognize(join(DIR, b + '.png'));
    const got = norm(data.text);
    if (got === gt) ok++;
    else if (misses.length < 12) misses.push(`${gt} → ${got}`);
  }
  await w.terminate();
  return { ok, total: pick.length, misses };
}

console.log(`Сэмплов (трудных, с нулём/дробью): ${pick.length}\n`);

const eftflea = await run('eftflea', 1, { langPath: TESSDATA, gzip: false });
console.log(`eftflea (дообученная): ${eftflea.ok}/${eftflea.total} = ${(100 * eftflea.ok / eftflea.total).toFixed(1)}%`);
console.log('  промахи:', eftflea.misses.join('  |  ') || 'нет');

const eng = await run('eng', 1, {});
console.log(`\neng (baseline):        ${eng.ok}/${eng.total} = ${(100 * eng.ok / eng.total).toFixed(1)}%`);
console.log('  промахи:', eng.misses.join('  |  ') || 'нет');
