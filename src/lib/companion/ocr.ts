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
const PRICE_UP = 4; // апскейл кропа цены (x4 нужен для 7–8-значных чисел)

// Дообученная на шрифте барахолки (Bender) модель — чинит корневой 0↔6 (перечёркнутый ноль).
// Файл public/tessdata/eftflea.traineddata (несжатый → gzip:false), OEM 1 = LSTM-only (файн-тюнили LSTM).
// Fine-tune: eng→eftflea, синтетика scripts/ocr-train/gen_synthetic.py (8000 пар), Colab-ран.
// Живой тест на реальном скрине: eftflea 4/5 vs eng 1/5 (docs/research/companion-ocr-evolution.md).
const FLEA_LANG = 'eftflea';
const FLEA_OPTS = { langPath: '/tessdata', gzip: false } as const;
const LSTM_ONLY = 1; // OEM.LSTM_ONLY

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
  const w = await createWorker(FLEA_LANG, LSTM_ONLY, FLEA_OPTS);
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

type CanvasMode = 'gray' | 'bin';

/**
 * Вырезать регион исходника в canvas с апскейлом.
 *  gray — просто grayscale (колонка имён и т.п.).
 *  bin  — бинаризация (порог 150): чёткий контраст под дообученную eftflea (нули читает верно).
 */
function regionCanvas(bitmap: ImageBitmap, r: Region, up: number, mode: CanvasMode = 'gray'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.width * up));
  c.height = Math.max(1, Math.round(r.height * up));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context недоступен');
  ctx.filter = 'grayscale(1)';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, r.left, r.top, r.width, r.height, 0, 0, c.width, c.height);
  if (mode === 'gray') return c;
  ctx.filter = 'none';
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] >= 150 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
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
    // Бинаризация и здесь: на поиске с 1 результатом фоновый рендер за пустым списком
    // сбивал SINGLE_BLOCK (имя читалось как «Л |»); порог убирает слабый фон.
    const nameCanvas = regionCanvas(bitmap, nameRegion, NAME_UP, 'bin');
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
      // Один bin-read. Прежний norm-dual-read по миллионам был костылём под слепоту eng к
      // перечёркнутому нулю Bender (bin ломал нули → 11 000 000 читалось как 11 600 600).
      // Дообученная eftflea читает нули верно, а norm-склейка ей ВРЕДИЛА (шум → 15-значный мусор):
      // живой тест на реальном скрине bin-only 4/5 vs norm 3/5 vs eng 1/5. Убрано (2026-07-25).
      const priceCanvas = regionCanvas(bitmap, priceRegion, PRICE_UP, 'bin');
      const price = parseInt((await pW.recognize(priceCanvas)).data.text.replace(/\D/g, ''), 10);
      if (!Number.isFinite(price) || price <= 0) continue;

      // Использования X/Y (ключи/износ): Y = maxUses берём из КАТАЛОГА (авторитетно, статик-свойство).
      // X по скрину НЕ читаем — цифра часто КРАСНАЯ (люма тонет под порогом) + иконка/«Всего N» рядом
      // делают OCR ненадёжным (разбор: docs/research/companion-ocr-evolution.md). Дефолт X = полный
      // (частый кейс на барахолке), юзер правит в редактируемом X/Y-инпуте ридера.
      const maxUses = m.maxUses;
      const uses = maxUses; // «полный» по умолчанию; редактируется пользователем

      offers.push({ inGameId: m.inGameId, name: m.name, price, uses, maxUses });
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
