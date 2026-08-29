// Примитивы чтения/записи биллинга: tiers, feature_gates, billing_events, subscriptions.
// Прячет SQL, onConflict, chunking. Владелец — owner-клиент (Drizzle, в обход RLS).
// Читалки ДЕГРАДИРУЮТ в пусто (нет таблиц/строк → fail-safe), чтобы гейтинг падал на
// дефолты GATE_REGISTRY, а не ронял страницу. Доменные правила (защита free, удаление
// только без леджера) — из src/lib/gating/tiers.ts, здесь не дублируются.
//
// Импорты относительные (не @/) — модуль читается и из RSC, и под tsx-скриптом (как prices.ts).
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  tiers,
  featureGates,
  billingEvents,
  subscriptions,
  type TierRow,
  type FeatureGateRow,
  type NewBillingEventRow,
} from "./schema";
import { canDeleteTier, isProtectedTier } from "../lib/gating/tiers";

export type { TierRow, FeatureGateRow };

/* ───────────────── чтение (fail-safe: ошибка → пусто) ───────────────── */

// Сборка не ходит в БД (порт 5432 закрыт наружу, §4.11). Гейтинг — штатный fail-safe:
// пустой результат → дефолты GATE_REGISTRY. На сборке деградируем МОЛЧА (без guard-логов);
// рантайм читает реальные данные. getTiers/getGateMap (resolve.ts) держат revalidate,
// поэтому дефолт со сборки в рантайме освежается к реальным строкам БД.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

/** Все тиры (включая архивные — витрина/лестница решает сама). Ошибка → []. */
export async function getTiersFromDb(): Promise<TierRow[]> {
  if (IS_BUILD) return [];
  try {
    return await db.select().from(tiers);
  } catch (e) {
    console.error("[billing/getTiersFromDb]", e);
    return [];
  }
}

/** Все строки-оверрайды гейтов. Ошибка → [] (дефолты берутся из GATE_REGISTRY). */
export async function getGatesFromDb(): Promise<FeatureGateRow[]> {
  if (IS_BUILD) return [];
  try {
    return await db.select().from(featureGates);
  } catch (e) {
    console.error("[billing/getGatesFromDb]", e);
    return [];
  }
}

/* ───────────────── запись тиров (owner-роль) ───────────────── */

export interface UpsertTierInput {
  slug: string;
  name: string;
  price: number;
  rank: number;
  gameId?: string | null;
  archived?: boolean;
  perks?: string[] | null;
}

