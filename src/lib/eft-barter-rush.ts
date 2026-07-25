import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { barters as bartersTable, items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import { calcBarterProfitStandalone, isPlayableBarter } from '@/lib/barter-calc';
import type { CtaVendorOffer } from '@/lib/eft-prices';
import type { BarterItemBase, BarterPrice, BarterTrade, BarterVerdict } from '@/types/barter';

// Ридер колоды для аркадной game03 «Прибыль бартера». Вердикт/профит считаем ТУТ (сервер),
// клиенту шлём ЛЁГКИЙ RushCard (без тяжёлых price-массивов). Данные — из нашей Supabase
// (items+prices+barters), рантайм-фетча наружу нет (CLAUDE.md §4.11). Иконки — itemIconUrl.

export interface RushItem {
  img: string;
  shortName: string;
  bg: string;
  count: number;
}

export interface RushCard {
  id: string;
  traderName: string;
  traderNorm: string;
  level: number;
  reward: RushItem;
  rewardLabel: string;
  required: RushItem[];
  verdict: BarterVerdict;
  netProfit: number;
  roi: number;
}

const MAX_CARDS = 160;

const toPrices = (offers: CtaVendorOffer[] = []): BarterPrice[] =>
  offers.map((o) => ({
    price: o.price,
    priceRUB: o.priceRUB ?? null,
    vendor: { name: o.vendor.name, normalizedName: o.vendor.normalizedName ?? '' },
  }));

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function getRushDeck(): Promise<RushCard[]> {
  const gameId = await eftGameId();
  const [itemRows, priceMap, barterRows] = await Promise.all([
    db
      .select({
        inGameId: items.inGameId,
        name: items.name,
        shortName: items.shortName,
        gridWidth: items.gridWidth,
        gridHeight: items.gridHeight,
        basePrice: items.basePrice,
      })
      .from(items)
      .where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
    db.select().from(bartersTable).where(eq(bartersTable.gameId, gameId)),
  ]);

  const catalog = new Map(itemRows.map((r) => [r.inGameId, r]));
  const baseCache = new Map<string, BarterItemBase>();
  const base = (id: string): BarterItemBase => {
    const hit = baseCache.get(id);
    if (hit) return hit;
    const c = catalog.get(id);
    const p = priceMap.get(id);
    const built: BarterItemBase = {
      id,
      name: c?.name ?? id,
      shortName: c?.shortName ?? '',
      image512pxLink: itemIconUrl(id),
      backgroundColor: p?.backgroundColor ?? 'default',
      width: c?.gridWidth ?? 1,
      height: c?.gridHeight ?? 1,
      sellFor: toPrices(p?.sellFor),
      buyFor: toPrices(p?.buyFor),
      normalizedName: p?.normalizedName || undefined,
      basePrice: c?.basePrice ?? undefined,
    };
    baseCache.set(id, built);
    return built;
  };

  const trades: BarterTrade[] = barterRows.map((b) => ({
    id: b.id,
    trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? '' },
    level: b.level ?? 1,
    taskUnlock: b.taskUnlockId ? { id: b.taskUnlockId } : null,
    requiredItems: b.requiredItems.map((s) => ({ item: base(s.itemId), count: s.count })),
    rewardItems: b.rewardItems.map((s) => ({ item: base(s.itemId), count: s.count })),
  }));

  // Иконки гоним через /_next/image (same-origin proxy): канвас-игра рисует их в CRT-канвас,
  // а R2 не отдаёт CORS → прямой crossOrigin-фетч затейнил бы канвас и уронил WebGL.
  const optimizedIcon = (raw: string) => `/_next/image?url=${encodeURIComponent(raw)}&w=128&q=75`;
  const toRushItem = (item: BarterItemBase, count: number): RushItem => ({
    img: optimizedIcon(item.image512pxLink),
    shortName: item.shortName || item.name,
    bg: item.backgroundColor,
    count,
  });

  const cards: RushCard[] = trades
    .filter(isPlayableBarter)
    .map((t) => {
      const calc = calcBarterProfitStandalone(t);
      const reward = t.rewardItems[0];
      return {
        id: t.id,
        traderName: t.trader.name,
        traderNorm: t.trader.normalizedName,
        level: t.level,
        reward: toRushItem(reward.item, reward.count),
        rewardLabel: t.rewardItems
          .map((ri) => `${ri.item.shortName || ri.item.name}${ri.count > 1 ? ` ×${Math.ceil(ri.count)}` : ''}`)
          .join(' + '),
        required: t.requiredItems.map((ri) => toRushItem(ri.item, ri.count)),
        verdict: calc.verdict,
        netProfit: calc.netProfit,
        roi: calc.roi,
      };
    });

  return shuffle(cards).slice(0, MAX_CARDS);
}
