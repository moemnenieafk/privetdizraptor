// Стоимость арена-валют (GP-монета, Лега-медаль) в рублях.
// Чистые вычисления, без обращений к внешним API: данные подаются вызывающей стороной
// из нашего зеркала (BACKEND AUTONOMY). Вывод формул — docs/EFT_CURRENCY_MODEL.md
import type {
  AcquisitionRoute,
  ArenaOffer,
  ArenaRates,
  ArenaValuationBasis,
  ArenaVerdict,
  GpCurve,
  GpTier,
  LegaEstimate,
} from "@/types/arena-currency";

/** Сколько покупок считаем доступными, если лимит неизвестен. Консервативно — одна. */
const FALLBACK_PURCHASES = 1;

/** Ниже этого порога разница считается шумом оценки, а не выгодой. */
const NEUTRAL_BAND = 0.05;

/** Меньше этого числа точек — оценка Леги ненадёжна. */
const MIN_LEGA_POINTS = 3;

/**
 * Кривая предложения GP.
 *
 *   rate_i     = V_i / g_i        курс: рублей за монету
 *   capacity_i = g_i · L_i        монет по этому курсу за сброс
 *
 * Ступени сортируются по курсу по убыванию. Берутся только предложения,
 * оплачиваемые исключительно монетами: примесь Леги сделала бы уравнение
 * неопределённым. Дробные `gp` отбрасываются — это артефакт данных, а не цена.
 */
export function calcGpCurve(
  offers: ArenaOffer[],
  options: { basis: ArenaValuationBasis; maxLevel?: number },
): GpCurve {
  const maxLevel = options.maxLevel ?? 4;

  const tiers: GpTier[] = offers
    .filter((o) => o.gp > 0 && o.lega === 0 && o.level <= maxLevel)
    .filter((o) => Number.isInteger(o.gp))
    .filter((o) => o.rewardValue !== null && o.rewardValue > 0)
    .map((o) => {
      const value = o.rewardValue as number;
      const purchases = o.buyLimit ?? FALLBACK_PURCHASES;
      return {
        offerId: o.id,
        rewardName: o.rewardName,
        coins: o.gp,
        purchases,
        capacity: o.gp * purchases,
        value,
        rate: value / o.gp,
      };
    })
    .sort((a, b) => b.rate - a.rate);

  const capacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  const value = tiers.reduce((sum, t) => sum + t.value * t.purchases, 0);

  return {
    tiers,
    capacity,
    value,
    marginalRate: tiers.length > 0 ? tiers[0].rate : 0,
    blendedRate: capacity > 0 ? value / capacity : 0,
    basis: options.basis,
    sampleSize: tiers.length,
  };
}

function usableTiers(curve: GpCurve, excludeOfferId?: string): GpTier[] {
  return excludeOfferId ? curve.tiers.filter((t) => t.offerId !== excludeOfferId) : curve.tiers;
}

/**
 * cum(n) — сколько рублей выжимается из первых n монет при трате по лучшим курсам:
 *
 *   cum(n) = Σ_i min( max(n − Σ_{j<i} capacity_j, 0), capacity_i ) · rate_i
 *
 * Монеты сверх ёмкости кривой оцениваются по худшему доступному курсу.
 */
export function calcCumulative(curve: GpCurve, coins: number, excludeOfferId?: string): number {
  const tiers = usableTiers(curve, excludeOfferId);
  if (coins <= 0 || tiers.length === 0) return 0;

  let remaining = coins;
  let total = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, tier.capacity);
    total += take * tier.rate;
    remaining -= take;
  }
  if (remaining > 0) total += remaining * tiers[tiers.length - 1].rate;
  return total;
}

/** MV(n) — курс ступени, на которую попадает n-я монета. */
export function calcMarginalRate(curve: GpCurve, coinIndex: number, excludeOfferId?: string): number {
  const tiers = usableTiers(curve, excludeOfferId);
  if (tiers.length === 0) return 0;

  let passed = 0;
  for (const tier of tiers) {
    passed += tier.capacity;
    if (coinIndex <= passed) return tier.rate;
  }
  return tiers[tiers.length - 1].rate;
}

