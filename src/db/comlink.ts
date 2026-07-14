// Читалки и мутации раздела «Связь». Только для сервера (Drizzle owner-ролью,
// мимо RLS — безопасность держит сессия в API-роутах, паттерн проекта).
//
// Карма считается СУММОЙ журнала karma_events на лету: пользователей в соц-разделе
// сотни, суммы Postgres агрегирует за миллисекунды, зато число всегда честное и
// отзыв жалобы = DELETE события без пересчётов.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, playerProfiles } from "@/db/schema";
import {
  comlinkProfiles,
  comlinkRaids,
  karmaEvents,
  karmaTier,
  type ComlinkGoal,
  type ComlinkProfileRow,
  type KarmaReason,
  type PlayStyle,
  type PlayTime,
} from "@/db/schema-comlink";
import { eftGameId } from "@/db/eft";

/* ─────────────────── карма ─────────────────── */

export interface KarmaInfo {
  total: number;
  tierId: string;
  tierLabel: string;
}

/** Карма пачки пользователей одним запросом (для списков). */
export async function getKarmaMap(userIds: string[]): Promise<Map<string, KarmaInfo>> {
  const out = new Map<string, KarmaInfo>();
  if (userIds.length === 0) return out;

  const rows = await db
    .select({
      userId: karmaEvents.userId,
      total: sql<number>`coalesce(sum(${karmaEvents.delta}), 0)::int`,
    })
    .from(karmaEvents)
    .where(inArray(karmaEvents.userId, userIds))
    .groupBy(karmaEvents.userId);

  const byId = new Map(rows.map((r) => [r.userId, r.total]));

  for (const id of userIds) {
    const total = byId.get(id) ?? 0;
    const tier = karmaTier(total);
    out.set(id, { total, tierId: tier.id, tierLabel: tier.label });
  }
  return out;
}

/**
 * Начисление кармы. Идемпотентно: уникальный индекс (user, reason, refType, refId)
 * гасит повторное начисление за тот же источник — конфликт молча игнорируем.
 */
export async function grantKarma(
  userId: string,
  reason: KarmaReason,
  delta: number,
  refType: string,
  refId: string,
  issuedBy: string | null = null,
): Promise<void> {
  await db
    .insert(karmaEvents)
    .values({ userId, reason, delta, refType, refId, issuedBy })
    .onConflictDoNothing();
}

/* ─────────────────── анкеты ─────────────────── */

/** Строка списка кандидатов: анкета + автор + карма + Discord (только авторизованным). */
export interface CandidateListItem {
  userId: string;
  username: string;
  avatarUrl: string | null;
  discord: string | null;
  goal: ComlinkGoal;
  maps: string[];
  playTime: string[];
  playStyle: string[];
  voice: boolean;
  tzOffset: number | null;
  about: string;
  /** Снимок игрового профиля (ник/уровень/фракция) на момент публикации анкеты. */
  game: { nickname: string; level: string; faction: string; mode: string } | null;
  karma: KarmaInfo;
  /** Подтверждённых рейдов через ЦТА. */
  confirmedRaids: number;
  updatedAt: string;
}

