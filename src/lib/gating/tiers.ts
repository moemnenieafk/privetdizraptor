/**
 * Изоморфный шов доменной логики гейтинга — ЧИСТЫЕ функции без импортов БД и React.
 * Единственное место, где живёт сравнение тиров, защита free, правила
 * удаления/архива и валидация редактирования. Server-слой (resolve.ts) и клиент
 * (провайдер гейтинга) вызывают отсюда, чтобы не дублировать лестницу рангов.
 *
 * Тест-раннера в проекте нет (§7.2) → тесты не пишем, но всю логику концентрируем здесь.
 */

/** Базовые слаги тиров, зашитые в код (сид). Рантайм-слаги открыты (string). */
export type TierId = 'free' | 'operative' | 'veteran';

const BASE_TIER_IDS: readonly TierId[] = ['free', 'operative', 'veteran'];

/** Является ли значение одним из БАЗОВЫХ слагов тиров. */
export function isTierId(v: unknown): v is TierId {
  return typeof v === 'string' && (BASE_TIER_IDS as readonly string[]).includes(v);
}

/** Структурная форма строки тира (совпадает с TierRow, но без завязки на Drizzle). */
export interface TierLike {
  slug: string;
  rank: number;
  gameId?: string | null;
  archived?: boolean;
}

/** Структурная форма записи гейта (совпадает с FeatureGateRow). */
export interface GateLike {
  minTier: string;
  enabled?: boolean;
}

/** Форма активной подписки для расчёта эффективного ранга. */
export interface SubscriptionLike {
  tier: string;
  /** null/undefined = портальная подписка (применима ко всем играм). */
  scopeGameId?: string | null;
}

/**
 * Ранг тира по слагу. Неизвестный слаг → 0 (free-эквивалент, fail-safe). Архивные
 * тиры сохраняют свой ранг: подписчик дослуживает valid_until (см. R07.1).
 */
export function tierRankOf(slug: string, tiers: readonly TierLike[]): number {
  const found = tiers.find((t) => t.slug === slug);
  return found ? found.rank : 0;
}

/**
 * Достаточен ли ранг пользователя для гейта. gateKey — ключ гейта (feature_key или
 * `sec:<game>:<path>`); его min_tier берётся из карты гейтов. Отключённый гейт
 * (enabled=false) считается открытым. Порог 'free'/ранг 0 → всегда доступно.
 */
export function meets(
  userRank: number,
  gateKey: string,
  gateMap: Readonly<Record<string, GateLike>>,
  tiers: readonly TierLike[],
): boolean {
  const gate = gateMap[gateKey];
  if (gate && gate.enabled === false) return true;
  // Нет строки в карте → gateKey трактуется как tier-slug (вызывающий подставляет
  // сюда дефолтный min_tier из GATE_REGISTRY; неизвестный slug → ранг 0, fail-safe).
  const requiredSlug = gate ? gate.minTier : gateKey;
  const requiredRank = tierRankOf(requiredSlug, tiers);
  return userRank >= requiredRank;
}

/**
 * Эффективный ранг игрока для запрошенной игры = max по всем активным подпискам,
 * применимым к игре: портальная (scopeGameId=null) применима везде, игровая — только
 * к своей. На запуске у юзера только портальная → max вырождается в неё. Пустой список
 * подписок / нет применимых → 0 (free).
 */
export function effectiveRank(
  subs: readonly SubscriptionLike[],
  game: string | null,
  tiers: readonly TierLike[],
): number {
  let best = 0;
  for (const sub of subs) {
    const scope = sub.scopeGameId ?? null;
    const applicable = scope === null || (game !== null && scope === game);
    if (!applicable) continue;
    const rank = tierRankOf(sub.tier, tiers);
    if (rank > best) best = rank;
  }
  return best;
}

/** free — защищённый тир: нельзя удалить/архивировать/сделать платным/сместить ранг. */
export function isProtectedTier(slug: string): boolean {
  return slug === 'free';
}

/**
 * Можно ли физически удалить тир. free нельзя никогда; платный — только если на него
 * нет ссылок в леджере (billing_events). Иначе архивируется, а не сносится (R07.1).
 */
export function canDeleteTier(slug: string, hasLedgerRefs: boolean): boolean {
  if (isProtectedTier(slug)) return false;
  return !hasLedgerRefs;
}

/** Патч редактирования тира из админки. */
export interface TierEditInput {
  slug: string;
  price: number;
  rank: number;
  archived: boolean;
}

export type TierEditResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Валидация редактирования тира. free защищён: rank обязан быть 0, price 0, archived
 * false. Прочие тиры: price/rank неотрицательны. Валидатор — чистая функция, вызывается
 * из /api/admin/tiers перед записью.
 */
export function validateTierEdit(input: TierEditInput): TierEditResult {
  if (isProtectedTier(input.slug)) {
    if (input.rank !== 0) return { ok: false, reason: 'free: ранг должен быть 0' };
    if (input.price !== 0) return { ok: false, reason: 'free: цена должна быть 0' };
    if (input.archived) return { ok: false, reason: 'free нельзя архивировать' };
    return { ok: true };
  }
  if (input.price < 0) return { ok: false, reason: 'Цена не может быть отрицательной' };
  if (input.rank < 0) return { ok: false, reason: 'Ранг не может быть отрицательным' };
  return { ok: true };
}
