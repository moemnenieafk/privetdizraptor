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
interface GraphQLError {
  message?: string;
}

interface RawResponse {
  data?: { items?: RawItem[] };
  errors?: GraphQLError[];
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
 * Причина последней неудачной выборки. Нужна потому, что пустая Map не различает
 * «источник лежит» и «мы сломали запрос»: одно неизвестное поле в GraphQL роняет
 * ВЕСЬ запрос, и снаружи это выглядит так же, как 503.
 */
let lastFetchError: string | null = null;
export function getLastPriceFetchError(): string | null {
  return lastFetchError;
}

/** Поля, без которых запрос обязан работать. minLevelForFlea появился в схеме
 *  недавно — если прод источника его ещё не знает, повторяем запрос без него. */
const OPTIONAL_FIELDS = ["minLevelForFlea"] as const;

/**
 * Карта id → экономика/мета из tarkov.dev. Никогда не бросает: при любой ошибке
 * отдаёт пустую Map (синк сам решает, что делать с пустотой), причина ложится
 * в getLastPriceFetchError().
 */
export async function getEftPriceMap(gameMode: 'regular' | 'pve' = 'regular'): Promise<Map<string, EftPriceInfo>> {
  lastFetchError = null;
  try {
    let query = buildQuery(gameMode);
    let res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });
    if (!res.ok) {
      lastFetchError = `HTTP ${res.status} от tarkov.dev`;
      console.error("[getEftPriceMap]", lastFetchError);
      return new Map();
    }

    let json = (await res.json()) as RawResponse;

    // Неизвестное поле роняет весь запрос. Выкидываем необязательные и пробуем ещё раз,
    // чтобы схема источника не могла обрушить синк целиком.
    if (json.errors?.length) {
      const message = json.errors.map((e: GraphQLError) => e?.message ?? "").join(" | ");
      const culprit = OPTIONAL_FIELDS.find((f) => message.includes(f));
      if (culprit) {
        console.warn(`[getEftPriceMap] источник не знает поля ${culprit} — повтор без него`);
        query = query.replace(new RegExp(`^\\s*${culprit}\\s*$`, "m"), "");
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ query }),
          cache: "no-store",
        });
        json = res.ok ? ((await res.json()) as RawResponse) : json;
        lastFetchError = `поле ${culprit} отсутствует в схеме источника`;
      } else {
        lastFetchError = `GraphQL: ${message.slice(0, 300)}`;
        console.error("[getEftPriceMap]", lastFetchError);
        return new Map();
      }
    }

    if (json.errors?.length && !json.data?.items) {
      lastFetchError = `GraphQL: ${json.errors.map((e: GraphQLError) => e?.message ?? "").join(" | ").slice(0, 300)}`;
      console.error("[getEftPriceMap]", lastFetchError);
      return new Map();
    }
    if (!json.data?.items) {
      lastFetchError = lastFetchError ?? "ответ без data.items";
      console.error("[getEftPriceMap]", lastFetchError);
      return new Map();
    }

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
  } catch (e) {
    lastFetchError = e instanceof Error ? e.message : String(e);
    console.error("[getEftPriceMap]", lastFetchError);
    return new Map();
  }
}
