// RSC-only ридер графа «воронки добычи» из нашего зеркала Supabase (§4.11 CLAUDE).
//
// Собирает FunnelGraph для чистого движка src/lib/acquisition-funnel.ts из таблиц
// `barters` / `crafts` / `prices` (только gameId EFT). Никаких внешних вызовов —
// читаем строго зеркало. Чистое чтение, дёргается из RSC/страницы.
//
// buy-карта: trader = min buyFor БЕЗ барахолки (в ₽, через priceRUB ?? price);
// flea = оффер барахолки (normalizedName 'flea-market' / name 'Flea Market').
// Индексация бартеров/крафтов ПО ПРЕДМЕТУ-НАГРАДЕ (rewardItems[].itemId → массив);
// outCount = count того же предмета в rewardItems.
import { eq } from "drizzle-orm";
import { db } from "./index";
import { barters, crafts, prices, type PriceVendorOffer, type TradeSlot } from "./schema";
import { eftGameId } from "./eft";
import { FLEA_NORMALIZED_NAME, FLEA_VENDOR_RU } from "@/lib/tarkov-labels";
import type { FunnelGraph, FunnelBuy, FunnelRecipe } from "@/lib/acquisition-funnel";
import { memoTTL } from "@/lib/server-cache";

// Граф собирается из barters/crafts/prices (цены освежаются часовым кроном) — кэшируем
// в памяти инстанса на час. Страница bitcoin-profit стала force-dynamic после закрытия
// порта 5432 (§4.11), memoTTL гасит три полнотабличных чтения на каждый запрос.
const ACQUISITION_GRAPH_TTL_MS = 60 * 60 * 1000;

/** Оффер = барахолка? (normalizedName 'flea-market' либо имя 'Flea Market'/'Барахолка'). */
function isFleaOffer(o: PriceVendorOffer): boolean {
  const nn = o.vendor?.normalizedName;
  if (nn === FLEA_NORMALIZED_NAME) return true;
  const name = o.vendor?.name;
  return name === "Flea Market" || name === FLEA_VENDOR_RU;
}

/** Цена оффера в ₽ (валютные офферы торговцев несут priceRUB). null если цены нет. */
function offerRub(o: PriceVendorOffer): number | null {
  const v = o.priceRUB ?? o.price;
  return typeof v === "number" && v > 0 ? v : null;
}

/** Строит buy-карту: itemId → { trader: min без флиа, flea, traderName }. */
function buildBuyMap(
  rows: { inGameId: string; buyFor: PriceVendorOffer[] | null }[],
): Map<string, FunnelBuy> {
  const map = new Map<string, FunnelBuy>();
  for (const r of rows) {
    let trader: number | null = null;
    let traderName: string | undefined;
    let traderNormalizedName: string | undefined;
    let flea: number | null = null;
    for (const o of r.buyFor ?? []) {
      const rub = offerRub(o);
      if (rub == null) continue;
      if (isFleaOffer(o)) {
        if (flea == null || rub < flea) flea = rub;
      } else if (trader == null || rub < trader) {
        trader = rub;
        traderName = o.vendor?.name;
        // normalizedName торговца — для аватара/тинта (traderImg ждёт его, а не display-имя).
        traderNormalizedName = o.vendor?.normalizedName ?? undefined;
      }
    }
    // Пустой оффер-лист тоже кладём — предмет существует в прайсе (может быть листом воронки).
    map.set(r.inGameId, {
      trader,
      flea,
      ...(traderName ? { traderName } : {}),
      ...(traderNormalizedName ? { traderNormalizedName } : {}),
    });
  }
  return map;
}

/** Индексирует рецепты по предмету-награде: rewardItems[].itemId → FunnelRecipe[]. */
function indexByReward(
  rows: {
    id: string;
    sourceName: string;
    level: number | null;
    requiredItems: TradeSlot[];
    rewardItems: TradeSlot[];
  }[],
): Map<string, FunnelRecipe[]> {
  const map = new Map<string, FunnelRecipe[]>();
  for (const r of rows) {
    for (const reward of r.rewardItems) {
      const recipe: FunnelRecipe = {
        id: r.id,
        sourceName: r.sourceName,
        level: r.level,
        inputs: r.requiredItems,
        outCount: reward.count > 0 ? reward.count : 1,
      };
      const arr = map.get(reward.itemId);
      if (arr) arr.push(recipe);
      else map.set(reward.itemId, [recipe]);
    }
  }
  return map;
}

/** Собирает FunnelGraph из зеркала (barters/crafts/prices, gameId EFT). RSC-only. */
export async function getAcquisitionGraph(): Promise<FunnelGraph> {
  return memoTTL("eft-acquisition-graph", ACQUISITION_GRAPH_TTL_MS, async () => {
  const gameId = await eftGameId();

  const [priceRows, barterRows, craftRows] = await Promise.all([
    db
      .select({ inGameId: prices.inGameId, buyFor: prices.buyFor })
      .from(prices)
      .where(eq(prices.gameId, gameId)),
    db
      .select({
        id: barters.id,
        traderName: barters.traderName,
        level: barters.level,
        requiredItems: barters.requiredItems,
        rewardItems: barters.rewardItems,
      })
      .from(barters)
      .where(eq(barters.gameId, gameId)),
    db
      .select({
        id: crafts.id,
        stationName: crafts.stationName,
        level: crafts.level,
        requiredItems: crafts.requiredItems,
        rewardItems: crafts.rewardItems,
      })
      .from(crafts)
      .where(eq(crafts.gameId, gameId)),
  ]);

  return {
    buy: buildBuyMap(priceRows),
    bartersByReward: indexByReward(
      barterRows.map((b) => ({
        id: b.id,
        sourceName: b.traderName,
        level: b.level,
        requiredItems: b.requiredItems,
        rewardItems: b.rewardItems,
      })),
    ),
    craftsByReward: indexByReward(
      craftRows.map((c) => ({
        id: c.id,
        sourceName: c.stationName,
        level: c.level,
        requiredItems: c.requiredItems,
        rewardItems: c.rewardItems,
      })),
    ),
  };
  });
}
