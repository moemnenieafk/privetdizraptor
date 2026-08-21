// Чистые хелперы экономики крафта убежища (без сторов/DOM/React, без сайд-эффектов).
// Портирование клиентской математики tarkov.dev 1:1 по docs/research/eft-craft-profit-tarkovdev.md §1–2.

/** Уровень навыка клампится в 0..50 (максимум навыка = 50, 51 — только порог Elite-перка). */
function clampSkill(level: number): number {
  if (!Number.isFinite(level)) return 0;
  if (level < 0) return 0;
  if (level > 50) return 50;
  return Math.floor(level);
}

/** Не-число / отрицательное / NaN / Infinity → 0. Страховка от деления на 0 в цепочке. */
function safe(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Множитель времени крафта от навыка Crafting: 1 − level·0.75%.
 * На максимуме (50) → 0.625 (−37.5% длительности). §2 ресёрча.
 */
export function craftingTimeFactor(level: number): number {
  return 1 - clampSkill(level) * 0.0075;
}

/** Длительность крафта со скидкой Crafting: floor(base · factor). lvl0 → base без изменений. */
export function effectiveDuration(baseSec: number, craftingLevel: number): number {
  return Math.floor(safe(baseSec) * craftingTimeFactor(craftingLevel));
}

/**
 * Комиссия барахолки — verbatim `flea-market-fee.mjs` (§1.3):
 *   P0 = log10(V0/VR); PR = log10(VR/V0)          // V0 = basePrice, VR = sellPrice
 *   если VR <  V0: P0 = P0^1.08                    // «утяжеление» логарифма с положительным знаком
 *   если VR >= V0: PR = PR^1.08
 *   IC = intelCenter ? 1 − (0.01·HM + 1)·0.3 : 1   // скидка Разведцентра 3 ур. (+0.3%/ур HM)
 *   fee = ceil( V0·0.03·4^P0·Q + VR·0.03·4^PR·Q ) · IC   // Ti = Tr = 0.03, Q = count
 * Нет цены (V0 или VR = 0) → комиссия 0 (log10 не определён, канал флиа не выбирается).
 */
export function fleaFee(
  basePrice: number,
  sellPrice: number,
  count: number,
  opts: { intelCenterBuilt: boolean; hideoutMgmtLevel: number },
): number {
  const V0 = safe(basePrice);
  const VR = safe(sellPrice);
  const Q = safe(count);
  if (V0 <= 0 || VR <= 0 || Q <= 0) return 0;

  const Ti = 0.03;
  const Tr = 0.03;
  let P0 = Math.log10(V0 / VR);
  let PR = Math.log10(VR / V0);

  // Показатель 1.08 применяется к тому логарифму, чей знак положительный.
  if (VR < V0) P0 = Math.pow(P0, 1.08);
  if (VR >= V0) PR = Math.pow(PR, 1.08);

  const HM = clampSkill(opts.hideoutMgmtLevel);
  const IC = opts.intelCenterBuilt ? 1 - (0.01 * HM + 1) * 0.3 : 1;

  const fee = Math.ceil(V0 * Ti * Math.pow(4, P0) * Q + VR * Tr * Math.pow(4, PR) * Q) * IC;
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

/** Один вход рецепта. Инструмент и FIR-предмет обнуляют стоимость (§1.1). */
export interface CraftEconomyInput {
  inputs: {
    unitBuy: number;
    count: number;
    isFir?: boolean;
    isTool?: boolean;
    isFuel?: boolean;
    /** Продажа трейдеру за штуку — база для «пустого топлива» (10%). */
    sellTrader?: number;
  }[];
  output: { basePrice: number; bestTraderSell: number; fleaPrice: number; count: number; buyBest: number };
  baseDurationSec: number;
  craftingLevel: number;
  hideoutMgmtLevel: number;
  intelCenterBuilt: boolean;
  /** Тумблер «пустое топливо»: fuel-вход считается как sellTrader·0.1 (§1.5). */
  emptyFuel?: boolean;
}

export interface CraftEconomy {
  totalCost: number;
  /** Валовая выбранная выручка (fleaTotal если флиа победила, иначе traderTotal). */
  outputValue: number;
  /** Комиссия флиа на весь тираж — 0, если продажа через трейдера. */
  fleaFeeTotal: number;
  profit: number;
  effDurationSec: number;
  profitPerHour: number;
  roi: number;
  usedFlea: boolean;
  /** Экономия «крафт для себя»: цена покупки выхода (buyBest·count) − стоимость входов. 0, если нет цены. */
  savings: number;
}

/** Стоимость одного входа за штуку: инструмент/FIR → 0; пустое топливо → sellTrader·0.1; иначе unitBuy. */
function inputUnitCost(inp: CraftEconomyInput["inputs"][number], emptyFuel: boolean): number {
  if (inp.isTool || inp.isFir) return 0;
  if (emptyFuel && inp.isFuel) return safe(inp.sellTrader) * 0.1;
  return safe(inp.unitBuy);
}

/** Экономика одного крафта: стоимость входов, выбор канала продажи, профит, профит/час, ROI. */
export function computeCraftEconomy(i: CraftEconomyInput): CraftEconomy {
  const emptyFuel = i.emptyFuel ?? false;

  // totalCost = Σ (цена входа за штуку · count) по не-инструментам/не-FIR.
  const totalCost = i.inputs.reduce(
    (sum, inp) => sum + inputUnitCost(inp, emptyFuel) * safe(inp.count),
    0,
  );

  const outCount = safe(i.output.count);
  const basePrice = safe(i.output.basePrice);
  const fleaPrice = safe(i.output.fleaPrice);
  const bestTraderSell = safe(i.output.bestTraderSell);

  // Валовые выручки каждого канала на весь тираж.
  const traderTotal = bestTraderSell * outCount;
  const fleaTotal = fleaPrice * outCount;
  const fee = fleaFee(basePrice, fleaPrice, outCount, {
    intelCenterBuilt: i.intelCenterBuilt,
    hideoutMgmtLevel: i.hideoutMgmtLevel,
  });
  const fleaNet = fleaTotal - fee;

  // Побеждает флиа, только если чистая выручка (после комиссии) выше трейдера.
  const usedFlea = fleaNet > traderTotal;
  const outputValue = usedFlea ? fleaTotal : traderTotal;
  const fleaFeeTotal = usedFlea ? fee : 0;
  const netSell = usedFlea ? fleaNet : traderTotal;

  const profit = netSell - totalCost;

  // Экономия «крафт для себя»: сколько сэкономишь, сделав выход сам вместо покупки на весь тираж.
  // Нет цены покупки выхода → 0 (не мотивируем крафтить то, что не купить). Guard от NaN/Infinity.
  const buyBest = safe(i.output.buyBest);
  const savingsRaw = buyBest * outCount - totalCost;
  const savings = Number.isFinite(savingsRaw) ? savingsRaw : 0;

  const effDurationSec = effectiveDuration(i.baseDurationSec, i.craftingLevel);

  // profit/час: делим на длительность в часах; при eff=0 не делим (0, а не Infinity).
  const profitPerHour = effDurationSec > 0 ? Math.floor(profit / (effDurationSec / 3600)) : 0;
  // ROI %: при нулевой стоимости не делим (0, а не Infinity).
  const roi = totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0;

  return {
    totalCost,
    outputValue,
    fleaFeeTotal,
    profit,
    effDurationSec,
    profitPerHour,
    roi,
    usedFlea,
    savings,
  };
}
