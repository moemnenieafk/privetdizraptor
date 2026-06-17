"use server";

import type { SupplyItem } from "@/types/supply";

const ENDPOINT = "https://api.tarkov.dev/graphql";

// Fetch wide item pool — 500 items lets us surface rare valuables (keys, GPU, quest items)
// that never appear at limit:50
const SUPPLY_QUERY = `query {
  items(limit: 500, lang: ru) {
    name
    normalizedName
    avg24hPrice
    basePrice
    changeLast48hPercent
    low24hPrice
    high24hPrice
    sellFor {
      price
      priceRUB
      vendor { name normalizedName }
    }
  }
}`;

type RawItem = {
  name: string;
  normalizedName: string;
  avg24hPrice: number | null;
  basePrice: number;
  changeLast48hPercent: number | null;
  low24hPrice: number | null;
  high24hPrice: number | null;
  sellFor: { price: number; priceRUB: number | null; vendor: { name: string; normalizedName: string } }[];
};

export async function fetchSupplyItems(): Promise<SupplyItem[]> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: SUPPLY_QUERY }),
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (json.errors?.length) return [];

    const raw: RawItem[] = json.data?.items ?? [];

    return raw
      .filter(
        (i): i is RawItem & {
          avg24hPrice: number;
          changeLast48hPercent: number;
          low24hPrice: number;
          high24hPrice: number;
        } =>
          i.avg24hPrice != null &&
          i.avg24hPrice >= 5_000 && // Exclude low-value junk
          i.changeLast48hPercent != null &&
          i.low24hPrice != null &&
          i.high24hPrice != null
      )
      .map((item) => {
        const traderSells = item.sellFor.filter(
          (s) => s.vendor.normalizedName !== "flea-market"
        );
        const bestTrader =
          traderSells.length > 0
            ? traderSells.reduce((best, s) => {
                const price = s.priceRUB ?? s.price;
                const bestPrice = best.priceRUB ?? best.price;
                return price > bestPrice ? s : best;
              })
            : null;

        const bestTraderBuy = bestTrader
          ? {
              price: bestTrader.priceRUB ?? bestTrader.price,
              vendorName: bestTrader.vendor.name,
              vendorNormalizedName: bestTrader.vendor.normalizedName,
            }
          : null;

        const buybackRatio =
          bestTraderBuy && item.avg24hPrice > 0
            ? bestTraderBuy.price / item.avg24hPrice - 1
            : -1;

        // 24h price range as % of avg — shows how actively traded the item is
        const range24hPercent =
          item.avg24hPrice > 0
            ? ((item.high24hPrice - item.low24hPrice) / item.avg24hPrice) * 100
            : 0;

        // Profit score: arbitrage (buyback > 0) weighted 2x + rising price
        // Separates genuinely profitable items from mere volatility
        const profitScore =
          Math.max(0, buybackRatio * 200) + Math.max(0, item.changeLast48hPercent);

        return {
          name: item.name,
          normalizedName: item.normalizedName,
          avg24hPrice: item.avg24hPrice,
          basePrice: item.basePrice,
          changeLast48hPercent: item.changeLast48hPercent,
          low24hPrice: item.low24hPrice,
          high24hPrice: item.high24hPrice,
          range24hPercent,
          bestTraderBuy,
          buybackRatio,
          profitScore,
        };
      })
      // Sort by profitScore: trader arbitrage + rising price = most actionable for players
      .sort((a, b) => b.profitScore - a.profitScore)
      .slice(0, 12);
  } catch {
    return [];
  }
}
