import type {
  StashItem,
  StashEconomics,
  BarterTrade,
  BarterItemBase,
  BarterCalculation,
  BarterVerdict,
} from '@/types/barter';

// ─── Налог барахолки (Flea Market) ──────────────────────────
// Документированная формула tarkov.dev. Константы патч-зависимы — держим именованными.
// 1.1.0.0 (03.08.2026): BSG подняла комиссию Барахолки 3% → 5% (Ti/Tr 0.03→0.05).
const FLEA_TAX_SELL = 0.05; // Ti
const FLEA_TAX_REQ = 0.05; // Tr
const FLEA_TAX_POWER = 1.08;

/** Комиссия барахолки за выставление лота: f(базовая цена, цена продажи, кол-во). */
export function calcFleaFee(basePrice: number, sellPrice: number, count = 1): number {
  if (basePrice <= 0 || sellPrice <= 0) return 0;
  const vo = basePrice * count; // ценность предмета
  const vr = sellPrice; // запрашиваемая цена (тотал за стак)
  let po = Math.log10(vo / vr);
  let pr = Math.log10(vr / vo);
  if (vr < vo) po = Math.pow(po, FLEA_TAX_POWER);
  else pr = Math.pow(pr, FLEA_TAX_POWER);
  const fee = vo * FLEA_TAX_SELL * Math.pow(4, po) + vr * FLEA_TAX_REQ * Math.pow(4, pr);
  return Number.isFinite(fee) && fee > 0 ? Math.round(fee) : 0;
}

const VERDICT_THRESHOLD = 500;

/** Вердикт по чистой прибыли «в карман». */
export function calcVerdict(netProfit: number): BarterVerdict {
  if (netProfit > VERDICT_THRESHOLD) return 'profitable';
  if (netProfit < -VERDICT_THRESHOLD) return 'unprofitable';
  return 'neutral';
}

export function isArbitrageProfitable(item: StashItem): boolean {
  return (
    item.fleaPrice !== null &&
    item.bestTraderPriceRub !== null &&
    item.fleaPrice < item.bestTraderPriceRub
  );
}

export function calcStashEconomics(items: StashItem[]): StashEconomics {
  let totalFleaValue = 0;
  let totalTraderValue = 0;
  let arbitrageCount = 0;
  let arbitrageProfit = 0;

  for (const item of items) {
    totalFleaValue += item.fleaPrice ?? 0;
    totalTraderValue += item.bestTraderPriceRub ?? 0;
    if (isArbitrageProfitable(item)) {
      arbitrageCount++;
      arbitrageProfit += item.bestTraderPriceRub! - item.fleaPrice!;
    }
  }

  return { totalFleaValue, totalTraderValue, arbitrageCount, arbitrageProfit };
}

