// scripts/reexport-seasonal-icons.mjs
// Пере-экспорт эмблем сезонного тира KORD BREACH из мастеров V4DYA (converted/, 2000px)
// в веб-иконки public/images/achievements/eft/<id>.webp (512px bbox, q85, alpha сохранён).
//
// ПОЧЕМУ ЯВНЫЙ СПИСОК, А НЕ glob: в converted/ лежит и мусор —
//   • 6a399c…/6a4fbe… — сырые не-обрамлённые (зелёные) эмблемы, СУПЕРСЕДНУТЫ рамочными → НЕ берём;
//   • 16.webp — рамочная эмблема, но не опознана под достижение → НЕ берём (ждёт маппинга V4DYA).
// Ресайз fit:inside 512×512 (мастера ~1920×2194 → ~448×512), апскейла нет.
//
// Запуск: node scripts/reexport-seasonal-icons.mjs

import sharp from 'sharp';
import path from 'node:path';
import { access } from 'node:fs/promises';

const SRC = 'public/images/achievements/eft/недостающие/converted';
const DST = 'public/images/achievements/eft';
const SIZE = 512;
const Q = 85;

// [файл-мастер в converted/, имя-иконки в eft/ (= id достижения)]
const MAP = [
  // 11 существующих сезонных (реальные BSG-id) — заменяем крошечные live на 512px
  ['6a59f494033e98046303c376.webp', '6a59f494033e98046303c376.webp'], // Беливер
  ['6a59f4a8ab4f251a6e02e45c.webp', '6a59f4a8ab4f251a6e02e45c.webp'], // Совершенно Секретно
  ['6a59f4ae68241e13f50367b4.webp', '6a59f4ae68241e13f50367b4.webp'], // Imposter
  ['6a59f4bfacaee8fa5d013977.webp', '6a59f4bfacaee8fa5d013977.webp'], // Помощь не нужна
  ['6a59f4ce033e98046303c377.webp', '6a59f4ce033e98046303c377.webp'], // У меня был план
  ['6a59f4d4ceec2980f10364db.webp', '6a59f4d4ceec2980f10364db.webp'], // Одна хорошо, а две лучше
  ['6a59f4df6a7772c9a60bebf7.webp', '6a59f4df6a7772c9a60bebf7.webp'], // Генетическая лотерея
  ['6a59f4e565aa8755e000b959.webp', '6a59f4e565aa8755e000b959.webp'], // Хардкор у нас дома
  ['6a59f4eaacaee8fa5d013978.webp', '6a59f4eaacaee8fa5d013978.webp'], // И это, по-твоему, челлендж?
  ['6a59f4f3fd4d9547d50ecfdd.webp', '6a59f4f3fd4d9547d50ecfdd.webp'], // Предприниматель от бога
  ['6a68dd058a4444b9f6035b51.webp', '6a68dd058a4444b9f6035b51.webp'], // Деньги не пахнут?
  // Рассвет новой эпохи (реальный BSG-id, золотая Каппа-эмблема без «I»)
  ['6a60f6f7d97ca215e600b6c4.webp', '6a60f6f7d97ca215e600b6c4.webp'],
  // 3 новых сезонных (синтетические id kbreach-*, в tarkov.dev их нет)
  ['First-step.webp', 'kbreach-first-step.webp'],   // Первый Шаг
  ['To-the-top.webp', 'kbreach-to-the-top.webp'],   // Достигнуть вершины
  ['Spring-comes.webp', 'kbreach-spring-comes.webp'], // Весна пришла
];

async function main() {
  let ok = 0;
  for (const [src, dst] of MAP) {
    const srcPath = path.join(SRC, src);
    try {
      await access(srcPath);
    } catch {
      console.error(`  ✗ нет мастера: ${src}`);
      continue;
    }
    const info = await sharp(srcPath)
      .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: Q })
      .toFile(path.join(DST, dst));
    console.log(`  ✓ ${dst.padEnd(34)} ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} КБ`);
    ok++;
  }
  console.log(`\nГотово: ${ok}/${MAP.length} иконок пере-экспортировано в ${SIZE}px.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
