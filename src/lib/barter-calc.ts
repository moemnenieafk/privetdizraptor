import type { StashItem, StashEconomics, BarterTrade, BarterCalculation } from '@/types/barter';

export function isArbitrageProfitable(item: StashItem): boolean {
  return (
    item.fleaPrice !== null &&
    item.bestTraderPriceRub !== null &&
    item.fleaPrice < item.bestTraderPriceRub
  );
}

export function calcStashEconomics(items: StashItem[]): StashEconomics {
  let totalFleaValue = 0;
  let totalTraderValue = 0;
  let arbitrageCount = 0;
  let arbitrageProfit = 0;

  for (const item of items) {
    totalFleaValue += item.fleaPrice ?? 0;
    totalTraderValue += item.bestTraderPriceRub ?? 0;
    if (isArbitrageProfitable(item)) {
      arbitrageCount++;
      arbitrageProfit += item.bestTraderPriceRub! - item.fleaPrice!;
    }
  }

  return { totalFleaValue, totalTraderValue, arbitrageCount, arbitrageProfit };
}

export function calcBarterProfit(trade: BarterTrade, stashItems: StashItem[]): BarterCalculation {
  // Acquisition cost: cheapest source per required item (min of flea and trader sell price)
  const totalComponentsCost = stashItems.reduce((sum, i) => {
    const prices = [i.fleaPrice, i.bestTraderPriceRub].filter((p): p is number => p !== null && p > 0);
    return sum + (prices.length ? Math.min(...prices) : 0);
  }, 0);

  // Flea sell price of reward item(s) — used for calculatedSavings spec field
  const targetItemFleaPrice = trade.rewardItems.reduce((sum, { item, count }) => {
    const fleaEntry = item.sellFor.find(s => s.vendor.normalizedName === 'flea-market');
    const price = fleaEntry ? (fleaEntry.priceRUB ?? fleaEntry.price) : 0;
    return sum + price * count;
  }, 0);

  // Best sell price of reward(s) — may be trader if item is noFlea
  const rewardBestSellRub = trade.rewardItems.reduce((sum, { item, count }) => {
    const prices = item.sellFor.map(s => s.priceRUB ?? s.price).filter(p => p > 0);
    return sum + (prices.length ? Math.max(...prices) : 0) * count;
  }, 0);

  const instantProfit = rewardBestSellRub - totalComponentsCost;
  const calculatedSavings = targetItemFleaPrice - totalComponentsCost;
  const roi = totalComponentsCost > 0 ? (instantProfit / totalComponentsCost) * 100 : 0;

  return {
    totalComponentsCost,
    targetItemFleaPrice,
    instantProfit,
    calculatedSavings,
    isFleaArbitrageProfitable: instantProfit > 0,
    roi,
  };
}

export function formatRub(value: number): string {
  return `₽ ${new Intl.NumberFormat('ru-RU').format(Math.round(value))}`;
}
