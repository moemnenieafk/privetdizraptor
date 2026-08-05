// Фетч цен/экономики EFT. ИСТОЧНИК для self-mirror'а: эту функцию вызывает ТОЛЬКО
// серверный синк (src/db/prices.ts → крон /api/cron/sync-prices). Рантайм-UI цены
// отсюда НЕ тянет — он читает нашу таблицу `prices`. В рамках CLAUDE.md §4.11.
//
// ИСТОЧНИК: JSON-плоскость tarkov.dev (`json.tarkov.dev/{gameMode}/items` + `.../traders`).
// GraphQL ОТСТАВЛЕН (§4.12) — фолбэка на него нет; лёг источник → пустая Map, синк НЕ
// затирает last-known-good. Полностью независимый вторичный источник (tarkov-market) —
// отдельный P3. Диагностика: decisions/eft-data-autonomy-research.md.
//
// Адаптер JSON-плоскости → EftPriceInfo: sellToTrader/buyFromTrader (ТОЛЬКО торговцы,
// trader=id) + синтез записи барахолки из lastLowPrice; categories[0]=bsgCategoryId;
// имена торговцев из /traders + TRADER_RU; low24hPrice отсутствует (null).
import type { EftCurrency } from "@/lib/formatters";
import { TRADER_RU, FLEA_NORMALIZED_NAME, FLEA_VENDOR_RU } from "@/lib/tarkov-labels";

const JSON_BASE = "https://json.tarkov.dev";

export interface CtaVendorOffer {
  price: number;
  priceRUB?: number;
  currency?: EftCurrency;
  vendor: { name: string; normalizedName?: string };
}

export interface EftPriceInfo {
  normalizedName: string;
  bsgCategoryId?: string;
  /** Уровень ЧВК для доступа к предмету на барахолке. */
  minLevelForFlea?: number;
  backgroundColor?: string;
  types?: string[];
  lastLowPrice?: number;
  avg24hPrice?: number;
  changeLast48hPercent?: number;
  low24hPrice?: number;
  high24hPrice?: number;
  sellFor: CtaVendorOffer[];
  buyFor: CtaVendorOffer[];
  avg24hPricePve?: number;
  low24hPricePve?: number;
  sellForPve?: CtaVendorOffer[];
  buyForPve?: CtaVendorOffer[];
}

// TRADER_RU + FLEA_NORMALIZED_NAME/FLEA_VENDOR_RU переехали в @/lib/tarkov-labels
// (общие для всех JSON-plane синков — barters/crafts/… — DRY).

/**
 * Причина последней неудачной выборки. Пустая Map не различает «источник лежит» и
 * «мы сломали запрос» — причина ложится сюда, синк вписывает её в свою ошибку.
 */
let lastFetchError: string | null = null;
export function getLastPriceFetchError(): string | null {
  return lastFetchError;
}

/* ═══════════════ ИСТОЧНИК 1: JSON-плоскость json.tarkov.dev ═══════════════ */

interface JsonTraderOffer {
  trader?: string; // id торговца (имя резолвим через /traders)
  price?: number;
  priceRUB?: number;
  currency?: string;
}
interface JsonItem {
  id: string;
  normalizedName?: string;
  categories?: string[]; // от частного к общему; [0] == прежний bsgCategoryId
  minLevelForFlea?: number | null;
  backgroundColor?: string;
  types?: string[];
  lastLowPrice?: number | null;
  avg24hPrice?: number | null;
  high24hPrice?: number | null;
  changeLast48hPercent?: number | null;
  sellToTrader?: JsonTraderOffer[];
  buyFromTrader?: JsonTraderOffer[];
}
interface JsonItemsResponse {
  data?: { items?: Record<string, JsonItem> };
}
interface JsonTrader {
  name?: string;
  normalizedName?: string;
}
interface JsonTradersResponse {
  data?: Record<string, JsonTrader>;
}

/** id торговца → { normalizedName, ru-имя }. Тихий best-effort: свою ошибку в
 *  lastFetchError НЕ пишет (торговцы не должны маскировать успех по items). */
