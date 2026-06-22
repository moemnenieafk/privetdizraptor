// Best-effort обогащение каталога EFT живыми данными из tarkov.dev.
//
// Цены (sellFor/buyFor) — «живые» данные, которых нет в нашем статическом
// источнике. Здесь же берём normalizedName (для ссылки на страницу предмета),
// backgroundColor (цвет редкости плитки) и types (для фильтра «только бартер»).
//
// Гибрид с graceful degradation: если tarkov.dev недоступен / отдал ошибку —
// возвращаем пустую карту, и список рендерится из каталога без цен.
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
  backgroundColor?: string;
  types?: string[];
  sellFor: CtaVendorOffer[];
  buyFor: CtaVendorOffer[];
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
  backgroundColor?: string;
  types?: string[];
  sellFor?: RawOffer[];
  buyFor?: RawOffer[];
}
interface RawResponse {
  data?: { items?: RawItem[] };
  errors?: unknown;
}

const QUERY = `
  query {
    items(lang: ru) {
      id
      normalizedName
      backgroundColor
      types
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
 * Карта id → экономика/мета из tarkov.dev. Кэш ISR 1 час.
 * Никогда не бросает: при любой ошибке отдаёт пустую Map (страница не падает).
 */
export async function getEftPriceMap(): Promise<Map<string, EftPriceInfo>> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return new Map();

    const json = (await res.json()) as RawResponse;
    if (json.errors || !json.data?.items) return new Map();

    return new Map(
      json.data.items.map((it) => [
        it.id,
        {
          normalizedName: it.normalizedName ?? "",
          backgroundColor: it.backgroundColor,
          types: it.types,
          sellFor: (it.sellFor ?? []).map(mapOffer),
          buyFor: (it.buyFor ?? []).map(mapOffer),
        } satisfies EftPriceInfo,
      ]),
    );
  } catch {
    return new Map();
  }
}