export interface CandidateFilters {
  goal?: ComlinkGoal;
  map?: string;
  voice?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Список активных анкет с фильтрами. Сортировка: карма ↓, свежесть ↓ —
 * доверенные выше (стимул набивать карму), новички не тонут навсегда.
 */
export async function getCandidates(
  filters: CandidateFilters = {},
): Promise<{ items: CandidateListItem[]; total: number }> {
  const gameId = await eftGameId();
  const limit = Math.min(filters.limit ?? 20, 50);
  const offset = Math.max(filters.offset ?? 0, 0);

  const conds = [eq(comlinkProfiles.gameId, gameId), eq(comlinkProfiles.active, true)];
  if (filters.goal) conds.push(eq(comlinkProfiles.goal, filters.goal));
  if (filters.voice !== undefined) conds.push(eq(comlinkProfiles.voice, filters.voice));
  // Карта — JSONB containment: пустой maps в анкете значит «любые карты», такие тоже попадают.
  if (filters.map) {
    conds.push(
      sql`(${comlinkProfiles.maps} @> ${JSON.stringify([filters.map])}::jsonb
           or ${comlinkProfiles.maps} = '[]'::jsonb)`,
    );
  }

  const where = and(...conds);

  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        p: comlinkProfiles,
        username: profiles.username,
        avatarUrl: profiles.avatarUrl,
        discord: profiles.discord,
      })
      .from(comlinkProfiles)
      .innerJoin(profiles, eq(profiles.id, comlinkProfiles.userId))
      .where(where)
      .orderBy(desc(comlinkProfiles.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(comlinkProfiles)
      .where(where),
  ]);

  const userIds = rows.map((r) => r.p.userId);
  const [karmaMap, raidCounts] = await Promise.all([
    getKarmaMap(userIds),
    getConfirmedRaidCounts(userIds),
  ]);

  const items: CandidateListItem[] = rows.map((r) => ({
    userId: r.p.userId,
    username: r.username ?? "Боец",
    avatarUrl: r.avatarUrl,
    discord: r.discord,
    goal: r.p.goal,
    maps: r.p.maps,
    playTime: r.p.playTime,
    playStyle: r.p.playStyle,
    voice: r.p.voice,
    tzOffset: r.p.tzOffset,
    about: r.p.about,
    game: r.p.gameSnapshot,
    karma: karmaMap.get(r.p.userId) ?? { total: 0, tierId: "wild", tierLabel: "Дикий" },
    confirmedRaids: raidCounts.get(r.p.userId) ?? 0,
    updatedAt: r.p.updatedAt.toISOString(),
  }));

  // Карма ↓, потом свежесть (в SQL пришлось бы джойнить агрегат — на 20 строках проще тут).
  items.sort((a, b) => b.karma.total - a.karma.total || (a.updatedAt < b.updatedAt ? 1 : -1));

  return { items, total: count };
}

async function getConfirmedRaidCounts(userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;

  const rows = await db
    .select({
      initiatorId: comlinkRaids.initiatorId,
      partnerId: comlinkRaids.partnerId,
    })
    .from(comlinkRaids)
    .where(
      and(
        eq(comlinkRaids.status, "confirmed"),
        sql`(${comlinkRaids.initiatorId} in ${userIds} or ${comlinkRaids.partnerId} in ${userIds})`,
      ),
    );

  for (const r of rows) {
    out.set(r.initiatorId, (out.get(r.initiatorId) ?? 0) + 1);
    out.set(r.partnerId, (out.get(r.partnerId) ?? 0) + 1);
  }
  return out;
}

/** Анкета текущего пользователя (для формы «моя анкета»). */
export async function getOwnComlinkProfile(userId: string): Promise<ComlinkProfileRow | null> {
  const gameId = await eftGameId();
  const [row] = await db
    .select()
    .from(comlinkProfiles)
    .where(and(eq(comlinkProfiles.userId, userId), eq(comlinkProfiles.gameId, gameId)))
    .limit(1);
  return row ?? null;
}

export interface UpsertProfileInput {
  goal: ComlinkGoal;
  maps: string[];
  playTime: PlayTime[];
  playStyle: PlayStyle[];
  voice: boolean;
  tzOffset: number | null;
  about: string;
  active: boolean;
}

/**
 * Создание/правка анкеты. Снимок игрового профиля подтягиваем из player_profiles
 * (активный профиль) — наш козырь против Discord-LFG: уровень не со слов.
 */
export async function upsertComlinkProfile(
  userId: string,
  input: UpsertProfileInput,
): Promise<void> {
  const gameId = await eftGameId();

  const [pp] = await db
    .select({ profiles: playerProfiles.profiles, activeId: playerProfiles.activeProfileId })
    .from(playerProfiles)
    .where(and(eq(playerProfiles.userId, userId), eq(playerProfiles.gameId, gameId)))
    .limit(1);

  const active = pp?.profiles.find((x) => x.id === pp.activeId) ?? pp?.profiles[0];
  const snapshot = active
    ? {
        nickname: active.nickname,
        level: active.level,
        faction: active.faction,
        mode: active.mode,
      }
    : null;

  await db
    .insert(comlinkProfiles)
    .values({ userId, gameId, ...input, gameSnapshot: snapshot })
    .onConflictDoUpdate({
      target: [comlinkProfiles.userId, comlinkProfiles.gameId],
      set: { ...input, gameSnapshot: snapshot, updatedAt: sql`now()` },
    });
}