export function calcBarterProfit(trade: BarterTrade, stashItems: StashItem[]): BarterCalculation {
  // Acquisition cost: cheapest source per required item (min of flea and trader sell price)
  const totalComponentsCost = stashItems.reduce((sum, i) => {
    const prices = [i.fleaPrice, i.bestTraderPriceRub].filter((p): p is number => p !== null && p > 0);
    return sum + (prices.length ? Math.min(...prices) : 0);
  }, 0);

  // Flea sell price of reward item(s) — used for calculatedSavings spec field
  const targetItemFleaPrice = trade.rewardItems.reduce((sum, { item, count }) => {
    const fleaEntry = item.sellFor.find(s => s.vendor.normalizedName === 'flea-market');
    const price = fleaEntry ? (fleaEntry.priceRUB ?? fleaEntry.price) : 0;
    return sum + price * count;
  }, 0);

  // Best sell price of reward(s) — may be trader if item is noFlea
  const rewardBestSellRub = trade.rewardItems.reduce((sum, { item, count }) => {
    const prices = item.sellFor.map(s => s.priceRUB ?? s.price).filter(p => p > 0);
    return sum + (prices.length ? Math.max(...prices) : 0) * count;
  }, 0);

  // Best TRADER sell (без флии) — для маршрута «слить торговцу», где налога нет
  const rewardTraderSellRub = trade.rewardItems.reduce((sum, { item, count }) => {
    const prices = item.sellFor
      .filter(s => s.vendor.normalizedName !== 'flea-market')
      .map(s => s.priceRUB ?? s.price)
      .filter(p => p > 0);
    return sum + (prices.length ? Math.max(...prices) : 0) * count;
  }, 0);

  // Комиссия флии за продажу награды (тотал по всем наградным предметам)
  const fleaCommission = trade.rewardItems.reduce((sum, { item, count }) => {
    const fleaEntry = item.sellFor.find(s => s.vendor.normalizedName === 'flea-market');
    const unitPrice = fleaEntry ? (fleaEntry.priceRUB ?? fleaEntry.price) : 0;
    const base = item.basePrice ?? 0;
    if (unitPrice <= 0 || base <= 0) return sum;
    return sum + calcFleaFee(base, unitPrice * count, count);
  }, 0);

  const instantProfit = rewardBestSellRub - totalComponentsCost;
  const calculatedSavings = targetItemFleaPrice - totalComponentsCost;

  // Честная прибыль «в карман»: лучшее из двух маршрутов сбыта
  const traderNet = rewardTraderSellRub - totalComponentsCost;
  const fleaNet =
    targetItemFleaPrice > 0
      ? targetItemFleaPrice - fleaCommission - totalComponentsCost
      : Number.NEGATIVE_INFINITY;
  const netProfit = Math.max(traderNet, fleaNet);

  // ROI считаем от ЧИСТОЙ прибыли (после налога флии) — согласуется с «Чистыми» и бейджем «Спекулянт».
  const roi = totalComponentsCost > 0 ? (netProfit / totalComponentsCost) * 100 : 0;

  return {
    totalComponentsCost,
    targetItemFleaPrice,
    instantProfit,
    calculatedSavings,
    isFleaArbitrageProfitable: instantProfit > 0,
    roi,
    fleaCommission,
    netProfit,
    verdict: calcVerdict(netProfit),
  };
}

// ─── «Поток сделок» (Deal Flow) ─────────────────────────────
// Быстрый режим без ручного схрона: компоненты сделки = её требования × count.
// Экономику считаем ТЕМ ЖЕ calcBarterProfit, что и ручной флоу → вердикт в игре
// побайтово совпадает с VerdictCard. Синтезируем «схрон-лайт» из требований.

/** Мини-предмет схрона из компонента бартера: только ценовые поля, что читает calcBarterProfit. */
function toStashLite(item: BarterItemBase): StashItem {
  const fleaEntry = item.sellFor.find((e) => e.vendor.normalizedName === 'flea-market');
  const fleaPrice = fleaEntry ? (fleaEntry.priceRUB ?? fleaEntry.price) : null;
  const traderPrices = item.sellFor
    .filter((e) => e.vendor.normalizedName !== 'flea-market')
    .map((e) => e.priceRUB ?? e.price)
    .filter((p): p is number => p > 0);
  const bestTraderPriceRub = traderPrices.length ? Math.max(...traderPrices) : null;
  return {
    uid: item.id,
    id: item.id,
    name: item.name,
    shortName: item.shortName,
    image512pxLink: item.image512pxLink,
    backgroundColor: item.backgroundColor,
    width: item.width,
    height: item.height,
    col: 0,
    row: 0,
    fleaPrice,
    bestTraderPriceRub,
  };
}

/** Экономика бартера без ручного схрона: компоненты = требования сделки × count. */
export function calcBarterProfitStandalone(trade: BarterTrade): BarterCalculation {
  const lite = trade.requiredItems.flatMap(({ item, count }) =>
    Array.from({ length: Math.ceil(count) }, () => toStashLite(item)),
  );
  return calcBarterProfit(trade, lite);
}

/** Годен ли бартер для «Потока»: есть цена компонентов И есть цена сбыта награды. */
export function isPlayableBarter(trade: BarterTrade): boolean {
  const c = calcBarterProfitStandalone(trade);
  const rewardValue = c.netProfit + c.totalComponentsCost; // ≈ лучшая цена сбыта награды
  return c.totalComponentsCost > 0 && rewardValue > 0;
}

export function formatRub(value: number): string {
  return `₽ ${new Intl.NumberFormat('ru-RU').format(Math.round(value))}`;
}

/** Компактный формат для больших сумм (XP/вехи): «250 МЛН», «1.5 МЛРД», иначе полный. */
export function formatCompactRub(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    return `${sign}${Number.isInteger(v) ? v : v.toFixed(1)} МЛРД`;
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${Number.isInteger(v) ? v : v.toFixed(1)} МЛН`;
  }
  return new Intl.NumberFormat('ru-RU').format(Math.round(value));
}
