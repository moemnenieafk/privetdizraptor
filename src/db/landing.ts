// Self-mirror «лендинговых» справочников EFT из tarkov.dev: достижения, карты,
// торговцы (resetTime/levels). Синк зовёт крон + CLI; читалки — страницы/экшены.
// Импорты относительные (tsx-safe).
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "./index";
import { achievements, maps, traders } from "./schema";
import { STATIC_ACHIEVEMENTS_EFT } from "@/data/eft/seasonal-achievements";
import { eftGameId } from "./eft";
import { fetchMirrorRows, fetchTarkovJson } from "../lib/tarkov-fallback";
import { TRADER_RU, MAP_RU } from "../lib/tarkov-labels";

// Порог защиты прюна: НЕ удаляем стейл-строки, если свежий набор из источника меньше этой
// доли уже лежащего в БД — страховка от частичного/обрезанного ответа tarkov.dev (HTTP 200,
// но усечённый список). Тот же приём, что в barters-crafts.ts.
const PRUNE_MIN_RATIO = 0.5;

/**
 * Удаляет стейл-строки таблицы (id, исчезнувшие из источника), но БЕЗОПАСНО:
 *  - пустой `keep` не трогает таблицу (notInArray([]) → SQL `true` снёс бы всё);
 *  - усечённый ответ (свежих < PRUNE_MIN_RATIO от того, что в БД) → прюн пропускаем + warn;
 *  - скоуп по gameId (мультиигровая БД); счётчик из command tag (res.count), без .returning().
 */
export async function pruneStale(
  table: PgTable,
  idCol: PgColumn,
  gameCol: PgColumn,
  gameId: string,
  keep: string[],
  label: string,
): Promise<{ deleted: number; skipped: boolean }> {
  if (keep.length === 0) return { deleted: 0, skipped: false };
  const had = await db.$count(table, eq(gameCol, gameId));
  if (keep.length < had * PRUNE_MIN_RATIO) {
    console.warn(
      `[landing] прюн ${label} пропущен: свежих ${keep.length} << в БД ${had} (похоже на частичный ответ источника)`,
    );
    return { deleted: 0, skipped: true };
  }
  const res = await db.delete(table).where(and(eq(gameCol, gameId), notInArray(idCol, keep)));
  return { deleted: res.count, skipped: false };
}

interface RawAchievement {
  id: string; name?: string; description?: string; hidden?: boolean; playersCompletedPercent?: number;
  rarity?: string | null; normalizedRarity?: string | null; side?: string | null; normalizedSide?: string | null;
  adjustedPlayersCompletedPercent?: number | null;
}
/* ─────── строки БД + источники (JSON-плоскость) ─────── */
interface MapRow { id: string; gameId: string; name: string; normalizedName: string }
interface TraderLevel { level: number; requiredPlayerLevel: number }
interface TraderRow { normalizedName: string; gameId: string; name: string; resetTime: string | null; levels: TraderLevel[] | null }

interface JsonMap { id: string; name?: string; normalizedName?: string }
interface JsonTrader { normalizedName?: string; resetTime?: string | null; levels?: { level?: number; requiredPlayerLevel?: number }[] | null }

// achievements — ТЕКСТ (имя+описание). Лежат в json.tarkov.dev/regular/tasks
// (data.achievements); имена — плейсхолдеры, реальные RU берём из /regular/tasks_ru
// по ключу-плейсхолдеру (GraphQL отставлен, §4.12).
interface JsonAchievement {
  id: string; name?: string; description?: string; hidden?: boolean; playersCompletedPercent?: number;
  rarity?: string | null; normalizedRarity?: string | null; side?: string | null; normalizedSide?: string | null;
  adjustedPlayersCompletedPercent?: number | null;
}
async function achievementsFromJson(): Promise<RawAchievement[]> {
  const [data, tr] = await Promise.all([
    fetchTarkovJson<{ achievements?: Record<string, JsonAchievement> }>("regular/tasks"),
    fetchTarkovJson<Record<string, string>>("regular/tasks_ru"),
  ]);
  return Object.values(data.achievements ?? {})
    .filter((a) => a.id)
    .map((a) => ({
      id: a.id,
      name: (a.name && tr[a.name]) || a.name,
      description: (a.description && tr[a.description]) || a.description,
      hidden: a.hidden,
      playersCompletedPercent: a.playersCompletedPercent,
      rarity: a.rarity, normalizedRarity: a.normalizedRarity,
      side: a.side, normalizedSide: a.normalizedSide,
      adjustedPlayersCompletedPercent: a.adjustedPlayersCompletedPercent,
    }));
}

// maps/traders — СТРУКТУРА (имена из наших словарей MAP_RU/TRADER_RU) → JSON-primary.
async function mapsFromJson(gameId: string): Promise<MapRow[]> {
  // У /maps коллекция вложена: data.maps (dict по id).
  const data = await fetchTarkovJson<{ maps?: Record<string, JsonMap> }>("regular/maps");
  return Object.values(data.maps ?? {})
    .filter((m) => m.id)
    .map((m) => ({ id: m.id, gameId, name: MAP_RU[m.normalizedName ?? ""] ?? m.normalizedName ?? "—", normalizedName: m.normalizedName ?? m.id }));
}