/** AV(n) = cum(n) / n — средний курс при объёме n. */
export function calcAverageRate(curve: GpCurve, coins: number, excludeOfferId?: string): number {
  if (coins <= 0) return 0;
  return calcCumulative(curve, coins, excludeOfferId) / coins;
}

/**
 * Альтернативная стоимость монет: сколько они принесли бы, потрать их НЕ на это
 * предложение. Сравнивать награду надо именно с ней, иначе предложение сравнивается
 * само с собой и всегда выглядит выгодным.
 */
export function calcOpportunityCost(curve: GpCurve, coins: number, offerId: string): number {
  return calcCumulative(curve, coins, offerId);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Стоимость Леги выводится вычитанием из смешанных предложений:
 *
 *   lega_i = ( V_i − cum(g_i) ) / m_i,   Лега = median_i lega_i
 *
 * Медиана, а не среднее: выборка мала, один выброс перекосит среднее.
 * Решать систему уравнений напрямую нельзя — прайс Рефа свёрстан вручную,
 * линейной зависимости между числом монет и ценой награды в нём нет.
 */
export function calcLegaValue(offers: ArenaOffer[], curve: GpCurve): LegaEstimate {
  const points = offers
    .filter((o) => o.lega > 0 && o.rewardValue !== null && o.rewardValue > 0)
    .map((o) => ({
      offerId: o.id,
      value: ((o.rewardValue as number) - calcCumulative(curve, o.gp)) / o.lega,
    }))
    .filter((p) => p.value > 0);

  const values = points.map((p) => p.value);
  return {
    value: median(values),
    low: values.length > 0 ? Math.min(...values) : 0,
    high: values.length > 0 ? Math.max(...values) : 0,
    sampleSize: values.length,
    // При двух точках медиана — просто среднее двух чисел: любое движение цены
    // тащит её на сотни тысяч. Такую оценку показывают диапазоном, не числом.
    confidence: values.length >= MIN_LEGA_POINTS ? "ok" : "low",
    points,
  };
}

/** Арена-цена предложения в рублях: альтернативная стоимость монет плюс Лега. */
export function calcArenaPriceRub(offer: ArenaOffer, rates: ArenaRates): number {
  const gpPart = offer.gp > 0 ? calcOpportunityCost(rates.gp, offer.gp, offer.id) : 0;
  return gpPart + offer.lega * rates.lega.value;
}

/**
 * Вердикт: сравнивает арена-маршрут с остальными способами получить предмет,
 * приведёнными к рублям.
 *
 *   surplus = min(цена по остальным маршрутам) − арена-цена
 */
export function calcArenaVerdict(
  offer: ArenaOffer,
  rates: ArenaRates,
  alternatives: AcquisitionRoute[],
): ArenaVerdict {
  if (rates.gp.sampleSize === 0) return { kind: "unknown", reason: "no-curve" };
  if (offer.rewardValue === null) return { kind: "unknown", reason: "no-market-price" };

  const rivals = alternatives.filter((r) => r.priceRub > 0);
  if (rivals.length === 0) return { kind: "unknown", reason: "no-routes" };

  const arena: AcquisitionRoute = {
    kind: "arena",
    gp: offer.gp,
    lega: offer.lega,
    level: offer.level,
    priceRub: calcArenaPriceRub(offer, rates),
  };

  const cheapestRival = rivals.reduce((min, r) => (r.priceRub < min.priceRub ? r : min), rivals[0]);
  const surplus = cheapestRival.priceRub - arena.priceRub;
  const best = surplus > 0 ? arena : cheapestRival;

  if (Math.abs(surplus) / cheapestRival.priceRub < NEUTRAL_BAND) {
    return { kind: "neutral", surplus, arena, best };
  }
  if (surplus > 0) {
    return { kind: "profitable", surplus, ratio: cheapestRival.priceRub / arena.priceRub, arena, best };
  }
  return { kind: "unprofitable", deficit: -surplus, arena, best };
}
