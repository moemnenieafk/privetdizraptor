// Self-mirror «лендинговых» справочников EFT из tarkov.dev: достижения, карты,
// торговцы (resetTime/levels). Синк зовёт крон + CLI; читалки — страницы/экшены.
// Импорты относительные (tsx-safe).
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { achievements, maps, traders } from "./schema";
import { eftGameId } from "./eft";

const ENDPOINT = "https://api.tarkov.dev/graphql";

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

export interface SyncLandingResult { achievements: number; maps: number; traders: number }

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

  return { achievements: a.length, maps: m.length, traders: t.length };
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