async function tradersFromJson(gameId: string): Promise<TraderRow[]> {
  const data = await fetchTarkovJson<Record<string, JsonTrader>>("regular/traders");
  return Object.values(data)
    .filter((t): t is JsonTrader & { normalizedName: string } => !!t.normalizedName)
    .map((t) => ({
      normalizedName: t.normalizedName,
      gameId,
      name: TRADER_RU[t.normalizedName] ?? t.normalizedName,
      resetTime: t.resetTime ?? null,
      levels: (t.levels ?? []).map((l) => ({ level: l.level ?? 0, requiredPlayerLevel: l.requiredPlayerLevel ?? 0 })),
    }));
}

export interface SyncLandingResult {
  achievements: number;
  maps: number;
  traders: number;
  achievementsDeleted: number;
  mapsDeleted: number;
  tradersDeleted: number;
  achievementsPruneSkipped: boolean;
  mapsPruneSkipped: boolean;
  tradersPruneSkipped: boolean;
}

// Общий SET для upsert торговцев (вкл. Фаза-2 калибровку интервала). Один источник
// правды для дневного landing-синка и частого sync-traders (Фаза 3).
const TRADERS_UPSERT_SET = {
  name: sql`excluded.name`,
  resetTime: sql`excluded.reset_time`,
  restockIntervalSec: sql`CASE
    WHEN ${traders.resetTime} IS NOT NULL AND excluded.reset_time IS NOT NULL
     AND excluded.reset_time <> ${traders.resetTime}
     AND EXTRACT(EPOCH FROM (excluded.reset_time::timestamptz - ${traders.resetTime}::timestamptz)) BETWEEN 3000 AND 18000
    THEN round(EXTRACT(EPOCH FROM (excluded.reset_time::timestamptz - ${traders.resetTime}::timestamptz)))::int
    ELSE ${traders.restockIntervalSec} END`,
  levels: sql`excluded.levels`,
  syncedAt: sql`now()`,
};

/**
 * Лёгкий синк ТОЛЬКО торговцев (Фаза 3): частый крон держит reset_time свежим,
 * чтобы виджет «Завоз» показывал точное время (экстраполяция — подстраховка),
 * и Фаза-2 калибровка ловила смену интервала быстрее. Дешёвый: один запрос + upsert.
 */
export async function syncEftTraders(): Promise<{ traders: number; tradersDeleted: number; tradersPruneSkipped: boolean }> {
  const gameId = await eftGameId();
  const t = await fetchMirrorRows<TraderRow>(() => tradersFromJson(gameId), "traders");
  if (t.length) {
    await db.insert(traders).values(t).onConflictDoUpdate({ target: traders.normalizedName, set: TRADERS_UPSERT_SET });
  }
  const tP = await pruneStale(traders, traders.normalizedName, traders.gameId, gameId, t.map((x) => x.normalizedName), "traders");
  return { traders: t.length, tradersDeleted: tP.deleted, tradersPruneSkipped: tP.skipped };
}

/** Тянет achievements+maps+traders из tarkov.dev и upsert'ит в наши таблицы. */
export async function syncEftLandingData(): Promise<SyncLandingResult> {
  const gameId = await eftGameId();

  // achievements/maps/traders — все из JSON-плоскости; источник лёг/пуст → пустой набор,
  // прюн пропускается (keep=[] или PRUNE_MIN_RATIO), last-known-good в БД сохраняется.
  const a = await fetchMirrorRows<RawAchievement>(() => achievementsFromJson(), "achievements");
  const m = await fetchMirrorRows<MapRow>(() => mapsFromJson(gameId), "maps");
  const t = await fetchMirrorRows<TraderRow>(() => tradersFromJson(gameId), "traders");

  if (a.length) {
    await db
      .insert(achievements)
      .values(a.map((x) => ({
        id: x.id, gameId, name: x.name ?? "—", description: x.description ?? null,
        hidden: x.hidden ?? null, playersCompletedPercent: x.playersCompletedPercent ?? null,
        rarity: x.rarity ?? null, normalizedRarity: x.normalizedRarity ?? null,
        side: x.side ?? null, normalizedSide: x.normalizedSide ?? null,
        adjustedPlayersCompletedPercent: x.adjustedPlayersCompletedPercent ?? null,
      })))
      .onConflictDoUpdate({
        target: achievements.id,
        set: {
          name: sql`excluded.name`, description: sql`excluded.description`,
          hidden: sql`excluded.hidden`, playersCompletedPercent: sql`excluded.players_completed_percent`,
          rarity: sql`excluded.rarity`, normalizedRarity: sql`excluded.normalized_rarity`,
          side: sql`excluded.side`, normalizedSide: sql`excluded.normalized_side`,
          adjustedPlayersCompletedPercent: sql`excluded.adjusted_players_completed_percent`,
          syncedAt: sql`now()`,
        },
      });
  }
  if (m.length) {
    await db
      .insert(maps)
      .values(m)
      .onConflictDoUpdate({
        target: maps.id,
        set: { name: sql`excluded.name`, normalizedName: sql`excluded.normalized_name`, syncedAt: sql`now()` },
      });
  }
  if (t.length) {
    await db
      .insert(traders)
      .values(t)
      .onConflictDoUpdate({ target: traders.normalizedName, set: TRADERS_UPSERT_SET });
  }

  // Чистим стейл-строки (achievements/maps/traders, исчезнувшие из источника при вайпе).
  const aP = await pruneStale(achievements, achievements.id, achievements.gameId, gameId, a.map((x) => x.id), "achievements");
  const mP = await pruneStale(maps, maps.id, maps.gameId, gameId, m.map((x) => x.id), "maps");
  const tP = await pruneStale(traders, traders.normalizedName, traders.gameId, gameId, t.map((x) => x.normalizedName), "traders");

  return {
    achievements: a.length,
    maps: m.length,
    traders: t.length,
    achievementsDeleted: aP.deleted,
    mapsDeleted: mP.deleted,
    tradersDeleted: tP.deleted,
    achievementsPruneSkipped: aP.skipped,
    mapsPruneSkipped: mP.skipped,
    tradersPruneSkipped: tP.skipped,
  };
}

