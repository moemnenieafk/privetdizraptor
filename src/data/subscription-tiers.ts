// Конфиг тиров подписки + карта «фича → мин. тир».
// Модель согласована партнёрами, цены предварительные — см.
// docs/decisions/monetization-subscriptions.md. Track-1 (трекер позиции) НЕ гейтим:
// у конкурентов он бесплатный (паритет) — см. deep-research-subscription-monetization.

export type TierId = 'free' | 'operative' | 'veteran';

export interface Tier {
  id: TierId;
  /** Отображаемое имя. */
  name: string;
  /** ₽/мес (0 для free). Предварительно, на утв. */
  price: number;
  /** Порядок для сравнения доступа. */
  rank: number;
}

export const TIERS: Record<TierId, Tier> = {
  free: { id: 'free', name: 'Боец', price: 0, rank: 0 },
  operative: { id: 'operative', name: 'Оперативник', price: 199, rank: 1 },
  veteran: { id: 'veteran', name: 'Ветеран', price: 449, rank: 2 },
};

export const TIER_ORDER: TierId[] = ['free', 'operative', 'veteran'];

/** Гейтируемые фичи (уточнённый список от Димы + T2-аналитика). */
export type GatedFeature =
  | 'favorites'
  | 'flea_price_sync'
  | 'trader_vs_flea'
  | 'weapon_builds'
  | 'ai_options'
  | 'cloud_sync'
  | 'advanced_analytics'
  | 'early_access'
  | 'role_insights'
  | 'game_changes';

export const FEATURE_MIN_TIER: Record<GatedFeature, TierId> = {
  favorites: 'operative',
  flea_price_sync: 'operative',
  trader_vs_flea: 'operative',
  weapon_builds: 'operative',
  ai_options: 'operative',
  cloud_sync: 'operative',
  advanced_analytics: 'veteran',
  early_access: 'veteran',
  role_insights: 'operative',
  game_changes: 'operative',
};

export function tierRank(id: TierId): number {
  return TIERS[id].rank;
}

/** Достаточно ли тира `have` для доступа к `need`. */
export function tierMeets(have: TierId, need: TierId): boolean {
  return tierRank(have) >= tierRank(need);
}

/** Мин. тир, нужный для фичи. */
export function requiredTier(feature: GatedFeature): TierId {
  return FEATURE_MIN_TIER[feature];
}

export function isTierId(v: unknown): v is TierId {
  return typeof v === 'string' && v in TIERS;
}

/* ───────────────── лимиты сборок оружия ───────────────── */
/**
 * Конструктор и все статы — бесплатны (это витрина ценности). Гейтим не функцию,
 * а КОЛИЧЕСТВО и синхронизацию: free держит 3 сборки локально, платные — без лимита
 * и в облаке. Прецедент: TarkovBOT гейтит ровно число пресетов (200 у Patreon).
 * Серверная проверка дублируется в POST /api/eft/builds — клиентский лимит это UX.
 */
export const BUILD_LIMITS: Record<TierId, number> = {
  free: 3,
  operative: Number.POSITIVE_INFINITY,
  veteran: Number.POSITIVE_INFINITY,
};

export function buildLimit(tier: TierId): number {
  return BUILD_LIMITS[tier];
}