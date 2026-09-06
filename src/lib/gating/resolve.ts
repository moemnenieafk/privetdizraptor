import 'server-only';

/**
 * Серверный слой разрешения доступа: вычисляет право пользователя на гейт из БД-карты
 * (tiers + feature_gates), деградируя в дефолты GATE_REGISTRY при пустой/отсутствующей
 * БД (R09i.1 fail-safe). Снимки tiers/gate-карты кешируются с cache-тегами — карта
 * меняется редко, читается часто; админка сбрасывает теги через invalidateGating().
 *
 * Доменная лестница рангов (сравнение, эффективный ранг) — из чистого шва
 * src/lib/gating/tiers.ts; здесь только БД, кеш и деградация. JSX не рендерим —
 * requireTier возвращает РЕШЕНИЕ, а рисуют его компоненты/роут-хендлеры.
 */

import { unstable_cache, revalidateTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { getTiersFromDb, getGatesFromDb } from '@/db/billing';
import {
  allGateDefs,
  defaultGate,
  PRICING_GATE_KEY,
  type GateBehavior,
} from '@/data/gate-registry';
import { getPreviewTierSlug } from '@/lib/gating/preview';
import { TIERS, TIER_ORDER } from '@/data/subscription-tiers';
import { effectiveRank, tierRankOf, type TierLike, type GateLike } from '@/lib/gating/tiers';
import { getSubscription } from '@/lib/subscription.server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

const TAG_TIERS = 'billing-tiers';
const TAG_GATES = 'billing-gates';

/** Снимок тира для клиента/сервера (структурная форма, без Drizzle). */
export interface TierSnapshot {
  slug: string;
  name: string;
  price: number;
  rank: number;
  gameId: string | null;
  archived: boolean;
  /** Editorial-буллеты витрины (правятся в админке). Авто-состав считается отдельно. */
  perks: string[] | null;
}

/** Разрешённая запись гейта в карте: порог + поведение замка. */
export interface ResolvedGate {
  minTier: string;
  behavior: GateBehavior;
  enabled: boolean;
}

export type GateMap = Record<string, ResolvedGate>;

/** Итог разрешения для пользователя: тир, ранг, карта гейтов (снимок). */
export interface Entitlements {
  tier: string;
  rank: number;
  tiers: TierSnapshot[];
  gates: GateMap;
  /**
   * Опубликована ли витрина цен (системный переключатель sys:pricing-published).
   * Едет в снимке, потому что цену печатает и клиентский PaywallLock — иначе он остался бы
   * единственным местом, где цифра утекает при выключенной витрине.
   */
  pricingPublished: boolean;
  /** Выбранный админом тир-превью (для плашки-индикатора). null — обычный просмотр. */
  previewTier: string | null;
}

/* ───────────────── дефолт-лестница (fail-safe при пустой БД) ───────────────── */

// Дефолтные тиры из кода (сид): используются, когда таблица tiers пуста/недоступна.
const DEFAULT_TIERS: TierSnapshot[] = TIER_ORDER.map((id) => ({
  slug: TIERS[id].id,
  name: TIERS[id].name,
  price: TIERS[id].price,
  rank: TIERS[id].rank,
  gameId: null,
  archived: false,
  perks: null,
}));

/* ───────────────── кешированные снимки ───────────────── */

/**
 * Снимок тиров из БД (кеш, тег billing-tiers). Пустая/упавшая БД → дефолт-тиры из кода.
 * getTiersFromDb сам деградирует в [] — здесь подменяем пустой список на сид.
 */
export const getTiers = unstable_cache(
  async (): Promise<TierSnapshot[]> => {
    const rows = await getTiersFromDb();
    if (rows.length === 0) return DEFAULT_TIERS;
    return rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      price: r.price,
      rank: r.rank,
      gameId: r.gameId ?? null,
      archived: r.archived,
      perks: r.perks ?? null,
    }));
  },
  ['billing-tiers'],
  // revalidate — страховка: если сборка (порт 5432 закрыт → БД недоступна) закэшировала
  // дефолт-тиры, рантайм освежит их к реальным строкам БД в течение часа. Админка сбрасывает
  // тег мгновенно через invalidateGating().
  { tags: [TAG_TIERS], revalidate: 3600 },
);

