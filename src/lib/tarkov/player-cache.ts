// СЕРВЕРНЫЙ кэш профилей лукапа. get-or-fetch с TTL: свежая строка отдаётся из БД,
// протухшая/отсутствующая — тянется из апстрима и апсертится. Устойчив к отсутствию
// таблицы (fail-open на апстрим) — гейтинг/страница работают до применения миграции.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { eftPlayerLookupCache } from "@/db/schema";
import { fetchAccount, UpstreamError } from "@/lib/tarkov/player-source";
import type { GameMode, RawPlayerProfile } from "@/types/eft-player";

/** Профиль считается свежим 6 часов. */
const TTL_MS = 6 * 60 * 60 * 1000;

interface CacheHit {
  profile: RawPlayerProfile;
  fetchedAt: Date;
  stale: boolean;
}

async function readCache(aid: string, gameMode: GameMode): Promise<CacheHit | null> {
  try {
    const [row] = await db
      .select({ profile: eftPlayerLookupCache.profile, fetchedAt: eftPlayerLookupCache.fetchedAt })
      .from(eftPlayerLookupCache)
      .where(and(eq(eftPlayerLookupCache.aid, aid), eq(eftPlayerLookupCache.gameMode, gameMode)))
      .limit(1);
    if (!row) return null;
    const age = Date.now() - new Date(row.fetchedAt).getTime();
    return { profile: row.profile, fetchedAt: new Date(row.fetchedAt), stale: age > TTL_MS };
  } catch {
    return null; // нет таблицы/сбой БД — считаем промахом кэша
  }
}

async function writeCache(
  aid: string,
  gameMode: GameMode,
  profile: RawPlayerProfile,
): Promise<void> {
  try {
    await db
      .insert(eftPlayerLookupCache)
      .values({ aid, gameMode, nickname: profile.info?.nickname ?? null, profile })
      .onConflictDoUpdate({
        target: [eftPlayerLookupCache.aid, eftPlayerLookupCache.gameMode],
        set: {
          nickname: profile.info?.nickname ?? null,
          profile,
          fetchedAt: sql`now()`,
        },
      });
  } catch {
    // запись в кэш не критична — молча игнорируем
  }
}

/**
 * Профиль по aid: свежий кэш → апстрим (+апсерт). Если апстрим упал, но есть
 * протухший кэш — отдаём его (лучше устаревшее, чем ничего).
 */
export async function getPlayerProfile(
  aid: string,
  gameMode: GameMode,
): Promise<RawPlayerProfile> {
  const cached = await readCache(aid, gameMode);
  if (cached && !cached.stale) return cached.profile;

  try {
    const fresh = await fetchAccount(aid, gameMode);
    await writeCache(aid, gameMode, fresh);
    return fresh;
  } catch (error) {
    if (cached) return cached.profile; // апстрим лёг — спасаемся протухшим кэшем
    throw error instanceof UpstreamError ? error : new UpstreamError("Не удалось получить профиль", 502);
  }
}
