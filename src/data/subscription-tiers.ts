// Конфиг тиров подписки + карта «фича → мин. тир».
// Модель согласована партнёрами, цены предварительные — см.
// docs/decisions/monetization-subscriptions.md. Track-1 (трекер позиции) НЕ гейтим:
// у конкурентов он бесплатный (паритет) — см. deep-research-subscription-monetization.

// Тир — открытый slug (string): динамические тиры живут в БД (таблица tiers). Базовые
// три (free/operative/veteran) остаются дефолтом/сидом и fail-safe-лестницей на случай
// пустой БД. Рантайм-ранг считается через чистые функции src/lib/gating/tiers.ts из
// снимка tiers; хелперы ниже (tierMeets/requiredTier/buildLimit) — fallback по дефолту.
export type TierId = string;

/** Базовые слаги, зашитые в код (сид + fallback-лестница). */
export type BaseTierId = 'free' | 'operative' | 'veteran';

export interface Tier {
  id: BaseTierId;
  /** Отображаемое имя. */
  name: string;
  /** ₽/мес (0 для free). Предварительно, на утв. */
  price: number;
  /** Порядок для сравнения доступа. */
  rank: number;
}

export const TIERS: Record<BaseTierId, Tier> = {
  free: { id: 'free', name: 'Боец', price: 0, rank: 0 },
  operative: { id: 'operative', name: 'Оперативник', price: 199, rank: 1 },
  veteran: { id: 'veteran', name: 'Ветеран', price: 449, rank: 2 },
};

export const TIER_ORDER: BaseTierId[] = ['free', 'operative', 'veteran'];

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

export const FEATURE_MIN_TIER: Record<GatedFeature, BaseTierId> = {
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

/**
 * Fallback-ранг слага по дефолтной лестнице TIERS. Незнакомый slug (динамический тир,
 * которого нет в базовом сиде) → 0 (free-эквивалент, fail-safe). Основной путь ранга —
 * рантайм через src/lib/gating/tiers.ts из БД-снимка; это только на случай пустой карты.
 */
export function tierRank(id: TierId): number {
  const base = TIERS[id as BaseTierId];
  return base ? base.rank : 0;
}

/** Достаточно ли тира `have` для доступа к `need` (fallback по дефолтной лестнице). */
export function tierMeets(have: TierId, need: TierId): boolean {
  return tierRank(have) >= tierRank(need);
}

/**
 * Мета дефолтного тира по слагу (для показа имени/цены в UI). Незнакомый slug
 * (динамический тир, которого нет в базовом сиде) → free (fail-safe). Безопасная
 * замена прямой индексации `TIERS[slug]` открытым TierId.
 */
export function tierMeta(slug: TierId): Tier {
  return TIERS[slug as BaseTierId] ?? TIERS.free;
}

/** Мин. тир, нужный для фичи (дефолт реестра; БД-оверрайд — через gate-карту). */
export function requiredTier(feature: GatedFeature): BaseTierId {
  return FEATURE_MIN_TIER[feature];
}

/** Является ли значение одним из БАЗОВЫХ слагов (сид). Открытые slug'и не проверяет. */
export function isTierId(v: unknown): v is BaseTierId {
  return typeof v === 'string' && v in TIERS;
}

/* ───────────────── лимиты сборок оружия ───────────────── */
/**
 * Конструктор и все статы — бесплатны (это витрина ценности). Гейтим не функцию,
 * а КОЛИЧЕСТВО и синхронизацию: free держит 3 сборки локально, платные — без лимита
 * и в облаке. Прецедент: TarkovBOT гейтит ровно число пресетов (200 у Patreon).
 * Серверная проверка дублируется в POST /api/eft/builds — клиентский лимит это UX.
 */
export const BUILD_LIMITS: Record<BaseTierId, number> = {
  free: 3,
  operative: Number.POSITIVE_INFINITY,
  veteran: Number.POSITIVE_INFINITY,
};

/**
 * Лимит сборок по слагу. Базовые тиры — из BUILD_LIMITS; любой платный тир (rank>0,
 * динамический) — без лимита; незнакомый/free-эквивалент → безопасный дефолт free (3).
 */
export function buildLimit(tier: TierId): number {
  const known = BUILD_LIMITS[tier as BaseTierId];
  if (known !== undefined) return known;
  // Динамический платный тир (rank>0) → без лимита; иначе fallback на free.
  return tierRank(tier) > 0 ? Number.POSITIVE_INFINITY : BUILD_LIMITS.free;
}