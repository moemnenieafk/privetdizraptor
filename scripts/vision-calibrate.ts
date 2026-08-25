// CLI-ДИАГНОСТИКА уровня-1 (pHash) конвейера vision на РЕАЛЬНОМ скрине EFT 1.1.0.
//
// Зачем: detectGeometry/segmentItems/GRID_TUNING (src/lib/vision/grid.ts) рассчитаны
// на КРОП области инвентаря. На ПОЛНОЭКРАННОМ скрине (2560×1440) кадр содержит три
// геометрии сразу — слоты экипировки слева, РАВНОМЕРНАЯ сетка схрона/сорт-стола справа
// и панель быстрого доступа снизу. Глобальный detectPitch (автокорреляция профиля рёбер)
// смешивает их шаги и ловит мусорный pitch. Поэтому целевую зону (правую сетку) можно
// обрезать sharp'ом перед анализом — это моделирует то, что в проде фронт шлёт кроп сетки,
// а не весь экран.
//
// Что делает скрипт:
//   1. читает jpg в Buffer (опц. обрезает правую RIGHT_FRACTION часть кадра);
//   2. detectGeometry → печатает originX/originY/pitch/cols/rows;
//   3. segmentItems → число прямоугольников + гистограмма размеров w×h;
//   4. для каждого rect: cropSlot → dhash → findCandidates(hash,w,h),
//      печатает долю слотов kind:'unknown' (нет кандидата ≤ acceptDistance) vs pHash-распознанных.
//
// Уровень-2 (Gemini) СОЗНАТЕЛЬНО не трогаем: аккаунт 429/биллинг, калибруем уровень-1.
//
// ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ (зафиксировано при калибровке 1440p, 2026-08-25):
//   detectGeometry рассчитан на НАСТОЯЩУЮ инвентарную сетку (схрон/рюкзак/карманы), где
//   предмет честно занимает свой футпринт (винтовка = 5×2 клетки). На скрине eft-stash.jpg
//   правые ~40% — это «СОРТ. СТОЛ»/витрина: список иконок (иконка + подпись под ней), где
//   КАЖДЫЙ предмет = 1 визуальная ячейка независимо от реального размера. Поэтому даже при
//   идеальном GRID_TUNING сорт-стол не даёт реальных футпринтов — это не баг тюнинга.
//   ВЫВОД ДЛЯ ПРОДА: фронт должен слать кроп ИМЕННО инвентарной сетки (схрон/рюкзак), а не
//   весь экран и не сорт-стол. GRID_TUNING откалиброван на убирание ложных крупных склеек
//   (текст/градиент между рядами), см. коммент в src/lib/vision/grid.ts.
//
// Запуск (полный кадр):        npx tsx scripts/vision-calibrate.ts
//        (кроп правой сетки):  npx tsx scripts/vision-calibrate.ts --crop
//        (своя доля кропа):    npx tsx scripts/vision-calibrate.ts --crop=0.42
//        (свой файл):          npx tsx scripts/vision-calibrate.ts --img=path/to.jpg
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const DEFAULT_IMG = "docs/CTA-Vision-Spec/screenshots/eft-stash.jpg";
// Правая сетка схрона/сорт-стола занимает примерно правые 40% ширины кадра.
const DEFAULT_RIGHT_FRACTION = 0.4;

function parseArgs(): { img: string; crop: boolean; fraction: number } {
  let img = DEFAULT_IMG;
  let crop = false;
  let fraction = DEFAULT_RIGHT_FRACTION;
  for (const a of process.argv.slice(2)) {
    if (a === "--crop") crop = true;
    else if (a.startsWith("--crop=")) {
      crop = true;
      fraction = Number(a.slice("--crop=".length));
    } else if (a.startsWith("--img=")) img = a.slice("--img=".length);
  }
  return { img, crop, fraction };
}

/** Обрезать правую `fraction` часть кадра — модель кропа сетки, что шлёт фронт. */
async function cropRight(input: Buffer, fraction: number): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const cropW = Math.round(width * fraction);
  const left = width - cropW;
  return sharp(input)
    .extract({ left, top: 0, width: cropW, height })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const { img, crop, fraction } = parseArgs();

  // db-модуль (item-index) читает DATABASE_URL лениво — импортим ПОСЛЕ config().
  const { detectGeometry, segmentItems, cropSlot, GRID_TUNING } = await import(
    "../src/lib/vision/grid.ts"
  );
  const { dhash } = await import("../src/lib/vision/phash.ts");
  const { findCandidates, MATCH_TUNING } = await import(
    "../src/lib/vision/item-index.ts"
  );

  const raw = readFileSync(resolve(img));
  const meta = await sharp(raw).metadata();
  console.log(`\n=== vision-calibrate ===`);
  console.log(`изображение: ${img} (${meta.width}×${meta.height})`);
  console.log(`режим: ${crop ? `КРОП правых ${Math.round(fraction * 100)}%` : "ПОЛНЫЙ кадр"}`);
  console.log(`GRID_TUNING:`, JSON.stringify(GRID_TUNING));
  console.log(
    `MATCH_TUNING: accept=${MATCH_TUNING.acceptDistance} reject=${MATCH_TUNING.rejectDistance}`,
  );

  const buf = crop ? await cropRight(raw, fraction) : raw;
  const cropMeta = await sharp(buf).metadata();
  if (crop) console.log(`кроп: ${cropMeta.width}×${cropMeta.height}`);

  const geo = await detectGeometry(buf);
  if (!geo) {
    console.log(`\n❌ detectGeometry вернул null (pitch не найден)`);
    process.exit(0);
  }
  console.log(`\n--- detectGeometry ---`);
  console.log(
    `originX=${geo.originX} originY=${geo.originY} pitch=${geo.pitch} cols=${geo.cols} rows=${geo.rows}`,
  );

  const rects = await segmentItems(buf, geo);
  console.log(`\n--- segmentItems ---`);
  console.log(`прямоугольников (занятых слотов): ${rects.length}`);

  // Гистограмма размеров w×h.
  const hist = new Map<string, number>();
  for (const r of rects) {
    const key = `${r.w}×${r.h}`;
    hist.set(key, (hist.get(key) ?? 0) + 1);
  }
  const histSorted = [...hist.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`гистограмма размеров (w×h → шт):`);
  for (const [size, n] of histSorted) console.log(`  ${size.padEnd(6)} ${n}`);

  // Уровень-1: cropSlot → dhash → findCandidates.
  console.log(`\n--- уровень-1 (pHash) ---`);
  let phashOk = 0;
  let unknown = 0;
  const samplesOk: string[] = [];
  for (const rect of rects) {
    const slot = await cropSlot(buf, geo, rect);
    const hash = await dhash(slot);
    const candidates = await findCandidates(hash, rect.w, rect.h);
    const best = candidates[0];
    if (best && best.distance <= MATCH_TUNING.acceptDistance) {
      phashOk += 1;
      if (samplesOk.length < 15)
        samplesOk.push(`${rect.w}×${rect.h} d=${best.distance} ${best.name}`);
    } else {
      unknown += 1;
    }
  }
  const total = rects.length || 1;
  console.log(`распознано pHash (≤${MATCH_TUNING.acceptDistance}): ${phashOk} (${((phashOk / total) * 100).toFixed(1)}%)`);
  console.log(`unknown:                    ${unknown} (${((unknown / total) * 100).toFixed(1)}%)`);
  if (samplesOk.length) {
    console.log(`\nпримеры распознанного:`);
    for (const s of samplesOk) console.log(`  ${s}`);
  }

  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
