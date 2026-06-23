// Self-mirror «лендинговых» справочников EFT из tarkov.dev: достижения, карты,
// торговцы (resetTime/levels). Синк зовёт крон + CLI; читалки — страницы/экшены.
// Импорты относительные (tsx-safe).
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "./index";
import { achievements, maps, traders } from "./schema";
import { eftGameId } from "./eft";

const ENDPOINT = "https://api.tarkov.dev/graphql";

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

interface RawAchievement { id: string; name?: string; description?: string; hidden?: boolean; playersCompletedPercent?: number }
interface RawMap { id: string; name?: string; normalizedName?: string }
interface RawTrader { name?: string; normalizedName: string; resetTime?: string | null; levels?: { level: number; requiredPlayerLevel: number }[] }
interface RawResponse {
  data?: { achievements?: RawAchievement[]; maps?: RawMap[]; traders?: RawTrader[] };
  errors?: unknown;
}

const QUERY = `
  query {
    achievements(lang: ru) { id name description hidden playersCompletedPercent }
    maps(lang: ru) { id name normalizedName }
    traders(lang: ru) { name normalizedName resetTime levels { level requiredPlayerLevel } }
  }
`;

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

/** Тянет achievements+maps+traders из tarkov.dev и upsert'ит в наши таблицы. */
export async function syncEftLandingData(): Promise<SyncLandingResult> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tarkov.dev landing → HTTP ${res.status}`);
  const json = (await res.json()) as RawResponse;
  if (json.errors || !json.data) throw new Error("tarkov.dev landing: ошибочный/пустой ответ");

  const gameId = await eftGameId();
  const a = (json.data.achievements ?? []).filter((x) => x.id);
  const m = (json.data.maps ?? []).filter((x) => x.id);
  const t = (json.data.traders ?? []).filter((x) => x.normalizedName);

  if (a.length) {
    await db
      .insert(achievements)
      .values(a.map((x) => ({
        id: x.id, gameId, name: x.name ?? "—", description: x.description ?? null,
        hidden: x.hidden ?? null, playersCompletedPercent: x.playersCompletedPercent ?? null,
      })))
      .onConflictDoUpdate({
        target: achievements.id,
        set: {
          name: sql`excluded.name`, description: sql`excluded.description`,
          hidden: sql`excluded.hidden`, playersCompletedPercent: sql`excluded.players_completed_percent`,
          syncedAt: sql`now()`,
        },
      });
  }
  if (m.length) {
    await db
      .insert(maps)
      .values(m.map((x) => ({ id: x.id, gameId, name: x.name ?? "—", normalizedName: x.normalizedName ?? x.id })))
      .onConflictDoUpdate({
        target: maps.id,
        set: { name: sql`excluded.name`, normalizedName: sql`excluded.normalized_name`, syncedAt: sql`now()` },
      });
  }
  if (t.length) {
    await db
      .insert(traders)
      .values(t.map((x) => ({
        normalizedName: x.normalizedName, gameId, name: x.name ?? x.normalizedName,
        resetTime: x.resetTime ?? null, levels: x.levels ?? null,
      })))
      .onConflictDoUpdate({
        target: traders.normalizedName,
        set: { name: sql`excluded.name`, resetTime: sql`excluded.reset_time`, levels: sql`excluded.levels`, syncedAt: sql`now()` },
      });
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

export interface AchievementDTO { id: string; name: string; description: string; hidden: boolean; playersCompletedPercent: number }

export async function getEftAchievements(): Promise<AchievementDTO[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(achievements).where(eq(achievements.gameId, gameId));
    return rows.map((r) => ({
      id: r.id, name: r.name, description: r.description ?? "",
      hidden: r.hidden ?? false, playersCompletedPercent: r.playersCompletedPercent ?? 0,
    }));
  } catch (e) {
    console.error("[getEftAchievements]", e);
    return [];
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

export interface TraderDTO { normalizedName: string; name: string; resetTime: string | null; levels: { level: number; requiredPlayerLevel: number }[] }

export async function getEftTraders(): Promise<TraderDTO[]> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(traders).where(eq(traders.gameId, gameId));
    return rows.map((r) => ({ normalizedName: r.normalizedName, name: r.name, resetTime: r.resetTime ?? null, levels: r.levels ?? [] }));
  } catch (e) {
    console.error("[getEftTraders]", e);
    return [];
  }
}