/**
 * Карта гейтов: дефолты реестра (allGateDefs) мержатся со строками-оверрайдами из БД —
 * строка БД переопределяет дефолт, отсутствие строки → дефолт (fail-safe). Кеш, тег
 * billing-gates. getGatesFromDb деградирует в [] → остаются чистые дефолты.
 */
export const getGateMap = unstable_cache(
  async (): Promise<GateMap> => {
    const map: GateMap = {};
    // 1. Дефолты реестра (фичи + секции) — источник имён и fail-safe значений.
    for (const def of allGateDefs()) {
      map[def.key] = {
        minTier: def.defaultMinTier,
        behavior: def.defaultBehavior,
        // Системные переключатели приезжают выключенными (defaultEnabled), обычные гейты —
        // включёнными. Без этого витрина цен считалась бы опубликованной до строки в БД.
        enabled: def.defaultEnabled ?? true,
      };
    }
    // 2. Оверрайды из БД поверх дефолтов.
    const rows = await getGatesFromDb();
    for (const row of rows) {
      map[row.featureKey] = {
        minTier: row.minTier,
        behavior: isBehavior(row.behavior) ? row.behavior : 'lock',
        enabled: row.enabled,
      };
    }
    return map;
  },
  ['billing-gates'],
  // revalidate — страховка от дефолт-карты, закэшированной на сборке (см. getTiers).
  { tags: [TAG_GATES], revalidate: 3600 },
);

function isBehavior(v: string): v is GateBehavior {
  return v === 'lock' || v === 'hide' || v === 'teaser';
}

/* ───────────────── резолв прав пользователя ───────────────── */

