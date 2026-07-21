// Фетч цен/экономики EFT из tarkov.dev. ИСТОЧНИК для self-mirror'а: эту функцию
// вызывает ТОЛЬКО серверный синк (src/db/prices.ts → крон /api/cron/sync-prices).
// Рантайм-UI цены из tarkov.dev НЕ тянет — он читает нашу таблицу `prices`.
//
// Берём: sellFor/buyFor (цены торговцев+барахолки), normalizedName (ссылка на
// карточку), bsgCategoryId (фильтр категорий), backgroundColor (редкость), types
// (фильтр «бартер»), и скалярные поля барахолки (lastLowPrice/avg24h/change48h).
import type { EftCurrency } from "@/lib/formatters";

const ENDPOINT = "https://api.tarkov.dev/graphql";

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

/* ───────────────── сырой ответ API (без any) ───────────────── */
interface RawOffer {
  price?: number;
  priceRUB?: number;
  currency?: string;
  vendor?: { name?: string; normalizedName?: string };
}
interface RawItem {
  id: string;
  normalizedName?: string;
  bsgCategoryId?: string;
  minLevelForFlea?: number;
  backgroundColor?: string;
  types?: string[];
  lastLowPrice?: number;
  avg24hPrice?: number;
  changeLast48hPercent?: number;
  low24hPrice?: number;
  high24hPrice?: number;
  sellFor?: RawOffer[];
  buyFor?: RawOffer[];
}
interface RawResponse {
  data?: { items?: RawItem[] };
  errors?: unknown;
}

const buildQuery = (gameMode: 'regular' | 'pve') => `
  query {
    items(lang: ru, gameMode: ${gameMode}) {
      id
      normalizedName
      bsgCategoryId
      minLevelForFlea
      backgroundColor
      types
      lastLowPrice
      avg24hPrice
      changeLast48hPercent
      low24hPrice
      high24hPrice
      sellFor { price priceRUB currency vendor { name normalizedName } }
      buyFor  { price priceRUB currency vendor { name normalizedName } }
    }
  }
`;

const mapOffer = (o: RawOffer): CtaVendorOffer => ({
  price: o.price ?? 0,
  priceRUB: o.priceRUB,
  currency: o.currency as EftCurrency | undefined,
  vendor: { name: o.vendor?.name ?? "-", normalizedName: o.vendor?.normalizedName },
});

/**
 * Карта id → экономика/мета из tarkov.dev. Никогда не бросает: при любой ошибке
 * отдаёт пустую Map (синк сам решает, что делать с пустотой).
 */
export async function getEftPriceMap(gameMode: 'regular' | 'pve' = 'regular'): Promise<Map<string, EftPriceInfo>> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: buildQuery(gameMode) }),
      cache: "no-store",
    });
    if (!res.ok) return new Map();

    const json = (await res.json()) as RawResponse;
    if (json.errors || !json.data?.items) return new Map();

    return new Map(
      json.data.items.map((it) => [
        it.id,
        {
          normalizedName: it.normalizedName ?? "",
          bsgCategoryId: it.bsgCategoryId ?? undefined,
          minLevelForFlea: it.minLevelForFlea ?? undefined,
          backgroundColor: it.backgroundColor,
          types: it.types,
          lastLowPrice: it.lastLowPrice ?? undefined,
          avg24hPrice: it.avg24hPrice ?? undefined,
          changeLast48hPercent: it.changeLast48hPercent ?? undefined,
          low24hPrice: it.low24hPrice ?? undefined,
          high24hPrice: it.high24hPrice ?? undefined,
          sellFor: (it.sellFor ?? []).map(mapOffer),
          buyFor: (it.buyFor ?? []).map(mapOffer),
        } satisfies EftPriceInfo,
      ]),
    );
  } catch {
    return new Map();
  }
}
