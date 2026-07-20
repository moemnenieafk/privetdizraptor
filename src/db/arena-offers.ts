// Чтение арена-предложений Рефа из НАШЕГО зеркала (barters + prices + items).
// Рантайм без внешних API (BACKEND AUTONOMY) — источник трогает только синк.
// Математика курса живёт в src/lib/arena-currency.ts, здесь только сборка входа.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { barters, items } from "./schema";
import { eftGameId } from "./eft";
import { getEftPricesByIds } from "./prices";
import { calcFleaFee } from "../lib/barter-calc";
import type { ArenaOffer, ArenaValuationBasis } from "../types/arena-currency";

/** Монета GP — арена-валюта, BSG UID. */
export const GP_COIN_ID = "5d235b4d86f7742e017bc88a";
/** Лега-медаль — арена-валюта, BSG UID. */
export const LEGA_MEDAL_ID = "6656560053eaaa7a23349c86";

const REF = "ref";

/**
 * Рыночная стоимость награды.
 * acquire   — цена покупки на барахолке («сколько сэкономлю»).
 * liquidate — минус комиссия по calcFleaFee («сколько выручу»).
 * null — предмет вне барахолки либо цены нет: такие в кривую не идут.
 */
function rewardValue(
  unitPrice: number | undefined,
  count: number,
  basePrice: number | null,
  isNoFlea: boolean,
  basis: ArenaValuationBasis,
): number | null {
  if (isNoFlea || !unitPrice || unitPrice <= 0) return null;
  const gross = unitPrice * count;
  if (basis === "acquire") return gross;
  const fee = basePrice && basePrice > 0 ? calcFleaFee(basePrice, gross, count) : 0;
  const net = gross - fee;
  return net > 0 ? net : null;
}

/** Собирает предложения Рефа, оплачиваемые только GP и/или Легой. */
export async function getArenaOffers(basis: ArenaValuationBasis): Promise<ArenaOffer[]> {
  const gameId = await eftGameId();

  const rows = await db
    .select({
      id: barters.id,
      level: barters.level,
      requiredItems: barters.requiredItems,
      rewardItems: barters.rewardItems,
    })
    .from(barters)
    .where(and(eq(barters.gameId, gameId), eq(barters.traderNormalizedName, REF)));

  const candidates = rows.flatMap((row) => {
    const required = row.requiredItems ?? [];
    if (required.length === 0) return [];
    // Примесь обычных предметов означает, что это не чистый арена-обмен.
    if (!required.every((s) => s.itemId === GP_COIN_ID || s.itemId === LEGA_MEDAL_ID)) return [];

    const reward = (row.rewardItems ?? [])[0];
    if (!reward) return [];

    const gp = required.find((s) => s.itemId === GP_COIN_ID)?.count ?? 0;
    const lega = required.find((s) => s.itemId === LEGA_MEDAL_ID)?.count ?? 0;
    if (gp === 0 && lega === 0) return [];

    // buyLimit появится после миграции barters.buy_limit — до неё лимит неизвестен.
    return [{ id: row.id, level: row.level ?? 1, buyLimit: null as number | null, gp, lega, reward }];
  });

  if (candidates.length === 0) return [];

  const rewardIds = [...new Set(candidates.map((c) => c.reward.itemId))];
  const [priceMap, itemRows] = await Promise.all([
    getEftPricesByIds(rewardIds),
    db
      .select({ inGameId: items.inGameId, name: items.name, basePrice: items.basePrice })
      .from(items)
      .where(and(eq(items.gameId, gameId), inArray(items.inGameId, rewardIds))),
  ]);
  const itemMap = new Map(itemRows.map((r) => [r.inGameId, r]));

  return candidates.map((c) => {
    const price = priceMap.get(c.reward.itemId);
    const meta = itemMap.get(c.reward.itemId);
    const unit = price?.lastLowPrice ?? price?.avg24hPrice;
    const isNoFlea = price?.types?.includes("noFlea") ?? false;

    return {
      id: c.id,
      rewardId: c.reward.itemId,
      rewardName: meta?.name ?? price?.normalizedName ?? c.reward.itemId,
      rewardCount: c.reward.count,
      gp: c.gp,
      lega: c.lega,
      level: c.level,
      buyLimit: c.buyLimit,
      rewardValue: rewardValue(unit, c.reward.count, meta?.basePrice ?? null, isNoFlea, basis),
    };
  });
}