// Форма подписки для effectiveRank (tier + scope). Читаем ВСЕ активные подписки юзера:
// портальная (scope null) применима везде, игровая — только к своей игре.
async function activeSubscriptions(
  userId: string | null,
): Promise<{ tier: string; scopeGameId: string | null }[]> {
  if (!userId) return [];
  // Основной тир и его валидность берём через существующий fail-safe getSubscription
  // (Supabase, own-row, истёкший→free). Дополнительные scope-подписки на запуске нет —
  // читаем прямым запросом owner-клиентом, деградируя в основной результат при ошибке.
  const primary = await getSubscription(userId);
  try {
    const rows = await db
      .select({
        tier: subscriptions.tier,
        scopeGameId: subscriptions.scopeGameId,
        validUntil: subscriptions.validUntil,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    const now = Date.now();
    const active = rows
      .filter((r) => r.validUntil === null || r.validUntil.getTime() >= now)
      .map((r) => ({ tier: r.tier, scopeGameId: r.scopeGameId ?? null }));
    if (active.length > 0) return active;
  } catch {
    // owner-клиент недоступен (напр. миграция не накатана) — падаем на primary.
  }
  return primary.tier === 'free' ? [] : [{ tier: primary.tier, scopeGameId: null }];
}

/**
 * Право пользователя для запрошенной игры: тир (эффективный, max по применимым
 * подпискам), ранг, снимки tiers + gate-карты. userId=null / нет подписки → free.
 */
export async function resolveEntitlements(
  userId: string | null,
  game: string = 'eft',
): Promise<Entitlements> {
  const [tiers, gates, subs, previewTier] = await Promise.all([
    getTiers(),
    getGateMap(),
    activeSubscriptions(userId),
    getPreviewTierSlug(),
  ]);
  const tierLikes: TierLike[] = tiers.map((t) => ({
    slug: t.slug,
    rank: t.rank,
    gameId: t.gameId,
    archived: t.archived,
  }));
  const realRank = effectiveRank(subs, game, tierLikes);
  // Слаг эффективного тира — тот из применимых подписок, чей ранг == rank; иначе free.
  const applicable = subs.filter((s) => s.scopeGameId === null || s.scopeGameId === game);
  const top = applicable.find((s) => tierRankOf(s.tier, tierLikes) === realRank && realRank > 0);
  const realTier = top?.tier ?? 'free';

  // Превью админа: ТОЛЬКО понижение (min). Выбор тира выше своего ничего не даёт — это и
  // есть защита от эскалации прав через куку, см. lib/gating/preview.ts.
  const lowered = previewTier !== null && tierRankOf(previewTier, tierLikes) < realRank;
  const rank = lowered ? tierRankOf(previewTier as string, tierLikes) : realRank;
  const tier = lowered ? (previewTier as string) : realTier;

  const pricingPublished = gates[PRICING_GATE_KEY]?.enabled ?? false;
  return { tier, rank, tiers, gates, pricingPublished, previewTier };
}

/* ───────────────── серверный энфорсмент ───────────────── */

export interface RequireTierOpts {
  userId?: string | null;
  game?: string;
}

export type RequireTierResult =
  | { ok: true }
  | { ok: false; behavior: GateBehavior; need: string };

/**
 * Решение доступа к ключу для пользователя (behavior-aware). НЕ рендерит и НЕ бросает —
 * возвращает флаг; вызывающий (RSC/роут) решает, показать PaywallLock, notFound() или
 * 403. Отключённый гейт (enabled=false) → открыт. Порог берётся из карты (fail-safe
 * defaultGate под капотом getGateMap). Если userId не передан — читаем из сессии.
 */
export async function requireTier(
  key: string,
  opts: RequireTierOpts = {},
): Promise<RequireTierResult> {
  const game = opts.game ?? gameOfKey(key) ?? 'eft';
  const userId = opts.userId !== undefined ? opts.userId : await currentUserId();
  const { rank, gates, tiers } = await resolveEntitlements(userId, game);

  const gate: GateLike & { behavior?: GateBehavior } = gates[key] ?? defaultGate(key);
  const behavior: GateBehavior = gate.behavior ?? 'lock';
  if (gate.enabled === false) return { ok: true };

  const tierLikes: TierLike[] = tiers.map((t) => ({ slug: t.slug, rank: t.rank }));
  const needRank = tierRankOf(gate.minTier, tierLikes);
  if (rank >= needRank) return { ok: true };
  return { ok: false, behavior, need: gate.minTier };
}

/**
 * Хелпер для RSC-раздела: доступ есть → true; нет и behavior='hide' → notFound() (404
 * по прямой ссылке, R05.1); lock/teaser → false (страница сама рендерит апселл/тизер).
 */
export async function gateOrNotFound(
  key: string,
  opts: RequireTierOpts = {},
): Promise<boolean> {
  const res = await requireTier(key, opts);
  if (res.ok) return true;
  if (res.behavior === 'hide') notFound();
  return false;
}

// Игра из ключа: sec:<game>:<path> → game; feature-ключ eft.* → eft; иначе null.
function gameOfKey(key: string): string | null {
  if (key.startsWith('sec:')) {
    const parts = key.split(':');
    return parts[1] ?? null;
  }
  const dot = key.indexOf('.');
  return dot > 0 ? key.slice(0, dot) : null;
}

async function currentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * RSC-хелпер: собирает снимок прав текущего юзера для передачи в <GatingProvider>
 * пропсом. Клиент дальше читает снимок из контекста — без сети на каждый <Paywall>.
 */
export async function serverEntitlementsSnapshot(game: string = 'eft'): Promise<Entitlements> {
  const userId = await currentUserId();
  return resolveEntitlements(userId, game);
}

/** Сброс кеша карты гейтов и тиров — зовётся из админки после PATCH (R03.1).
 *  Next 16: revalidateTag требует профиль вторым аргументом ('max' — полный сброс). */
export function invalidateGating(): void {
  revalidateTag(TAG_GATES, 'max');
  revalidateTag(TAG_TIERS, 'max');
}
