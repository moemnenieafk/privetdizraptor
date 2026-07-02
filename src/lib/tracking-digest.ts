// Server-агрегаты для вкладки «Трекинг» (Аккаунт Центр) — домены «Задания» и «Предметы».
// ВАЖНО: импортирует EFT_QUESTS (520 задач, тяжёлый статик) — использовать ТОЛЬКО в RSC
// (account/page.tsx). В клиент уходят лёгкие агрегаты, не полный массив.
// Решения: docs/decisions/tracking-side-quests.md + tracking-needed-items.md.
import { inArray, and, eq } from 'drizzle-orm';
import { EFT_QUESTS } from '@/data/quests';
import type { TaskObjectiveItem } from '@/types/quest';
import { db } from '@/db';
import { prices } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { CURRENCY_IDS } from '@/db/hideout';

/** Лёгкая карточка квеста: для вотчлиста pinned и подсчёта done по торговцам. */
export interface QuestLite {
  name: string;
  /** normalizedName торговца (фото = /images/traders/eft/<nn>.webp) */
  trader: string;
  kappa?: 1;
  lk?: 1;
  /** minPlayerLevel, если > 1 */
  lvl?: number;
}

export interface TraderQuestTotal {
  normalizedName: string;
  name: string;
  total: number;
}

/** Плоское квестовое требование предмета (TaskObjectiveItem). Иконка — itemIconUrl(itemId) на клиенте. */
export interface QuestItemReq {
  questId: string;
  questName: string;
  objectiveId: string;
  itemId: string;
  name: string;
  short: string;
  count: number;
  fir: boolean;
  /** Валюта/патроны: в трекинге считаются «весь стек = 1 шт.» (не суммировать рубли/патроны). */
  stackAsOne?: boolean;
}

export interface QuestsDigestData {
  questLite: Record<string, QuestLite>;
  traders: TraderQuestTotal[];
  kappaTotal: number;
  lightkeeperTotal: number;
  totalQuests: number;
  itemRequirements: QuestItemReq[];
}

const isItemObjective = (o: { __typename?: string }): o is TaskObjectiveItem =>
  o.__typename === 'TaskObjectiveItem';

export async function buildQuestsDigest(): Promise<QuestsDigestData> {
  const questLite: Record<string, QuestLite> = {};
  const traderMap = new Map<string, TraderQuestTotal>();
  const itemRequirements: QuestItemReq[] = [];
  let kappaTotal = 0;
  let lightkeeperTotal = 0;

  for (const t of EFT_QUESTS) {
    const lite: QuestLite = { name: t.name, trader: t.trader.normalizedName };
    if (t.kappaRequired) {
      lite.kappa = 1;
      kappaTotal++;
    }
    if (t.lightkeeperRequired) {
      lite.lk = 1;
      lightkeeperTotal++;
    }
    if (t.minPlayerLevel > 1) lite.lvl = t.minPlayerLevel;
    questLite[t.id] = lite;

    const tr =
      traderMap.get(t.trader.normalizedName) ??
      { normalizedName: t.trader.normalizedName, name: t.trader.name, total: 0 };
    tr.total++;
    traderMap.set(t.trader.normalizedName, tr);

    for (const o of t.objectives) {
      if (!isItemObjective(o) || !o.item?.id) continue;
      itemRequirements.push({
        questId: t.id,
        questName: t.name,
        objectiveId: o.id,
        itemId: o.item.id,
        name: o.item.name,
        short: o.item.shortName,
        count: o.count,
        fir: o.foundInRaid,
      });
    }
  }

  // Валюта/патроны = «стек за 1 шт.» (не суммируем рубли и пачки патронов в счётчиках).
  // Валюта — по известным id; патроны — по types зеркала prices ('ammo').
  try {
    const ids = [...new Set(itemRequirements.map((r) => r.itemId))].filter((id) => !CURRENCY_IDS.has(id));
    const ammoIds = new Set<string>();
    if (ids.length > 0) {
      const gameId = await eftGameId();
      const rows = await db
        .select({ inGameId: prices.inGameId, types: prices.types })
        .from(prices)
        .where(and(eq(prices.gameId, gameId), inArray(prices.inGameId, ids)));
      for (const r of rows) if (r.types?.includes('ammo')) ammoIds.add(r.inGameId);
    }
    for (const r of itemRequirements) {
      if (CURRENCY_IDS.has(r.itemId) || ammoIds.has(r.itemId)) r.stackAsOne = true;
    }
  } catch (e) {
    // Фолбэк без БД: хотя бы валюту помечаем по известным id.
    console.error('[tracking-digest] types lookup:', e);
    for (const r of itemRequirements) if (CURRENCY_IDS.has(r.itemId)) r.stackAsOne = true;
  }

  return {
    questLite,
    traders: [...traderMap.values()].sort((a, b) => b.total - a.total),
    kappaTotal,
    lightkeeperTotal,
    totalQuests: EFT_QUESTS.length,
    itemRequirements,
  };
}
