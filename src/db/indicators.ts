// Индикаторные карты плитки (бартер/крафт/GP-монеты) ИЗ НАШЕЙ БД.
// Топология бартеров/крафтов лежит в `barters`/`crafts`; цены/имена предметов —
// в `items`+`prices`. Реконструируем сырые RawBarter/RawCraft и кормим ими
// чистые билдеры buildBarterData/buildCraftData (та же математика, что и раньше).
// Замена fetchIndicatorBarters/Crafts + getGpCoinBarters (которые ходили в tarkov.dev).
import { eq } from "drizzle-orm";
import { db } from "./index";
import { barters, crafts, items, prices } from "./schema";
import { eftGameId } from "./eft";
import { itemIconUrl } from "../lib/item-icon";
import {
  buildBarterData,
  buildCraftData,
  type RawBarter,
  type RawCraft,
  type BarterUnlockInfo,
} from "../lib/eft-indicators.economics";
import type {
  EftBarterData,
  EftCraftData,
} from "../components/features/items/EftItemTile/types";

const GP_COIN_ID = "5d235b4d86f7742e017bc88a"; // Монета GP (бартеры Рефа за ГП)

export interface DbIndicators {
  barterDataMap: Record<string, EftBarterData>;
  barterUnlockMap: Record<string, BarterUnlockInfo>;
  craftDataMap: Record<string, EftCraftData>;
  gpCoinBarters: Record<string, number>;
}

const EMPTY: DbIndicators = {
  barterDataMap: {},
  barterUnlockMap: {},
  craftDataMap: {},
  gpCoinBarters: {},
};

/** Бартер/крафт/GP-индикаторы из нашей БД. Никогда не бросает (пустые карты при сбое). */
export async function getEftIndicatorsFromDb(): Promise<DbIndicators> {
  try {
    const gameId = await eftGameId();
    const [barterRows, craftRows, itemRows, priceRows] = await Promise.all([
      db.select().from(barters).where(eq(barters.gameId, gameId)),
      db.select().from(crafts).where(eq(crafts.gameId, gameId)),
      db
        .select({
          inGameId: items.inGameId,
          name: items.name,
          shortName: items.shortName,
          basePrice: items.basePrice,
        })
        .from(items)
        .where(eq(items.gameId, gameId)),
      db
        .select({ inGameId: prices.inGameId, types: prices.types, sellFor: prices.sellFor, buyFor: prices.buyFor })
        .from(prices)
        .where(eq(prices.gameId, gameId)),
    ]);

    const nameMap = new Map(itemRows.map((r) => [r.inGameId, r]));
    const priceMap = new Map(priceRows.map((r) => [r.inGameId, r]));

    // Реконструируем «ценовой» предмет под форму RawApiItem (id/name/sellFor/buyFor/…).
    const lookup = (id: string) => {
      const it = nameMap.get(id);
      const px = priceMap.get(id);
      return {
        id,
        name: it?.name ?? id,
        shortName: it?.shortName ?? undefined,
        image512pxLink: itemIconUrl(id),
        basePrice: it?.basePrice ?? 0,
        types: px?.types ?? undefined,
        sellFor: px?.sellFor ?? [],
        buyFor: px?.buyFor ?? [],
      };
    };

    // ── бартеры: группируем по предмету-награде ──
    const barterByReward: Record<string, RawBarter[]> = {};
    const barterUnlockMap: Record<string, BarterUnlockInfo> = {};
    for (const b of barterRows) {
      const raw: RawBarter = {
        id: b.id,
        trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? "" },
        level: b.level ?? 1,
        taskUnlock: b.taskUnlockId ? { id: b.taskUnlockId, name: b.taskUnlockName ?? undefined } : null,
        requiredItems: b.requiredItems.map((s) => ({ count: s.count, item: lookup(s.itemId) })),
        rewardItems: b.rewardItems.map((s) => ({ count: s.count, item: lookup(s.itemId) })),
      };
      for (const s of b.rewardItems) {
        (barterByReward[s.itemId] ??= []).push(raw);
        if (b.taskUnlockId && !barterUnlockMap[s.itemId]) {
          barterUnlockMap[s.itemId] = {
            taskId: b.taskUnlockId,
            trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? undefined },
          };
        }
      }
    }
    const barterDataMap: Record<string, EftBarterData> = {};
    for (const [id, list] of Object.entries(barterByReward)) {
      const d = buildBarterData(list);
      if (d) barterDataMap[id] = d;
    }

    // ── крафты: группируем по предмету-награде ──
    const craftByReward: Record<string, RawCraft[]> = {};
    for (const c of craftRows) {
      const raw: RawCraft = {
        id: c.id,
        station: { name: c.stationName, normalizedName: c.stationNormalizedName ?? undefined },
        level: c.level ?? 1,
        duration: c.duration ?? 0,
        requiredItems: c.requiredItems.map((s) => ({ count: s.count, item: lookup(s.itemId) })),
        rewardItems: c.rewardItems.map((s) => ({ count: s.count, item: lookup(s.itemId) })),
      };
      for (const s of c.rewardItems) (craftByReward[s.itemId] ??= []).push(raw);
    }
    const craftDataMap: Record<string, EftCraftData> = {};
    for (const [id, list] of Object.entries(craftByReward)) {
      const d = buildCraftData(list);
      if (d) craftDataMap[id] = d;
    }

    // ── GP-монеты: бартеры Рефа, требующие монету GP → id предмета-награды : кол-во GP ──
    // (трейдер GP-монет — Реф/`ref`; старый код проверял `fence` — устарело, давало 0).
    const gpCoinBarters: Record<string, number> = {};
    for (const b of barterRows) {
      if (b.traderNormalizedName !== "ref") continue;
      const gpReq = b.requiredItems.find((s) => s.itemId === GP_COIN_ID);
      if (!gpReq) continue;
      for (const s of b.rewardItems) gpCoinBarters[s.itemId] = gpReq.count || 1;
    }

    return { barterDataMap, barterUnlockMap, craftDataMap, gpCoinBarters };
  } catch (e) {
    console.error("[getEftIndicatorsFromDb]", e);
    return EMPTY;
  }
}
