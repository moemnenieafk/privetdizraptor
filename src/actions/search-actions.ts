'use server'

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import { searchItems } from '@/lib/search-engine';
import { EFT_QUESTS } from '@/data/quests';
import type { EftItem } from '@/lib/eft-api';
import type { CtaVendorOffer } from '@/lib/eft-prices';
import type { SearchItemResult, QuestSearchResult, QuestSearchItem } from '@/types/search';

// Цена в рублях: priceRUB приоритетнее.
const rubVal = (o: { price: number; priceRUB?: number }) => o.priceRUB ?? o.price;
const isFlea = (v: { name: string; normalizedName?: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

const perSlot = (price: number, w: number, h: number) => {
  const slots = Math.max(1, (w || 1) * (h || 1));
  return Math.round(price / slots);
};

export async function searchEftItemsAction(query: string): Promise<SearchItemResult[]> {
  if (!query || query.length < 2) return [];

  // Каталог и цены — из НАШЕЙ Supabase (рантайм без api.tarkov.dev).
  const gameId = await eftGameId();
  const [itemRows, priceMap] = await Promise.all([
    db
      .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName, width: items.gridWidth, height: items.gridHeight })
      .from(items)
      .where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
  ]);

  const eftItems: EftItem[] = itemRows.map((r) => {
    const px = priceMap.get(r.inGameId);
    return {
      id: r.inGameId,
      normalizedName: px?.normalizedName ?? '',
      name: r.name,
      shortName: r.shortName ?? '',
      types: px?.types ?? [],
      width: r.width ?? 1,
      height: r.height ?? 1,
      gridImageLink: itemIconUrl(r.inGameId),
      lastLowPrice: px?.lastLowPrice ?? null,
      backgroundColor: px?.backgroundColor,
      bsgCategoryId: px?.bsgCategoryId,
    };
  });

  const top = searchItems(eftItems, query).slice(0, 12);
  if (top.length === 0) return [];

  return top.map((it): SearchItemResult => {
    const sells: CtaVendorOffer[] = priceMap.get(it.id)?.sellFor ?? [];

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
            vendorNormalizedName: bestTrader.vendor.normalizedName ?? '',
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
    // Предметы-цели задания, дедуп по id, до 4 штук.
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
