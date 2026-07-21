// Типы модели стоимости арена-валют (GP-монета, Лега-медаль).
// GP и Лега не покупаются за рубли/евро/доллары, поэтому рыночной цены у них нет —
// есть только курс обмена, который задаёт ассортимент Рефа. Отсюда главное следствие:
// курс монеты не константа, а функция объёма.
// Вывод формул: docs/EFT_CURRENCY_MODEL.md

/** Как оценивается награда: «сколько сэкономлю» против «сколько выручу». */
export type ArenaValuationBasis = "acquire" | "liquidate";

/**
 * Откуда берётся цена награды.
 * spot  — текущая котировка барахолки; скачет в разы за сутки.
 * month — медиана суточных снимков за 30 дней; устойчива, по умолчанию для валют.
 */
export type ArenaPriceSource = "spot" | "month";

/** Нормализованное предложение Рефа: плата в арена-валюте, награда — предмет. */
export interface ArenaOffer {
  id: string;
  rewardId: string;
  rewardName: string;
  rewardCount: number;
  /** Монет GP за одну покупку. */
  gp: number;
  /** Лега-медалей за одну покупку. */
  lega: number;
  /** Минимальный уровень лояльности Рефа. */
  level: number;
  /** Покупок за один сброс торговца; null — лимит неизвестен. */
  buyLimit: number | null;
  /** Рыночная стоимость всей награды в рублях; null — предмет вне барахолки. */
  rewardValue: number | null;
}

/** Ступень кривой предложения: пачка монет, доступная по одному курсу. */
export interface GpTier {
  offerId: string;
  rewardName: string;
  /** Монет за одну покупку. */
  coins: number;
  /** Покупок за сброс. */
  purchases: number;
  /** Монет, которые можно израсходовать по этому курсу за сброс. */
  capacity: number;
  /** Рублей за одну покупку. */
  value: number;
  /** Рублей за монету на этой ступени. */
  rate: number;
}

export interface GpCurve {
  /** Ступени, отсортированные по курсу от лучшего к худшему. */
  tiers: GpTier[];
  /** Сколько монет всего можно израсходовать за сброс. */
  capacity: number;
  /** Рублей за всю ёмкость кривой. */
  value: number;
  /** Курс лучшей ступени — предельная стоимость первой монеты. */
  marginalRate: number;
  /** Средний курс при расходе всей ёмкости. */
  blendedRate: number;
  basis: ArenaValuationBasis;
  priceSource: ArenaPriceSource;
  /** Сколько предложений попало в расчёт. */
  sampleSize: number;
}

export interface LegaEstimate {
  value: number;
  low: number;
  high: number;
  sampleSize: number;
  /** low — точек меньше трёх, показывать диапазоном, а не числом. */
  confidence: "low" | "ok";
  points: { offerId: string; value: number }[];
}

/** Самодиагностика расчёта — чтобы тихая деградация была видна снаружи. */
export interface ArenaHealth {
  /** empty — кривая пуста; degraded — считается, но данные неполные. */
  status: "ok" | "degraded" | "empty";
  /** Причины деградации, человекочитаемо. */
  reasons: string[];
  /** Всего арена-предложений Рефа в зеркале. */
  offersTotal: number;
  /** Из них с известным buy_limit — если 0, синк колонку не заполнил. */
  limitsKnown: number;
  /** Наград, оценённых по истории; остальные откатились на спот. */
  pricedFromHistory: number;
  /** Возраст зеркала цен в часах. null — определить не удалось. */
  pricesAgeHours: number | null;
}

export interface ArenaRates {
  gp: GpCurve;
  lega: LegaEstimate;
  health: ArenaHealth;
  computedAt: string;
}

/** Способ получить предмет, приведённый к рублям. */
export type AcquisitionRoute =
  | { kind: "fiat"; currency: "RUB" | "USD" | "EUR"; trader: string; level: number; priceRub: number }
  | { kind: "flea"; priceRub: number }
  | { kind: "arena"; gp: number; lega: number; level: number; priceRub: number };

/** Вердикт по арена-предложению. Расширяет BarterVerdict числами для UI. */
export type ArenaVerdict =
  | { kind: "profitable"; surplus: number; ratio: number; arena: AcquisitionRoute; best: AcquisitionRoute }
  | { kind: "neutral"; surplus: number; arena: AcquisitionRoute; best: AcquisitionRoute }
  | { kind: "unprofitable"; deficit: number; arena: AcquisitionRoute; best: AcquisitionRoute }
  | { kind: "unknown"; reason: "no-market-price" | "no-curve" | "no-routes" };