async function fetchTraderMap(
  gameMode: "regular" | "pve",
): Promise<Map<string, { name: string; normalizedName: string }>> {
  const map = new Map<string, { name: string; normalizedName: string }>();
  try {
    const res = await fetch(`${JSON_BASE}/${gameMode}/traders`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return map;
    const json = (await res.json()) as JsonTradersResponse;
    if (!json?.data) return map;
    for (const [id, t] of Object.entries(json.data)) {
      const nn = t.normalizedName ?? id;
      map.set(id, { normalizedName: nn, name: TRADER_RU[nn] ?? t.name ?? nn });
    }
  } catch {
    /* best-effort: офферы получат имя = id */
  }
  return map;
}

const toTraderOffer = (
  o: JsonTraderOffer,
  traders: Map<string, { name: string; normalizedName: string }>,
): CtaVendorOffer => {
  const t = o.trader ? traders.get(o.trader) : undefined;
  return {
    price: o.price ?? 0,
    priceRUB: o.priceRUB,
    currency: o.currency as EftCurrency | undefined,
    vendor: { name: t?.name ?? o.trader ?? "-", normalizedName: t?.normalizedName ?? o.trader },
  };
};

/** Синтетический оффер барахолки: в JSON-плоскости флиа отдельным «вендором» нет
 *  (есть только скаляр lastLowPrice), а UI ищет барахолку именно в sellFor/buyFor —
 *  без записи карточки барахолки пустеют. Цена = lastLowPrice (фолбэк avg24h).
 *  noFlea — пропускаем. */
const fleaOffer = (it: JsonItem): CtaVendorOffer | null => {
  if ((it.types ?? []).includes("noFlea")) return null;
  const price = it.lastLowPrice ?? it.avg24hPrice ?? null;
  if (price == null || price <= 0) return null;
  return {
    price,
    priceRUB: price,
    currency: "RUB",
    vendor: { name: FLEA_VENDOR_RU, normalizedName: FLEA_NORMALIZED_NAME },
  };
};

/** Тянет и маппит цены из JSON-плоскости. Пустая Map = источник недоступен/пуст. */
async function fetchFromJsonPlane(gameMode: "regular" | "pve"): Promise<Map<string, EftPriceInfo>> {
  const traders = await fetchTraderMap(gameMode);
  const res = await fetch(`${JSON_BASE}/${gameMode}/items`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    lastFetchError = `HTTP ${res.status} от json.tarkov.dev/${gameMode}/items`;
    return new Map();
  }
  const json = (await res.json()) as JsonItemsResponse;
  const items = json?.data?.items;
  if (!items) {
    lastFetchError = "json.tarkov.dev: ответ без data.items";
    return new Map();
  }
  const result = new Map<string, EftPriceInfo>();
  for (const it of Object.values(items)) {
    const sellFor = (it.sellToTrader ?? []).map((o) => toTraderOffer(o, traders));
    const buyFor = (it.buyFromTrader ?? []).map((o) => toTraderOffer(o, traders));
    const flea = fleaOffer(it);
    if (flea) {
      sellFor.push(flea);
      buyFor.push({ ...flea }); // отдельная копия — без алиасинга между массивами
    }
    result.set(it.id, {
      normalizedName: it.normalizedName ?? "",
      bsgCategoryId: it.categories?.[0] ?? undefined,
      minLevelForFlea: it.minLevelForFlea ?? undefined,
      backgroundColor: it.backgroundColor,
      types: it.types,
      lastLowPrice: it.lastLowPrice ?? undefined,
      avg24hPrice: it.avg24hPrice ?? undefined,
      changeLast48hPercent: it.changeLast48hPercent ?? undefined,
      low24hPrice: undefined, // нет в JSON-плоскости (в UI не используется)
      high24hPrice: it.high24hPrice ?? undefined,
      sellFor,
      buyFor,
    });
  }
  return result;
}

/* ═══════════════ Оркестратор: JSON-плоскость → degradation ═══════════════ */

/**
 * Карта id → экономика/мета. Никогда не бросает. Источник — JSON-плоскость; пусто/лёг
 * → пустая Map (синк НЕ затирает данные, каталог живёт на последних успешных ценах),
 * причина — в getLastPriceFetchError(). GraphQL-фолбэка нет (§4.12).
 */
export async function getEftPriceMap(
  gameMode: "regular" | "pve" = "regular",
): Promise<Map<string, EftPriceInfo>> {
  lastFetchError = null;
  try {
    const fromJson = await fetchFromJsonPlane(gameMode);
    if (fromJson.size === 0) {
      lastFetchError = lastFetchError ?? "JSON-плоскость пуста";
      console.error(`[getEftPriceMap] ${lastFetchError}`);
    }
    return fromJson;
  } catch (e) {
    lastFetchError = e instanceof Error ? e.message : String(e);
    console.error("[getEftPriceMap]", lastFetchError);
    return new Map();
  }
}
