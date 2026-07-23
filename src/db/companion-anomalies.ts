// Детект аномалий companion-цен + очередь модерации ([[companion-anomaly-detection]]).
// Companion — внутренний источник: аномальное отклонение от текущей цены (демпинг/
// накрутка/грубый OCR) → сюда на ревью, не публикуем. Пороги стартовые, калибруются.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import { prices, items, companionAnomalies, companionFleaOffers } from "./schema";
import { eftGameId } from "./eft";
import { getCompanionPriceMap, type CompanionGameMode } from "./companion-prices";

/** Стартовые пороги (приоры, «на потестировать» — калибровка в P2, самообучение). */
export const ANOMALY = {
  R: 0.4, // относительный: |comp−ref|/ref > 40%
  A: 100_000, // абсолютный: |comp−ref| > 100К ₽ (крупный демпинг дорогих)
} as const;

/**
 * Прогнать детект: сравнить companion-агрегат с текущей ценой (tarkov.dev). Вне порога
 * (R ИЛИ A) → апсерт pending-аномалии; вернулось в норму → снять pending (resolved не трогаем).
 * `itemIds` — инлайн-режим (только эти предметы, после сабмита); без — полный свип (крон).
 * Возвращает число зафлагованных.
 */
export async function detectCompanionAnomalies(
  gameMode: CompanionGameMode = "regular",
  itemIds?: string[],
): Promise<number> {
  try {
    const gameId = await eftGameId();
    const compMap = await getCompanionPriceMap(gameId, gameMode);
    const ids = (itemIds ? itemIds.filter((id) => compMap.has(id)) : [...compMap.keys()]);
    if (ids.length === 0) return 0;

    const refRows = await db
      .select({ inGameId: prices.inGameId, avg: prices.avg24hPrice, low: prices.lastLowPrice })
      .from(prices)
      .where(and(eq(prices.gameId, gameId), inArray(prices.inGameId, ids)));
    const refMap = new Map(refRows.map((r) => [r.inGameId, r.avg ?? r.low ?? 0]));

    let flagged = 0;
    for (const id of ids) {
      const cp = compMap.get(id);
      const ref = refMap.get(id) ?? 0;
      if (!cp || ref <= 0) continue; // нет референса — не судим
      const devAbs = Math.abs(cp.price - ref);
      const devPct = devAbs / ref;
      if (devPct > ANOMALY.R || devAbs > ANOMALY.A) {
        await db.execute(sql`
          insert into public.companion_anomalies
            (game_id, in_game_id, companion_price, ref_price, deviation_pct, deviation_abs, offers, submitters)
          values (${gameId}, ${id}, ${cp.price}, ${ref}, ${devPct}, ${devAbs}, ${cp.offers}, ${cp.submitters})
          on conflict (game_id, in_game_id) do update set
            companion_price = excluded.companion_price, ref_price = excluded.ref_price,
            deviation_pct = excluded.deviation_pct, deviation_abs = excluded.deviation_abs,
            offers = excluded.offers, submitters = excluded.submitters, detected_at = now()
        `); // status НЕ трогаем — resolved не переоткрывается
        flagged++;
      } else {
        await db.execute(
          sql`delete from public.companion_anomalies where game_id = ${gameId} and in_game_id = ${id} and status = 'pending'`,
        );
      }
    }
    return flagged;
  } catch (e) {
    console.error("[detectCompanionAnomalies]", e);
    return 0;
  }
}

export interface AnomalyRow {
  inGameId: string;
  slug: string | null;
  name: string | null;
  companionPrice: number;
  refPrice: number;
  deviationPct: number;
  deviationAbs: number;
  offers: number;
  submitters: number;
  detectedAt: string;
}

/** Очередь на ревью (pending), свежие сверху, с именем/слагом предмета. */
export async function getPendingAnomalies(): Promise<AnomalyRow[]> {
  try {
    const gameId = await eftGameId();
    const rows = (await db.execute(sql`
      select a.in_game_id as "inGameId", p.normalized_name as "slug", i.name as "name",
        a.companion_price as "companionPrice", a.ref_price as "refPrice",
        a.deviation_pct as "deviationPct", a.deviation_abs as "deviationAbs",
        a.offers as "offers", a.submitters as "submitters", a.detected_at as "detectedAt"
      from public.companion_anomalies a
      left join public.items i on i.in_game_id = a.in_game_id and i.game_id = a.game_id
      left join public.prices p on p.in_game_id = a.in_game_id and p.game_id = a.game_id
      where a.game_id = ${gameId} and a.status = 'pending'
      order by a.deviation_abs desc
    `)) as unknown as Array<Omit<AnomalyRow, "detectedAt"> & { detectedAt: string | Date }>;
    return rows.map((r) => ({ ...r, detectedAt: new Date(r.detectedAt).toISOString() }));
  } catch (e) {
    console.error("[getPendingAnomalies]", e);
    return [];
  }
}

/** Резолв аномалии модератором. approve → источник правды; reject → отклонить; ban → бан авторов. */
export async function resolveAnomaly(
  inGameId: string,
  action: "approve" | "reject" | "ban",
  reviewerId: string,
): Promise<boolean> {
  try {
    const gameId = await eftGameId();
    const status = action === "approve" ? "approved" : "rejected";
    await db.execute(sql`
      update public.companion_anomalies
        set status = ${status}, reviewed_by = ${reviewerId}, reviewed_at = now()
      where game_id = ${gameId} and in_game_id = ${inGameId}
    `);
    if (action === "ban") {
      // Zero-tolerance: баним авторов офферов этого предмета и вычищаем их вклад целиком.
      await db.execute(sql`
        update public.profiles set banned = true where id in (
          select distinct submitted_by from public.companion_flea_offers
          where game_id = ${gameId} and in_game_id = ${inGameId}
        )
      `);
      await db.execute(sql`
        delete from public.companion_flea_offers where submitted_by in (
          select distinct submitted_by from public.companion_flea_offers
          where game_id = ${gameId} and in_game_id = ${inGameId}
        )
      `);
    }
    return true;
  } catch (e) {
    console.error("[resolveAnomaly]", e);
    return false;
  }
}

/** Забанен ли автор (для гейта сабмита компаньона). */
export async function isBanned(userId: string): Promise<boolean> {
  try {
    const rows = (await db.execute(
      sql`select banned from public.profiles where id = ${userId}`,
    )) as unknown as Array<{ banned: boolean }>;
    return rows[0]?.banned === true;
  } catch {
    return false;
  }
}
