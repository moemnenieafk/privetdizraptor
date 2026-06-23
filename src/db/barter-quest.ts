// Серверная читалка: какие бартеры открывает каждый квест (join по taskUnlockId == quest.id).
// Для бейджа «открывает N бартеров» на ноде карты квестов + списка в QuestDetail.
// Читает ТОЛЬКО нашу БД (barters + items + prices). Импорты относительные (как соседи в db/).
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from './index';
import { barters, items } from './schema';
import { eftGameId } from './eft';
import { getEftPriceMapFromDb } from './prices';
import { itemIconUrl } from '@/lib/item-icon';
import type { QuestBarterLite } from '@/types/quest';

/** Record<questId, бартеры, которые этот квест разблокирует>. */
export async function getBartersByQuest(): Promise<Record<string, QuestBarterLite[]>> {
  try {
    const gameId = await eftGameId();
    const [rows, itemRows, priceMap] = await Promise.all([
      db.select().from(barters).where(and(eq(barters.gameId, gameId), isNotNull(barters.taskUnlockId))),
      db.select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName }).from(items).where(eq(items.gameId, gameId)),
      getEftPriceMapFromDb(),
    ]);
    const nameMap = new Map(itemRows.map((r) => [r.inGameId, r]));

    const out: Record<string, QuestBarterLite[]> = {};
    for (const b of rows) {
      const qid = b.taskUnlockId;
      if (!qid) continue;
      (out[qid] ??= []).push({
        id: b.id,
        trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? '' },
        level: b.level ?? 1,
        rewardItems: (b.rewardItems ?? []).map((s) => {
          const i = nameMap.get(s.itemId);
          return {
            id: s.itemId,
            name: i?.name ?? s.itemId,
            shortName: i?.shortName ?? '',
            normalizedName: priceMap.get(s.itemId)?.normalizedName ?? undefined,
            image: itemIconUrl(s.itemId),
            count: s.count,
          };
        }),
      });
    }
    return out;
  } catch (e) {
    console.error('[getBartersByQuest]', e);
    return {};
  }
}
