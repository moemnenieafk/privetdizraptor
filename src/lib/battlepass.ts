// Математика трекера Боевого Пропуска. Чистые функции, без React — правило проекта (§4.7):
// расчёты живут отдельно от разметки, чтобы их можно было проверять и переиспользовать.
//
// Ядро: игрок отмечает полученные награды. «Нужно всего» — сумма стоимости ВСЕХ наград по типам
// документов; «Потрачено» — сумма по ПОЛУЧЕННЫМ; «Осталось» = нужно − потрачено. Это и есть ответ
// на вопрос «сколько ещё документации налутать».
import {
  BP_ALL_REWARDS,
  BP_DOC_ORDER,
  BP_DOCS,
  BP_PAGES,
  type BpDoc,
  type BpDocType,
  type BpReward,
} from '@/data/eft-battlepass';

export type DocTotals = Record<BpDocType, number>;

const emptyTotals = (): DocTotals =>
  BP_DOC_ORDER.reduce((acc, t) => {
    acc[t] = 0;
    return acc;
  }, {} as DocTotals);

/** Сумма всех документов одной награды (по всем типам). */
export const rewardDocCount = (reward: BpReward): number =>
  Object.values(reward.cost).reduce((s, n) => s + (n ?? 0), 0);

/** Просуммировать стоимость набора наград по типам + гранд-тотал. */
export function sumCost(rewards: readonly BpReward[]): { totals: DocTotals; total: number } {
  const totals = emptyTotals();
  let total = 0;
  for (const r of rewards) {
    for (const t of BP_DOC_ORDER) {
      const n = r.cost[t] ?? 0;
      totals[t] += n;
      total += n;
    }
  }
  return { totals, total };
}

export interface TrackerSummary {
  /** Всего нужно по типам (по всем 53 наградам). */
  needed: DocTotals;
  /** Потрачено (получено) по типам. */
  spent: DocTotals;
  /** Осталось налутать по типам (needed − spent, не ниже 0). */
  remaining: DocTotals;
  neededTotal: number;
  spentTotal: number;
  remainingTotal: number;
  rewardsTotal: number;
  rewardsClaimed: number;
}

/** Полная сводка трекера при текущем наборе полученных наград. */
export function computeSummary(claimed: ReadonlySet<string>): TrackerSummary {
  const claimedRewards = BP_ALL_REWARDS.filter((r) => claimed.has(r.id));
  const all = sumCost(BP_ALL_REWARDS);
  const done = sumCost(claimedRewards);

  const remaining = emptyTotals();
  let remainingTotal = 0;
  for (const t of BP_DOC_ORDER) {
    const left = Math.max(0, all.totals[t] - done.totals[t]);
    remaining[t] = left;
    remainingTotal += left;
  }

  return {
    needed: all.totals,
    spent: done.totals,
    remaining,
    neededTotal: all.total,
    spentTotal: done.total,
    remainingTotal,
    rewardsTotal: BP_ALL_REWARDS.length,
    rewardsClaimed: claimedRewards.length,
  };
}

export interface DocRow {
  doc: BpDoc;
  needed: number;
  spent: number;
  remaining: number;
}

/** Строки сводной таблицы «документ → нужно/получено/осталось» в каноническом порядке. */
export function docRows(summary: TrackerSummary): DocRow[] {
  return BP_DOC_ORDER.map((t) => ({
    doc: BP_DOCS[t],
    needed: summary.needed[t],
    spent: summary.spent[t],
    remaining: summary.remaining[t],
  }));
}

export interface PageProgress {
  page: number;
  total: number;
  claimed: number;
  requires?: { fromPage: number; count: number };
  /** Выполнено ли требование разблокировки (получено достаточно наград с предыдущей страницы). */
  unlocked: boolean;
}

/** Прогресс и статус разблокировки каждой страницы. */
export function computePageProgress(claimed: ReadonlySet<string>): PageProgress[] {
  const claimedByPage = new Map<number, number>();
  for (const p of BP_PAGES) {
    claimedByPage.set(p.page, p.rewards.filter((r) => claimed.has(r.id)).length);
  }

  return BP_PAGES.map((p) => {
    const unlocked = p.requires
      ? (claimedByPage.get(p.requires.fromPage) ?? 0) >= p.requires.count
      : true;
    return {
      page: p.page,
      total: p.rewards.length,
      claimed: claimedByPage.get(p.page) ?? 0,
      requires: p.requires,
      unlocked,
    };
  });
}

/** Сколько рейдо-дней нужно, чтобы налутать `remainingTotal` при дневном лимите `limit`. */
export function etaDays(remainingTotal: number, limit: number): number {
  if (remainingTotal <= 0 || limit <= 0) return 0;
  return Math.ceil(remainingTotal / limit);
}
