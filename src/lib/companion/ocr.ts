// Клиентский OCR скриншота барахолки — NAME-ANCHORED подход.
// ⚠️ БРАУЗЕР-ОНЛИ (createImageBitmap/canvas) — вызывать только из client-компонента.
//
// Почему так (а не построчно по фиксированному шагу): фикс-геометрия строк хрупкая —
// на коротких/повторяющихся числах кроп цены уезжает (давал мусор 22/3/112 ₽). Зато
// колонка ИМЁН сегментируется tesseract'ом надёжно (SINGLE_BLOCK + bbox): каждая
// строка-предмет даёт свой Y. Используем Y имени как ЯКОРЬ строки и режем цену по нему.
// Плюсы: самокалибрующийся (нет listTop/pitch), чинит и общий список, и поиск. Прочие
// строки («Всего N», хлебные крошки) отсеиваются сами — не матчатся с каталогом.
// Валидация: docs/decisions/eft-live-price-companion.md (спайк 2026-07-23, n2 общий список).
import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { MatchResult } from './match';
import type { ScannedOffer } from '@/store/useCompanionStore';

const REF_W = 1920;
const REF_H = 1080;

/** Геометрия при 1920x1080 (снято/выверено на живых скринах). Масштабируется от разрешения. */
export const GEO = {
  name: { left: 905, top: 150, width: 400, height: 900 }, // колонка названий (список)
  price: { left: 1300, width: 168, cropH: 58 }, // колонка цены: до ₽ (маскируем справа), центр по Y имени
} as const;

const NAME_UP = 2; // апскейл колонки имён под OCR
const PRICE_UP = 3; // апскейл кропа цены

let nameWorker: Worker | null = null;
let priceWorker: Worker | null = null;

async function getNameWorker(): Promise<Worker> {
  if (nameWorker) return nameWorker;
  const w = await createWorker('rus');
  await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  nameWorker = w;
  return w;
}

async function getPriceWorker(): Promise<Worker> {
  if (priceWorker) return priceWorker;
  const w = await createWorker('eng');
  await w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: PSM.SINGLE_LINE });
  priceWorker = w;
  return w;
}

export async function disposeOcr(): Promise<void> {
  await Promise.all([nameWorker?.terminate(), priceWorker?.terminate()]);
  nameWorker = null;
  priceWorker = null;
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Вырезать регион исходника в canvas с апскейлом (grayscale — чище OCR). */
function regionCanvas(bitmap: ImageBitmap, r: Region, up: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.width * up));
  c.height = Math.max(1, Math.round(r.height * up));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context недоступен');
  ctx.filter = 'grayscale(1)';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, r.left, r.top, r.width, r.height, 0, 0, c.width, c.height);
  return c;
}

/** Строки текста (с Y-центром в координатах canvas) из результата SINGLE_BLOCK. */
interface OcrLine {
  text: string;
  yc: number;
}
interface BlockLike {
  paragraphs?: { lines?: { text: string; bbox: { y0: number; y1: number } }[] }[];
}
function collectLines(blocks: BlockLike[] | null | undefined): OcrLine[] {
  const out: OcrLine[] = [];
  for (const b of blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        const text = l.text.trim();
        if (text) out.push({ text, yc: (l.bbox.y0 + l.bbox.y1) / 2 });
      }
    }
  }
  return out;
}

/**
 * Распознать офферы с одного скриншота барахолки. Якорим по именам, режем цену по Y имени.
 * Возвращает валидные {inGameId, name, price}. Пустой массив — норм. Не бросает на кривых
 * строках. Остаточные огрехи цены добивают медиана толпы + якорь tarkov.dev (Фаза 2).
 */
export async function parseFleaScreenshot(
  file: File,
  match: (text: string) => MatchResult | null,
): Promise<ScannedOffer[]> {
  const bitmap = await createImageBitmap(file);
  const sx = bitmap.width / REF_W;
  const sy = bitmap.height / REF_H;
  const [nW, pW] = await Promise.all([getNameWorker(), getPriceWorker()]);

  const offers: ScannedOffer[] = [];
  try {
    const nameRegion: Region = {
      left: GEO.name.left * sx,
      top: GEO.name.top * sy,
      width: GEO.name.width * sx,
      height: GEO.name.height * sy,
    };
    const nameCanvas = regionCanvas(bitmap, nameRegion, NAME_UP);
    const nameRes = await nW.recognize(nameCanvas, {}, { blocks: true });
    const lines = collectLines((nameRes.data as { blocks?: BlockLike[] }).blocks);

    for (const line of lines) {
      const m = match(line.text); // матч отсеивает «Всего N», крошки, мусор
      if (!m) continue;

      // Y центра строки в координатах ИСХОДНИКА (обратный апскейл имени).
      const origY = nameRegion.top + line.yc / NAME_UP;
      const priceRegion: Region = {
        left: GEO.price.left * sx,
        top: origY - (GEO.price.cropH / 2) * sy,
        width: GEO.price.width * sx,
        height: GEO.price.cropH * sy,
      };
      const priceCanvas = regionCanvas(bitmap, priceRegion, PRICE_UP);
      const { data } = await pW.recognize(priceCanvas);
      const price = parseInt(data.text.replace(/\D/g, ''), 10);
      if (!Number.isFinite(price) || price <= 0) continue;

      offers.push({ inGameId: m.inGameId, name: m.name, price });
    }
  } finally {
    bitmap.close();
  }
  return rejectOutliers(offers);
}

/**
 * Клиентская страховка: если в кадре ≥4 оффера ОДНОГО предмета (глубинный вид) —
 * отбрасываем цены вне [0.4×, 2.5×] медианы. Убивает грубые мисриды/дрейф. В общем
 * списке (предметы разные) не срабатывает — там за качество медиана по многим авторам.
 */
function rejectOutliers(offers: ScannedOffer[]): ScannedOffer[] {
  const byId = new Map<string, ScannedOffer[]>();
  for (const o of offers) {
    const g = byId.get(o.inGameId);
    if (g) g.push(o);
    else byId.set(o.inGameId, [o]);
  }
  const out: ScannedOffer[] = [];
  for (const group of byId.values()) {
    if (group.length < 4) {
      out.push(...group);
      continue;
    }
    const sorted = group.map((g) => g.price).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    for (const o of group) if (o.price >= med * 0.4 && o.price <= med * 2.5) out.push(o);
  }
  return out;
}
