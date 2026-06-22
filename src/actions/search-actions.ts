'use server'

import { getAllEftItems, getEftItemsPricing, type SellOffer } from '@/lib/eft-api';
import { searchItems } from '@/lib/search-engine';
import { EFT_QUESTS } from '@/data/quests';
import type { SearchItemResult, QuestSearchResult, QuestSearchItem } from '@/types/search';

// Цена в рублях: priceRUB приоритетнее (валютные офферы уже сконвертированы).
const rubVal = (o: SellOffer) => o.priceRUB ?? o.price;
// Барахолка как вендор в данных tarkov.dev.
const isFlea = (v: { name: string; normalizedName?: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

const perSlot = (price: number, w: number, h: number) => {
  const slots = Math.max(1, (w || 1) * (h || 1));
  return Math.round(price / slots);
};

export async function searchEftItemsAction(query: string): Promise<SearchItemResult[]> {
  console.log(`\n⚡ X-RAY [SEARCH:ITEMS]: Получен запрос "${query}"`);
  if (!query || query.length < 2) return [];

  const items = await getAllEftItems();
  const top = searchItems(items, query).slice(0, 12); // Топ-12 на клиент
  if (top.length === 0) return [];

  // Догружаем цены продажи только для найденных предметов.
  const pricing = await getEftItemsPricing(top.map((i) => i.id));

  return top.map((it): SearchItemResult => {
    const sells = pricing.get(it.id) ?? [];

    const traderSells = sells.filter((s) => !isFlea(s.vendor) && rubVal(s) > 0);
    const bestTrader = traderSells.length
      ? traderSells.reduce((m, c) => (rubVal(c) > rubVal(m) ? c : m))
      : undefined;

    const flea = sells.find((s) => isFlea(s.vendor) && rubVal(s) > 0);
    const fleaPrice = flea ? rubVal(flea) : (it.lastLowPrice ?? 0);

    return {
      id: it.id,
      normalizedName: it.normalizedName,
      name: it.name,
      shortName: it.shortName,
      types: it.types,
      width: it.width,
      height: it.height,
      backgroundColor: it.backgroundColor,
      bsgCategoryId: it.bsgCategoryId,
      gridImageLink: it.gridImageLink,
      traderSell: bestTrader
        ? {
            price: rubVal(bestTrader),
            perSlot: perSlot(rubVal(bestTrader), it.width, it.height),
            vendorName: bestTrader.vendor.name,
            vendorNormalizedName: bestTrader.vendor.normalizedName,
          }
        : undefined,
      fleaSell: fleaPrice > 0
        ? { price: fleaPrice, perSlot: perSlot(fleaPrice, it.width, it.height) }
        : undefined,
    };
  });
}

export async function searchQuestsAction(query: string): Promise<QuestSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const matched = EFT_QUESTS.filter(
    (t) => t.name.toLowerCase().includes(q) || t.normalizedName.toLowerCase().includes(q)
  ).slice(0, 6);

  return matched.map((t) => {
    // Предметы-цели задания (giveItem/findItem), дедуп по id, до 4 штук.
    const items = new Map<string, QuestSearchItem>();
    for (const obj of t.objectives) {
      if (obj.__typename === 'TaskObjectiveItem' && obj.item && !items.has(obj.item.id)) {
        items.set(obj.item.id, {
          id: obj.item.id,
          shortName: obj.item.shortName,
          image512pxLink: obj.item.image512pxLink,
          count: obj.count ?? 0,
          foundInRaid: !!obj.foundInRaid,
        });
      }
    }

    return {
      id: t.id,
      name: t.name,
      normalizedName: t.normalizedName,
      trader: { name: t.trader.name, normalizedName: t.trader.normalizedName },
      minPlayerLevel: t.minPlayerLevel,
      kappaRequired: t.kappaRequired,
      lightkeeperRequired: t.lightkeeperRequired,
      items: Array.from(items.values()).slice(0, 4),
    };
  });
}
