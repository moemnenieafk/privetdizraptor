// Self-mirror цен/экономики EFT из tarkov.dev в нашу Supabase.
// (см. memory autonomy-prices-research: независимый источник живых цен невозможен,
//  поэтому развязываем РАНТАЙМ — крон зеркалит, UI читает только нашу БД.)
//
// Источник (tarkov.dev) трогает ТОЛЬКО syncEftPrices() — его дёргает крон
// /api/cron/sync-prices и CLI `npm run db:sync-prices`. Рантайм-страницы зовут
// getEftPriceMapFromDb() — чистое чтение нашей таблицы `prices`.
//
// Импорты относительные (не @/), чтобы модуль грузился и под tsx-скриптом.
import { eq, sql, and, inArray, type SQL } from "drizzle-orm";
import { db } from "./index";
import { prices, type PriceVendorOffer } from "./schema";
import { eftGameId } from "./eft";
import { getEftPriceMap, getLastPriceFetchError, type EftPriceInfo, type CtaVendorOffer } from "../lib/eft-prices";
import { memoTTL } from "../lib/server-cache";

export interface SyncResult {
  items: number;
}

/** Тянет цены из tarkov.dev и bulk-upsert'ит в таблицу `prices`. */
export async function syncEftPrices(): Promise<SyncResult> {
  const map = await getEftPriceMap();
  if (map.size === 0) {
    const reason = getLastPriceFetchError();
    throw new Error(
      `tarkov.dev отдал пустую карту цен — синк отменён (старые данные сохранены)${reason ? `. Причина: ${reason}` : ""}`,
    );
  }
  const gameId = await eftGameId();

  // PvE — отдельная экономика (gameMode: pve). Best-effort: пустая карта → PvE-поля не трогаем.
  const pveMap = await getEftPriceMap('pve');
  const hasPve = pveMap.size > 0;

  const rows = [...map.entries()].map(([inGameId, p]) => ({
    gameId,
    inGameId,
    normalizedName: p.normalizedName || null,
    bsgCategoryId: p.bsgCategoryId ?? null,
    minLevelForFlea: p.minLevelForFlea ?? null,
    backgroundColor: p.backgroundColor ?? null,
    types: p.types ?? null,
    lastLowPrice: p.lastLowPrice ?? null,
    avg24hPrice: p.avg24hPrice ?? null,
    changeLast48hPercent: p.changeLast48hPercent ?? null,
    low24hPrice: p.low24hPrice ?? null,
    high24hPrice: p.high24hPrice ?? null,
    sellFor: p.sellFor,
    buyFor: p.buyFor,
    ...(hasPve
      ? {
          avg24hPricePve: pveMap.get(inGameId)?.avg24hPrice ?? null,
          low24hPricePve: pveMap.get(inGameId)?.low24hPrice ?? null,
          sellForPve: pveMap.get(inGameId)?.sellFor ?? null,
          buyForPve: pveMap.get(inGameId)?.buyFor ?? null,
        }
      : {}),
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
          minLevelForFlea: sql`excluded.min_level_for_flea`,
          backgroundColor: sql`excluded.background_color`,
          types: sql`excluded.types`,
          lastLowPrice: sql`excluded.last_low_price`,
          avg24hPrice: sql`excluded.avg24h_price`,
          changeLast48hPercent: sql`excluded.change_last_48h_percent`,
          low24hPrice: sql`excluded.low24h_price`,
          high24hPrice: sql`excluded.high24h_price`,
          sellFor: sql`excluded.sell_for`,
          buyFor: sql`excluded.buy_for`,
          ...(hasPve
            ? {
                avg24hPricePve: sql`excluded.avg24h_price_pve`,
                low24hPricePve: sql`excluded.low24h_price_pve`,
                sellForPve: sql`excluded.sell_for_pve`,
                buyForPve: sql`excluded.buy_for_pve`,
              }
            : {}),
          syncedAt: sql`now()`,
        },
      });
  }

  return { items: rows.length };
}

/* ─────────────────── устойчивое чтение цен ───────────────────
 * PvE-колонки (`*_pve`) добавляются отдельной миграцией (migrate-prices-pve),
 * а с телефона db:push недоступен → возможен интервал «код задеплоен, колонок ещё
 * нет». Раньше это роняло ВЕСЬ каталог: `select()` тянул PvE-колонки → SELECT падал →
 * пустая карта цен → у предметов пустые `types` → фильтр категории отдавал 0 предметов.
 * Теперь читаем явной проекцией: сначала с PvE, при её отсутствии — один раз (флаг на
 * модуль) падаем в базовую проекцию. Порядок «деплой → миграция» больше ничего не ломает. */

