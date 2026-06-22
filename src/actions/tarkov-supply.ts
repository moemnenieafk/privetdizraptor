"use server";

import { eq } from "drizzle-orm";
import type { SupplyItem } from "@/types/supply";
import { db } from "@/db";
import { items } from "@/db/schema";
import { eftGameId } from "@/db/eft";
import { getEftPriceMapFromDb } from "@/db/prices";

// Топ ходовых предметов из НАШЕЙ БД (items + зеркало цен). В tarkov.dev не ходим.
export async function fetchSupplyItems(): Promise<SupplyItem[]> {
  try {
    const gameId = await eftGameId();
    const [itemRows, priceMap] = await Promise.all([
      db.select({ inGameId: items.inGameId, name: items.name, basePrice: items.basePrice }).from(items).where(eq(items.gameId, gameId)),
      getEftPriceMapFromDb(),
    ]);

    const rub = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;

    const result: SupplyItem[] = [];
    for (const it of itemRows) {
      const px = priceMap.get(it.inGameId);
      if (!px) continue;
      const avg = px.avg24hPrice;
      const chg = px.changeLast48hPercent;
      const lo = px.low24hPrice;
      const hi = px.high24hPrice;
      if (avg == null || avg < 5_000 || chg == null || lo == null || hi == null) continue;

      const traderSells = (px.sellFor ?? []).filter((s) => s.vendor.normalizedName !== "flea-market");
      const bestTrader = traderSells.length
        ? traderSells.reduce((best, s) => (rub(s) > rub(best) ? s : best))
        : null;
      const bestTraderBuy = bestTrader
        ? { price: rub(bestTrader), vendorName: bestTrader.vendor.name, vendorNormalizedName: bestTrader.vendor.normalizedName ?? "" }
        : null;

      const buybackRatio = bestTraderBuy && avg > 0 ? bestTraderBuy.price / avg - 1 : -1;
      const range24hPercent = avg > 0 ? ((hi - lo) / avg) * 100 : 0;
      const profitScore = Math.max(0, buybackRatio * 200) + Math.max(0, chg);

      result.push({
        name: it.name,
        normalizedName: px.normalizedName || it.inGameId,
        avg24hPrice: avg,
        basePrice: it.basePrice ?? 0,
        changeLast48hPercent: chg,
        low24hPrice: lo,
        high24hPrice: hi,
        range24hPercent,
        bestTraderBuy,
        buybackRatio,
        profitScore,
      });
    }

    return result.sort((a, b) => b.profitScore - a.profitScore).slice(0, 12);
  } catch {
    return [];
  }
}
