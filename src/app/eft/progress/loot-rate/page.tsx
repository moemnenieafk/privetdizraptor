import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { LootRateClient, type LootItem } from './LootRateClient';
import { db } from '@/db';
import { items } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';

export const metadata: Metadata = { title: 'Рейтинг предметов | Прогресс ЦТА' };

// Типы предметов, попадающих в рейтинг (как в старом types-запросе к tarkov.dev).
const LOOT_TYPES = new Set([
  'armor', 'backpack', 'armorPlate', 'glasses', 'headphones', 'helmet', 'wearable', 'rig',
  'gun', 'mods', 'ammo', 'grenade', 'meds', 'injectors', 'keys', 'container', 'provisions',
]);

// ─── Сборка из НАШЕЙ БД (items + цены). В tarkov.dev не ходим. ──────────────────

async function fetchLootItems(): Promise<LootItem[]> {
  const gameId = await eftGameId();
  const [itemRows, priceMap] = await Promise.all([
    db
      .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName, width: items.gridWidth, height: items.gridHeight })
      .from(items)
      .where(eq(items.gameId, gameId)),
    getEftPriceMapFromDb(),
  ]);

  const rubVal = (p: { price: number; priceRUB?: number }) => p.priceRUB ?? p.price;
  const isFlea = (v: { name: string; normalizedName?: string }) =>
    v.name === 'Flea Market' || v.normalizedName === 'flea-market';

  const out: LootItem[] = [];
  for (const r of itemRows) {
    const px = priceMap.get(r.inGameId);
    const types = px?.types ?? [];
    if (!types.some((t) => LOOT_TYPES.has(t))) continue;

    const sells = px?.sellFor ?? [];
    const traderSells = sells.filter((s) => !isFlea(s.vendor));
    const bestTrader = traderSells.length
      ? traderSells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), traderSells[0])
      : null;
    const fleaSell = sells.find((s) => isFlea(s.vendor));
    const bestSell = sells.length ? sells.reduce((mx, cur) => (rubVal(cur) > rubVal(mx) ? cur : mx), sells[0]) : null;
    const validBuys = (px?.buyFor ?? []).filter((b) => rubVal(b) > 0);
    const bestBuy = validBuys.length ? validBuys.reduce((mn, cur) => (rubVal(cur) < rubVal(mn) ? cur : mn), validBuys[0]) : null;

    const width = r.width ?? 1;
    const height = r.height ?? 1;
    const slots = width * height;
    const bestPrice = bestSell ? rubVal(bestSell) : 0;

    out.push({
      id: r.inGameId,
      name: r.name,
      shortName: r.shortName ?? '',
      width,
      height,
      image512pxLink: itemIconUrl(r.inGameId),
      backgroundColor: px?.backgroundColor,
      types,
      slots,
      traderSell: bestTrader ? rubVal(bestTrader) : 0,
      traderSellVendor: bestTrader?.vendor,
      fleaSell: fleaSell ? rubVal(fleaSell) : 0,
      vps: slots > 0 && bestPrice > 0 ? Math.floor(bestPrice / slots) : 0,
      minBuy: bestBuy ? rubVal(bestBuy) : 0,
      minBuyVendor: bestBuy?.vendor,
      minBuyCurrency: bestBuy?.currency,
      minBuyRawPrice: bestBuy?.price,
    });
  }
  return out;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LootRatePage() {
  const items = await fetchLootItems();
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <LootRateClient items={items} />
      </div>
    </main>
  );
}