// Postgres: 42703 = undefined_column. Плюс текстовый фолбэк на случай иной обёртки ошибки.
function isMissingColumnErr(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string }; message?: string };
  if (err.code === "42703" || err.cause?.code === "42703") return true;
  const msg = (err.message ?? "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
}

const BASE_COLS = {
  inGameId: prices.inGameId,
  normalizedName: prices.normalizedName,
  bsgCategoryId: prices.bsgCategoryId,
  minLevelForFlea: prices.minLevelForFlea,
  backgroundColor: prices.backgroundColor,
  types: prices.types,
  lastLowPrice: prices.lastLowPrice,
  avg24hPrice: prices.avg24hPrice,
  changeLast48hPercent: prices.changeLast48hPercent,
  low24hPrice: prices.low24hPrice,
  high24hPrice: prices.high24hPrice,
  sellFor: prices.sellFor,
  buyFor: prices.buyFor,
} as const;

const PVE_COLS = {
  avg24hPricePve: prices.avg24hPricePve,
  low24hPricePve: prices.low24hPricePve,
  sellForPve: prices.sellForPve,
  buyForPve: prices.buyForPve,
} as const;

// Один раз выяснили, что PvE-колонок нет → больше их не запрашиваем (до рестарта инстанса).
let pveColsMissing = false;

// Минимальный набор полей, который читает mapPriceRow. PvE — опциональны (могут отсутствовать).
interface PriceRowLike {
  inGameId: string;
  normalizedName: string | null;
  bsgCategoryId: string | null;
  minLevelForFlea: number | null;
  backgroundColor: string | null;
  types: string[] | null;
  lastLowPrice: number | null;
  avg24hPrice: number | null;
  changeLast48hPercent: number | null;
  low24hPrice: number | null;
  high24hPrice: number | null;
  sellFor: PriceVendorOffer[] | null;
  buyFor: PriceVendorOffer[] | null;
  avg24hPricePve?: number | null;
  low24hPricePve?: number | null;
  sellForPve?: PriceVendorOffer[] | null;
  buyForPve?: PriceVendorOffer[] | null;
}

/** SELECT из `prices` с фолбэком: с PvE-колонками → без них, если их ещё нет в БД. */
async function selectPriceRows(where: SQL | undefined): Promise<PriceRowLike[]> {
  if (!pveColsMissing) {
    try {
      return await db.select({ ...BASE_COLS, ...PVE_COLS }).from(prices).where(where);
    } catch (e) {
      if (!isMissingColumnErr(e)) throw e;
      pveColsMissing = true;
      console.warn("[prices] PvE-колонки отсутствуют — читаю без них (накати migrate-prices-pve)");
    }
  }
  return db.select(BASE_COLS).from(prices).where(where);
}

// Строка таблицы prices → EftPriceInfo (единый маппер для всех чтений — DRY).
function mapPriceRow(r: PriceRowLike): EftPriceInfo {
  return {
    normalizedName: r.normalizedName ?? "",
    bsgCategoryId: r.bsgCategoryId ?? undefined,
    minLevelForFlea: r.minLevelForFlea ?? undefined,
    backgroundColor: r.backgroundColor ?? undefined,
    types: r.types ?? undefined,
    lastLowPrice: r.lastLowPrice ?? undefined,
    avg24hPrice: r.avg24hPrice ?? undefined,
    changeLast48hPercent: r.changeLast48hPercent ?? undefined,
    low24hPrice: r.low24hPrice ?? undefined,
    high24hPrice: r.high24hPrice ?? undefined,
    sellFor: (r.sellFor ?? []) as CtaVendorOffer[],
    buyFor: (r.buyFor ?? []) as CtaVendorOffer[],
    avg24hPricePve: r.avg24hPricePve ?? undefined,
    low24hPricePve: r.low24hPricePve ?? undefined,
    sellForPve: (r.sellForPve ?? undefined) as CtaVendorOffer[] | undefined,
    buyForPve: (r.buyForPve ?? undefined) as CtaVendorOffer[] | undefined,
  };
}

