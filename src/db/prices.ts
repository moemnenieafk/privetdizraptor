// Self-mirror цен/экономики EFT из tarkov.dev в нашу Supabase.
// (см. memory autonomy-prices-research: независимый источник живых цен невозможен,
//  поэтому развязываем РАНТАЙМ — крон зеркалит, UI читает только нашу БД.)
//
// Источник (tarkov.dev) трогает ТОЛЬКО syncEftPrices() — его дёргает крон
// /api/cron/sync-prices и CLI `npm run db:sync-prices`. Рантайм-страницы зовут
// getEftPriceMapFromDb() — чистое чтение нашей таблицы `prices`.
//
// Импорты относительные (не @/), чтобы модуль грузился и под tsx-скриптом.
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { prices } from "./schema";
import { eftGameId } from "./eft";
import { getEftPriceMap, type EftPriceInfo, type CtaVendorOffer } from "../lib/eft-prices";

export interface SyncResult {
  items: number;
}

/** Тянет цены из tarkov.dev и bulk-upsert'ит в таблицу `prices`. */
export async function syncEftPrices(): Promise<SyncResult> {
  const map = await getEftPriceMap();
  if (map.size === 0) {
    throw new Error("tarkov.dev отдал пустую карту цен — синк отменён (старые данные сохранены)");
  }
  const gameId = await eftGameId();

  const rows = [...map.entries()].map(([inGameId, p]) => ({
    gameId,
    inGameId,
    normalizedName: p.normalizedName || null,
    bsgCategoryId: p.bsgCategoryId ?? null,
    backgroundColor: p.backgroundColor ?? null,
    types: p.types ?? null,
    lastLowPrice: p.lastLowPrice ?? null,
    avg24hPrice: p.avg24hPrice ?? null,
    changeLast48hPercent: p.changeLast48hPercent ?? null,
    sellFor: p.sellFor,
    buyFor: p.buyFor,
  }));

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(prices)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [prices.gameId, prices.inGameId],
        set: {
          normalizedName: sql`excluded.normalized_name`,
          bsgCategoryId: sql`excluded.bsg_category_id`,
          backgroundColor: sql`excluded.background_color`,
          types: sql`excluded.types`,
          lastLowPrice: sql`excluded.last_low_price`,
          avg24hPrice: sql`excluded.avg24h_price`,
          changeLast48hPercent: sql`excluded.change_last_48h_percent`,
          sellFor: sql`excluded.sell_for`,
          buyFor: sql`excluded.buy_for`,
          syncedAt: sql`now()`,
        },
      });
  }

  return { items: rows.length };
}

/**
 * Карта inGameId → экономика/мета из НАШЕЙ таблицы `prices` (чтение, рантайм).
 * Никогда не бросает: пустая Map → список рендерится из каталога без цен.
 */
export async function getEftPriceMapFromDb(): Promise<Map<string, EftPriceInfo>> {
  try {
    const gameId = await eftGameId();
    const rows = await db.select().from(prices).where(eq(prices.gameId, gameId));
    return new Map(
      rows.map((r) => [
        r.inGameId,
        {
          normalizedName: r.normalizedName ?? "",
          bsgCategoryId: r.bsgCategoryId ?? undefined,
          backgroundColor: r.backgroundColor ?? undefined,
          types: r.types ?? undefined,
          lastLowPrice: r.lastLowPrice ?? undefined,
          avg24hPrice: r.avg24hPrice ?? undefined,
          changeLast48hPercent: r.changeLast48hPercent ?? undefined,
          sellFor: (r.sellFor ?? []) as CtaVendorOffer[],
          buyFor: (r.buyFor ?? []) as CtaVendorOffer[],
        } satisfies EftPriceInfo,
      ]),
    );
  } catch (e) {
    console.error("[getEftPriceMapFromDb]", e);
    return new Map();
  }
}
