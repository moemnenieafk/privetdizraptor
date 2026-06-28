// Self-mirror цен/экономики EFT из tarkov.dev в нашу Supabase.
// (см. memory autonomy-prices-research: независимый источник живых цен невозможен,
//  поэтому развязываем РАНТАЙМ — крон зеркалит, UI читает только нашу БД.)
//
// Источник (tarkov.dev) трогает ТОЛЬКО syncEftPrices() — его дёргает крон
// /api/cron/sync-prices и CLI `npm run db:sync-prices`. Рантайм-страницы зовут
// getEftPriceMapFromDb() — чистое чтение нашей таблицы `prices`.
//
// Импорты относительные (не @/), чтобы модуль грузился и под tsx-скриптом.
import { eq, sql, and, inArray } from "drizzle-orm";
import { db } from "./index";
import { prices } from "./schema";
import { eftGameId } from "./eft";
import { getEftPriceMap, type EftPriceInfo, type CtaVendorOffer } from "../lib/eft-prices";
import { memoTTL } from "../lib/server-cache";

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
    low24hPrice: p.low24hPrice ?? null,
    high24hPrice: p.high24hPrice ?? null,
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
          low24hPrice: sql`excluded.low24h_price`,
          high24hPrice: sql`excluded.high24h_price`,
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
// Строка таблицы prices → EftPriceInfo (единый маппер для всех чтений — DRY).
function mapPriceRow(r: typeof prices.$inferSelect): EftPriceInfo {
  return {
    normalizedName: r.normalizedName ?? "",
    bsgCategoryId: r.bsgCategoryId ?? undefined,
    backgroundColor: r.backgroundColor ?? undefined,
    types: r.types ?? undefined,
    lastLowPrice: r.lastLowPrice ?? undefined,
    avg24hPrice: r.avg24hPrice ?? undefined,
    changeLast48hPercent: r.changeLast48hPercent ?? undefined,
    low24hPrice: r.low24hPrice ?? undefined,
    high24hPrice: r.high24hPrice ?? undefined,
    sellFor: (r.sellFor ?? []) as CtaVendorOffer[],
    buyFor: (r.buyFor ?? []) as CtaVendorOffer[],
  };
}

// 1ч — совпадает с почасовым крон-синком цен; ≤1ч «несвежесть» приемлема.
const PRICES_TTL_MS = 60 * 60 * 1000;

export async function getEftPriceMapFromDb(): Promise<Map<string, EftPriceInfo>> {
  try {
    const rows = await memoTTL("eft-price-rows", PRICES_TTL_MS, async () => {
      const gameId = await eftGameId();
      return db.select().from(prices).where(eq(prices.gameId, gameId));
    });
    return new Map(rows.map((r) => [r.inGameId, mapPriceRow(r)]));
  } catch (e) {
    console.error("[getEftPriceMapFromDb]", e);
    return new Map();
  }
}

/** Цены по конкретным id (WHERE inGameId IN ...) — лёгкая выборка вместо всей таблицы. */
export async function getEftPricesByIds(ids: string[]): Promise<Map<string, EftPriceInfo>> {
  if (ids.length === 0) return new Map();
  try {
    const gameId = await eftGameId();
    const uniq = [...new Set(ids)];
    const rows = await db
      .select()
      .from(prices)
      .where(and(eq(prices.gameId, gameId), inArray(prices.inGameId, uniq)));
    return new Map(rows.map((r) => [r.inGameId, mapPriceRow(r)]));
  } catch (e) {
    console.error("[getEftPricesByIds]", e);
    return new Map();
  }
}

/** Цены всех предметов одной BSG-категории — для блока «похожие предметы» (выборка по категории). */
export async function getEftPricesByCategory(bsgCategoryId: string): Promise<Map<string, EftPriceInfo>> {
  try {
    const gameId = await eftGameId();
    const rows = await db
      .select()
      .from(prices)
      .where(and(eq(prices.gameId, gameId), eq(prices.bsgCategoryId, bsgCategoryId)));
    return new Map(rows.map((r) => [r.inGameId, mapPriceRow(r)]));
  } catch (e) {
    console.error("[getEftPricesByCategory]", e);
    return new Map();
  }
}

/** slug (normalizedName) → { id, цена } одним запросом — для детали (без скана всей карты). */
export async function getEftPriceBySlug(
  slug: string,
): Promise<{ id: string; price: EftPriceInfo } | null> {
  try {
    const gameId = await eftGameId();
    const [row] = await db
      .select()
      .from(prices)
      .where(and(eq(prices.gameId, gameId), eq(prices.normalizedName, slug)))
      .limit(1);
    return row ? { id: row.inGameId, price: mapPriceRow(row) } : null;
  } catch (e) {
    console.error("[getEftPriceBySlug]", e);
    return null;
  }
}

/** Лёгкий индекс (без sellFor/buyFor) по всем предметам — для корпуса поиска. ~0.5 МБ, in-memory кэш. */
export interface EftPriceIndexInfo {
  normalizedName: string;
  types?: string[];
  lastLowPrice?: number;
  backgroundColor?: string;
  bsgCategoryId?: string;
}

export async function getEftPriceIndex(): Promise<Map<string, EftPriceIndexInfo>> {
  try {
    const rows = await memoTTL("eft-price-index", PRICES_TTL_MS, async () => {
      const gameId = await eftGameId();
      return db
        .select({
          inGameId: prices.inGameId,
          normalizedName: prices.normalizedName,
          types: prices.types,
          lastLowPrice: prices.lastLowPrice,
          backgroundColor: prices.backgroundColor,
          bsgCategoryId: prices.bsgCategoryId,
        })
        .from(prices)
        .where(eq(prices.gameId, gameId));
    });
    return new Map(
      rows.map((r) => [
        r.inGameId,
        {
          normalizedName: r.normalizedName ?? "",
          types: r.types ?? undefined,
          lastLowPrice: r.lastLowPrice ?? undefined,
          backgroundColor: r.backgroundColor ?? undefined,
          bsgCategoryId: r.bsgCategoryId ?? undefined,
        },
      ]),
    );
  } catch (e) {
    console.error("[getEftPriceIndex]", e);
    return new Map();
  }
}