/** Upsert тира по slug. Возвращает записанную строку. */
export async function upsertTier(input: UpsertTierInput): Promise<TierRow> {
  const values = {
    slug: input.slug,
    name: input.name,
    price: input.price,
    rank: input.rank,
    gameId: input.gameId ?? null,
    archived: input.archived ?? false,
    perks: input.perks ?? null,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(tiers)
    .values(values)
    .onConflictDoUpdate({
      target: tiers.slug,
      set: {
        name: values.name,
        price: values.price,
        rank: values.rank,
        gameId: values.gameId,
        archived: values.archived,
        perks: values.perks,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  return row;
}

/** Архивировать тир (подписчики дослуживают valid_until, потом падают на free). */
export async function archiveTier(slug: string): Promise<void> {
  await db
    .update(tiers)
    .set({ archived: true, updatedAt: new Date() })
    .where(eq(tiers.slug, slug));
}

export type DeleteTierResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Физически удалить тир. free нельзя; платный — только если на него нет ссылок в
 * леджере (billing_events). Иначе отказ — вызывающий должен архивировать. Правило
 * решается чистой canDeleteTier (src/lib/gating/tiers.ts).
 */
export async function deleteTier(slug: string): Promise<DeleteTierResult> {
  if (isProtectedTier(slug)) {
    return { ok: false, reason: "free защищён от удаления" };
  }
  try {
    const refs = await db
      .select({ id: billingEvents.id })
      .from(billingEvents)
      .where(eq(billingEvents.tier, slug))
      .limit(1);
    const hasLedgerRefs = refs.length > 0;
    if (!canDeleteTier(slug, hasLedgerRefs)) {
      return { ok: false, reason: "На тир есть записи в леджере — архивируйте, а не удаляйте" };
    }
    await db.delete(tiers).where(eq(tiers.slug, slug));
    return { ok: true };
  } catch (e) {
    console.error("[billing/deleteTier]", e);
    return { ok: false, reason: "Ошибка удаления" };
  }
}

/* ───────────────── запись гейтов (owner-роль) ───────────────── */

export interface UpsertGateInput {
  feature_key: string;
  min_tier: string;
  behavior: string;
  enabled: boolean;
  updated_by?: string | null;
}

/** Upsert оверрайда гейта по feature_key. */
export async function upsertGate(input: UpsertGateInput): Promise<FeatureGateRow> {
  const values = {
    featureKey: input.feature_key,
    minTier: input.min_tier,
    behavior: input.behavior,
    enabled: input.enabled,
    updatedBy: input.updated_by ?? null,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(featureGates)
    .values(values)
    .onConflictDoUpdate({
      target: featureGates.featureKey,
      set: {
        minTier: values.minTier,
        behavior: values.behavior,
        enabled: values.enabled,
        updatedBy: values.updatedBy,
        updatedAt: values.updatedAt,
      },
    })
    .returning();
  return row;
}

/* ───────────────── леджер + выдача тира ───────────────── */

export type BillingEventType = "grant" | "payment" | "refund" | "renewal" | "downgrade";

export interface WriteBillingEventInput {
  userId: string;
  type: BillingEventType;
  provider?: string;
  externalId?: string | null;
  tier?: string | null;
  amount?: number | null;
  currency?: string;
  status?: string | null;
  raw?: Record<string, unknown> | null;
}

/**
 * Пишет запись в леджер. Идемпотентно по (provider, external_id), когда external_id
 * задан: повторный вебхук с тем же external_id ничего не задваивает (do nothing).
 * Ручные выдачи (external_id = null) не конфликтуют. Ошибка не роняет вызывающего.
 */
export async function writeBillingEvent(input: WriteBillingEventInput): Promise<void> {
  const row: NewBillingEventRow = {
    userId: input.userId,
    type: input.type,
    provider: input.provider ?? "manual",
    externalId: input.externalId ?? null,
    tier: input.tier ?? null,
    amount: input.amount != null ? String(input.amount) : null,
    currency: input.currency ?? "RUB",
    status: input.status ?? null,
    raw: input.raw ?? null,
  };
  try {
    if (row.externalId != null) {
      await db
        .insert(billingEvents)
        .values(row)
        .onConflictDoNothing({
          target: [billingEvents.provider, billingEvents.externalId],
        });
    } else {
      await db.insert(billingEvents).values(row);
    }
  } catch (e) {
    console.error("[billing/writeBillingEvent]", e);
  }
}

export interface SetUserTierInput {
  userId: string;
  tier: string;
  /** Месяцев подписки; >0 → valid_until = now()+interval, 0 → null (бессрочно). */
  months: number;
  source?: string;
  provider?: string;
  type?: BillingEventType;
  /**
   * true → продление: срок наращивается от МАХ(текущий valid_until, now())+months, а не
   * перезаписывается. Дефолт false = старое поведение (замена срока). При months=0 режим
   * не имеет смысла — трактуется как бессрочно (null), как и при grant.
   */
  extend?: boolean;
}

/**
 * Выдать/сменить тир пользователю: upsert subscriptions + запись в леджер. Валидность
 * как в текущем set-tier: months>0 → now()+interval, 0 → null. При extend=true срок
 * продлевается от текущего (greatest(coalesce(valid_until, now()), now())+months), а не
 * заменяется — на INSERT продлять не от чего, поэтому база = now(). Пишет billing_events
 * (по умолчанию type='grant').
 */
export async function setUserTier(input: SetUserTierInput): Promise<void> {
  const source = input.source ?? "manual";
  // Срок для первичной вставки: продлять не от чего (строки ещё нет) → от now().
  const insertValidUntil =
    input.months > 0
      ? sql`now() + make_interval(months => ${input.months})`
      : sql`null`;
  // Срок при конфликте: extend → наращиваем от max(текущий, now()); иначе замена.
  const updateValidUntil =
    input.months > 0
      ? input.extend
        ? sql`greatest(coalesce(${subscriptions.validUntil}, now()), now()) + make_interval(months => ${input.months})`
        : sql`now() + make_interval(months => ${input.months})`
      : sql`null`;

  await db
    .insert(subscriptions)
    .values({
      userId: input.userId,
      tier: input.tier,
      source,
      validUntil: insertValidUntil,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        tier: input.tier,
        source,
        validUntil: updateValidUntil,
        updatedAt: new Date(),
      },
    });

  await writeBillingEvent({
    userId: input.userId,
    type: input.type ?? (input.extend ? "renewal" : "grant"),
    tier: input.tier,
    provider: input.provider ?? "manual",
  });
}

/** Есть ли у тира ссылки в леджере (для UI-подсказки «архив, не снос»). */
export async function tierHasLedgerRefs(slug: string): Promise<boolean> {
  try {
    const refs = await db
      .select({ id: billingEvents.id })
      .from(billingEvents)
      .where(and(eq(billingEvents.tier, slug)))
      .limit(1);
    return refs.length > 0;
  } catch (e) {
    console.error("[billing/tierHasLedgerRefs]", e);
    return false;
  }
}