// 1ч — совпадает с почасовым крон-синком цен; ≤1ч «несвежесть» приемлема.
const PRICES_TTL_MS = 60 * 60 * 1000;

/**
 * Карта inGameId → экономика/мета из НАШЕЙ таблицы `prices` (чтение, рантайм).
 * Никогда не бросает: пустая Map → список рендерится из каталога без цен.
 */
export async function getEftPriceMapFromDb(): Promise<Map<string, EftPriceInfo>> {
  try {
    const rows = await memoTTL("eft-price-rows", PRICES_TTL_MS, async () => {
      const gameId = await eftGameId();
      return selectPriceRows(eq(prices.gameId, gameId));
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
    const rows = await selectPriceRows(and(eq(prices.gameId, gameId), inArray(prices.inGameId, uniq)));
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
    const rows = await selectPriceRows(and(eq(prices.gameId, gameId), eq(prices.bsgCategoryId, bsgCategoryId)));
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
    const rows = await selectPriceRows(and(eq(prices.gameId, gameId), eq(prices.normalizedName, slug)));
    const row = rows[0];
    // Companion-цены НЕ накладываем на показ игроку: это внутренний источник правды,
    // публикуется только после модерации (см. [[eft-live-price-companion]] — очередь аномалий).
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
  avg24hPrice?: number;
  changeLast48hPercent?: number;
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
          avg24hPrice: prices.avg24hPrice,
          changeLast48hPercent: prices.changeLast48hPercent,
          backgroundColor: prices.backgroundColor,
          bsgCategoryId: prices.bsgCategoryId,
  minLevelForFlea: prices.minLevelForFlea,
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
          avg24hPrice: r.avg24hPrice ?? undefined,
          changeLast48hPercent: r.changeLast48hPercent ?? undefined,
          backgroundColor: r.backgroundColor ?? undefined,
          bsgCategoryId: r.bsgCategoryId ?? undefined,
    minLevelForFlea: r.minLevelForFlea ?? undefined,
        },
      ]),
    );
  } catch (e) {
    console.error("[getEftPriceIndex]", e);
    return new Map();
  }
}

/**
 * Возраст зеркала цен в часах. Нужен потому, что при недоступности источника
 * `syncEftPrices()` просто ничего не обновляет, и портал молча показывает вчерашние
 * числа: ни ошибки, ни красного прогона. Возраст делает заморозку видимой.
 *
 * Берётся максимум `synced_at` — то есть время последнего успешного обновления
 * хотя бы одной строки. null, если таблица пуста.
 */
export async function getPricesAgeHours(gameId: string): Promise<number | null> {
  try {
    const rows = await db
      .select({ ageHours: sql<number>`extract(epoch from (now() - max(${prices.syncedAt}))) / 3600` })
      .from(prices)
      .where(eq(prices.gameId, gameId));
    const value = rows[0]?.ageHours;
    return value === undefined || value === null ? null : Number(value);
  } catch (e) {
    console.error("[getPricesAgeHours]", e);
    return null;
  }
}

/** BSG-id валютных предметов: курс = их рыночная цена на барахолке (как у игроков),
 *  а не внутренний курс торговца. */
const CURRENCY_ITEM_ID = {
  USD: '5696686a4bdc2da3298b456a', // Доллары
  EUR: '569668774bdc2da2298b4568', // Евро
} as const;

/**
 * Курс валют в рублях = рыночная цена самих предметов «Доллары»/«Евро» на барахолке
 * (lastLowPrice, фолбэк avg24h). Это тот курс, которым оперируют игроки. Раньше
 * считался внутренний курс торговца (priceRUB/price по офферам) — он занижен и
 * расходится с рынком.
 */
export async function getCurrencyRates(_gameId: string): Promise<{ usd: number | null; eur: number | null }> {
  try {
    const map = await getEftPricesByIds([CURRENCY_ITEM_ID.USD, CURRENCY_ITEM_ID.EUR]);
    const rate = (id: string): number | null => {
      const p = map.get(id);
      const v = p?.lastLowPrice ?? p?.avg24hPrice ?? null;
      return v != null && v > 0 ? Math.round(v) : null;
    };
    return { usd: rate(CURRENCY_ITEM_ID.USD), eur: rate(CURRENCY_ITEM_ID.EUR) };
  } catch (e) {
    console.error('[getCurrencyRates]', e);
    return { usd: null, eur: null };
  }
}