/* ───────────────── читалки (рантайм, чистое чтение нашей БД) ───────────────── */

export interface AchievementDTO {
  id: string; name: string; description: string; hidden: boolean; playersCompletedPercent: number;
  rarity: string; normalizedRarity: string; side: string; normalizedSide: string;
  adjustedPlayersCompletedPercent: number;
}

function toAchievementDTO(r: typeof achievements.$inferSelect): AchievementDTO {
  return {
    id: r.id, name: r.name, description: r.description ?? "",
    hidden: r.hidden ?? false, playersCompletedPercent: r.playersCompletedPercent ?? 0,
    rarity: r.rarity ?? "", normalizedRarity: r.normalizedRarity ?? "",
    side: r.side ?? "", normalizedSide: r.normalizedSide ?? "",
    adjustedPlayersCompletedPercent: r.adjustedPlayersCompletedPercent ?? 0,
  };
}

export async function getEftAchievements(): Promise<AchievementDTO[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(achievements).where(eq(achievements.gameId, gameId));
    // + статические (сезонные + легендарные вне зеркала; крон их не стирает — см. data/eft/seasonal-achievements.ts).
    // Дедуп по id: если зеркало догонит real-id (напр. «Рассвет» 6a60f6f7) — зеркало главнее, статику отбрасываем.
    const mirroredIds = new Set(rows.map((r) => r.id));
    const staticOnly = STATIC_ACHIEVEMENTS_EFT.filter((a) => !mirroredIds.has(a.id));
    return [...rows.map(toAchievementDTO), ...staticOnly];
  } catch (e) {
    console.error("[getEftAchievements]", e);
    return [...STATIC_ACHIEVEMENTS_EFT]; // статика — data-at-rest, доступна даже если зеркало легло
  }
}

/** Одно достижение по id (для детальной страницы). null — если не найдено. */
export async function getEftAchievement(id: string): Promise<AchievementDTO | null> {
  const staticMatch = STATIC_ACHIEVEMENTS_EFT.find((a) => a.id === id);
  try {
    const gameId = await eftGameId();
    const [row] = await db
      .select()
      .from(achievements)
      .where(and(eq(achievements.gameId, gameId), eq(achievements.id, id)))
      .limit(1);
    if (row) return toAchievementDTO(row); // зеркало главнее (real-id, если догнало)
    return staticMatch ?? null; // иначе статика (синтетические kbreach-* и не-догнанные)
  } catch (e) {
    console.error("[getEftAchievement]", e);
    return staticMatch ?? null; // резильентно: статика — data-at-rest, доступна даже если БД легла
  }
}

export interface MapDTO { id: string; name: string; normalizedName: string; wiki: string | null }

export async function getEftMaps(): Promise<MapDTO[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(maps).where(eq(maps.gameId, gameId));
    return rows.map((r) => ({ id: r.id, name: r.name, normalizedName: r.normalizedName, wiki: null }));
  } catch (e) {
    console.error("[getEftMaps]", e);
    return [];
  }
}

export interface TraderDTO { normalizedName: string; name: string; resetTime: string | null; restockIntervalSec: number | null; levels: { level: number; requiredPlayerLevel: number }[] }

export async function getEftTraders(): Promise<TraderDTO[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(traders).where(eq(traders.gameId, gameId));
    return rows.map((r) => ({ normalizedName: r.normalizedName, name: r.name, resetTime: r.resetTime ?? null, restockIntervalSec: r.restockIntervalSec ?? null, levels: r.levels ?? [] }));
  } catch (e) {
    console.error("[getEftTraders]", e);
    return [];
  }
}
