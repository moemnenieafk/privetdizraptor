// Клиентский OCR скриншота барахолки: crop колонок через <canvas> + tesseract.js.
// ⚠️ БРАУЗЕР-ОНЛИ (createImageBitmap/canvas) — вызывать только из client-компонента.
// Геометрия колонок вынесена в GEO и масштабируется от эталона 1920x1080 → тюнится
// живьём одним местом (у разных игроков разное разрешение; v0 = пропорциональный скейл
// для 16:9). Построчная нарезка + PSM single-line (доказано спайком надёжнее блочного).
import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { MatchResult } from './match';
import type { ScannedOffer } from '@/store/useCompanionStore';

const REF_W = 1920;
const REF_H = 1080;

/** Геометрия при 1920x1080 (снято со спайка на живых скринах). Калибруется живьём. */
export const GEO = {
  listTop: 150, // y первой строки
  rowPitch: 72, // шаг строки (измерено по реальному скрину: ~72px при 1080p)
  maxRows: 12, // сколько строк влезает в кадр (13-я — частичная, с бейджем уровня «50» → не берём)
  price: { left: 1330, width: 150, height: 52 }, // большой номер цены (без ₽ — маскируется шириной)
  name: { left: 905, width: 400, height: 40 }, // колонка названия
} as const;

let priceWorker: Worker | null = null;
let nameWorker: Worker | null = null;

async function getPriceWorker(): Promise<Worker> {
  if (priceWorker) return priceWorker;
  const w = await createWorker('eng');
  await w.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: PSM.SINGLE_LINE });
  priceWorker = w;
  return w;
}

async function getNameWorker(): Promise<Worker> {
  if (nameWorker) return nameWorker;
  const w = await createWorker('rus');
  await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  nameWorker = w;
  return w;
}

/** Освободить воркеры (при остановке ридера). */
export async function disposeOcr(): Promise<void> {
  await Promise.all([priceWorker?.terminate(), nameWorker?.terminate()]);
  priceWorker = null;
  nameWorker = null;
}

interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Вырезать регион из битмапа в canvas с апскейлом x3 (мелкий текст → чище OCR). */
function cropCanvas(bitmap: ImageBitmap, r: Region): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.width * 3));
  c.height = Math.max(1, Math.round(r.height * 3));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context недоступен');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, r.left, r.top, r.width, r.height, 0, 0, c.width, c.height);
  return c;
}

/**
 * Распознать офферы с одного скриншота барахолки. Построчно: OCR цены (цифры) + имени
 * (ru) → фаззи-матч предмета. Возвращает валидные {inGameId, name, price}. Пустой массив —
 * норм (не барахолка / не распозналось). Не бросает на кривых строках — просто пропускает.
 */
export async function parseFleaScreenshot(
  file: File,
  match: (text: string) => MatchResult | null,
): Promise<ScannedOffer[]> {
  const bitmap = await createImageBitmap(file);
  const sx = bitmap.width / REF_W;
  const sy = bitmap.height / REF_H;
  const [pW, nW] = await Promise.all([getPriceWorker(), getNameWorker()]);

  const offers: ScannedOffer[] = [];
  try {
    for (let i = 0; i < GEO.maxRows; i++) {
      const rowTop = (GEO.listTop + i * GEO.rowPitch) * sy;

      const priceCanvas = cropCanvas(bitmap, {
        left: GEO.price.left * sx,
        top: rowTop,
        width: GEO.price.width * sx,
        height: GEO.price.height * sy,
      });
      const { data: pd } = await pW.recognize(priceCanvas);
      const price = parseInt(pd.text.replace(/\D/g, ''), 10);
      if (!Number.isFinite(price) || price <= 0) continue;

      const nameCanvas = cropCanvas(bitmap, {
        left: GEO.name.left * sx,
        top: rowTop,
        width: GEO.name.width * sx,
        height: GEO.name.height * sy,
      });
      const { data: nd } = await nW.recognize(nameCanvas);
      const m = match(nd.text);
      if (!m) continue;

      offers.push({ inGameId: m.inGameId, name: m.name, price });
    }
  } finally {
    bitmap.close();
  }
  return rejectOutliers(offers);
}

/**
 * Клиентская страховка: если в кадре ≥4 оффера ОДНОГО предмета (глубинный вид) —
 * отбрасываем цены вне [0.4×, 2.5×] медианы. Убивает грубые мисриды/дрейф (напр.
 * «48 000» среди LEDX по 700k). В общем списке (все предметы разные) не срабатывает —
 * там за качество отвечает серверная медиана по многим авторам.
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
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const o of group) {
      if (o.price >= median * 0.4 && o.price <= median * 2.5) out.push(o);
    }
  }
  return out;
}
