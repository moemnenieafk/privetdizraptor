import type {
  EftBarterData,
  EftCraftData,
  EftQuestData,
  EftBarterItem,
  EftCraftIngredient,
  EftVendor,
} from '@/components/features/items/EftItemTile/types';
import type { TaskRaw } from '@/types/quest';

// ─── Raw tarkov.dev shapes (global barters / crafts queries) ───────────────────

interface RawPrice {
  price: number;
  priceRUB?: number;
  currency?: string;
  vendor: { name: string; normalizedName?: string };
}

interface RawApiItem {
  id: string;
  name: string;
  shortName?: string;
  image512pxLink?: string;
  basePrice?: number;
  types?: string[];
  sellFor?: RawPrice[];
  buyFor?: RawPrice[];
}

interface RawTradeSlot {
  count: number;
  item: RawApiItem;
}

export interface RawBarter {
  id?: string;
  trader: { name: string; normalizedName: string };
  level: number;
  taskUnlock?: { id: string; name?: string } | null;
  requiredItems: RawTradeSlot[];
  rewardItems: RawTradeSlot[];
}

export interface RawCraft {
  id?: string;
  station: { name: string; normalizedName?: string };
  level: number;
  duration: number;
  requiredItems: RawTradeSlot[];
  rewardItems: RawTradeSlot[];
}

/** Item id → task that gates its barter (derived from barter.taskUnlock). */
export interface BarterUnlockInfo {
  taskId: string;
  trader: EftVendor;
}

// ─── Price helpers (priceRUB ?? price; flea detection) ─────────────────────────

const rub = (p: RawPrice): number => p.priceRUB ?? p.price;
const isFlea = (v: { name: string; normalizedName?: string }): boolean =>
  v.name === 'Flea Market' || v.normalizedName === 'flea-market';

function bestSellRub(item: RawApiItem): number {
  const prices = (item.sellFor ?? []).map(rub).filter((p) => p > 0);
  return prices.length ? Math.max(...prices) : 0;
}

function cheapestBuyRub(item: RawApiItem): number | null {
  const prices = (item.buyFor ?? []).map(rub).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

function fleaSellRub(item: RawApiItem): number {
  const p = (item.sellFor ?? []).find((x) => isFlea(x.vendor));
  return p ? rub(p) : 0;
}

/** Acquisition cost of a trade's required items (cheapest buy, fallback best sell). */
function requiredCost(slots: RawTradeSlot[]): number {
  return slots.reduce((sum, { item, count }) => {
    const unit = cheapestBuyRub(item) ?? bestSellRub(item);
    return sum + unit * count;
  }, 0);
}

function rewardValue(slots: RawTradeSlot[]): number {
  return slots.reduce((sum, { item, count }) => sum + bestSellRub(item) * count, 0);
}

function toSlotItems(slots: RawTradeSlot[]): (EftBarterItem & EftCraftIngredient)[] {
  return slots.map((slot) => ({
    id: slot.item.id,
    name: slot.item.name,
    iconLink: slot.item.image512pxLink,
    count: Math.round(slot.count),
  }));
}

/**
 * Flea-market sales-fee estimate (intelligence centre lvl 0). Standard EFT formula,
 * approximate — precise calibration is a Phase-3 concern.
 */
export function estimateFleaFee(basePrice: number, sellPrice: number, count = 1): number {
  if (basePrice <= 0 || sellPrice <= 0) return 0;
  const Ti = 0.03;
  const Tr = 0.03;
  const vo = basePrice;
  const vr = sellPrice;
  let po = Math.log10(vo / vr);
  let pr = Math.log10(vr / vo);
  if (vr < vo) po = Math.pow(po, 1.08);
  else pr = Math.pow(pr, 1.08);
  const fee = vo * Ti * Math.pow(4, po) * count + vr * Tr * Math.pow(4, pr) * count;
  return Math.round(fee);
}

export function formatCraftDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  if (m > 0) return `${m} мин`;
  return `${seconds} с`;
}

// ─── Builders (pure — run server-side for compact payload) ─────────────────────

/** Picks the most profitable barter yielding the item and maps it to tooltip data. */
export function buildBarterData(barters: RawBarter[] | undefined): EftBarterData | undefined {
  if (!barters || barters.length === 0) return undefined;

  const scored = barters.map((b) => {
    const cost = requiredCost(b.requiredItems);
    return { b, cost, profit: rewardValue(b.rewardItems) - cost };
  });
  const best = scored.reduce((mx, cur) => (cur.profit > mx.profit ? cur : mx), scored[0]);
  const { b, cost } = best;

  const reward = b.rewardItems[0]?.item;
  const rewardCount = b.rewardItems[0]?.count ?? 1;
  const rewardBuy = reward ? cheapestBuyRub(reward) : null;
  const savings = rewardBuy != null ? Math.round(rewardBuy * rewardCount - cost) : 0;
  const commission = reward
    ? estimateFleaFee(reward.basePrice ?? 0, fleaSellRub(reward), rewardCount)
    : 0;

  return {
    trader: { name: b.trader.name, normalizedName: b.trader.normalizedName },
    items: toSlotItems(b.requiredItems),
    buyPrice: Math.round(cost),
    savings,
    profit: Math.round(best.profit),
    commission,
  };
}

/** Picks the most profitable craft yielding the item and maps it to tooltip data. */
export function buildCraftData(crafts: RawCraft[] | undefined): EftCraftData | undefined {
  if (!crafts || crafts.length === 0) return undefined;

  const scored = crafts.map((c) => {
    const cost = requiredCost(c.requiredItems);
    const sell = rewardValue(c.rewardItems);
    return { c, cost, sell, profit: sell - cost };
  });
  const best = scored.reduce((mx, cur) => (cur.profit > mx.profit ? cur : mx), scored[0]);
  const { c, cost, sell, profit } = best;

  const hours = c.duration > 0 ? c.duration / 3600 : 0;

  return {
    stationLevel: c.level,
    stationName: c.station.name,
    ingredients: toSlotItems(c.requiredItems),
    durationLabel: formatCraftDuration(c.duration),
    buyPrice: Math.round(cost),
    turnoverPerHour: hours > 0 ? Math.round(sell / hours) : 0,
    profit: Math.round(profit),
    profitPerHour: hours > 0 ? Math.round(profit / hours) : 0,
  };
}

// ─── Quest indicators ──────────────────────────────────────────────────────────
//
// Split in two: definitions are built server-side from the static EFT_QUESTS (the
// store's runtime `tasks` is empty outside the quest map and is not persisted), and
// live player progress is overlaid client-side from the persisted quest store.

/** Per-item refs the client needs to overlay live progress onto a definition. */
export interface QuestProgressRef {
  taskId: string;
  // task_progress: the single hand-in objective
  objectiveId?: string;
  count?: number;
  // unlock_trade: per-objective refs, aligned 1:1 with EftQuestData.objectives
  objectives?: { id: string; count: number }[];
}

/**
 * Server-side: builds `itemId → EftQuestData` definitions (no player progress) plus
 * the refs needed to overlay it later.
 * - `task_progress` ("ТРЕБУЕТСЯ ПО ЗАДАНИЮ"): item is a hand-in objective of a task.
 * - `unlock_trade` ("ПОБОЧНОЕ ЗАДАНИЕ"): item's barter is gated by a task (no
 *   `offerUnlock` in static data, so trader-offer unlocks are out of scope — plan R1).
 * task_progress wins when an item is both.
 */
export function buildQuestIndicators(
  tasks: TaskRaw[],
  unlockByItem: Record<string, BarterUnlockInfo>,
): { dataMap: Record<string, EftQuestData>; refMap: Record<string, QuestProgressRef> } {
  const dataMap: Record<string, EftQuestData> = {};
  const refMap: Record<string, QuestProgressRef> = {};

  for (const task of tasks) {
    for (const obj of task.objectives) {
      if (obj.__typename !== 'TaskObjectiveItem' || !obj.item) continue;
      const itemId = obj.item.id;
      if (dataMap[itemId]) continue;
      const count = obj.count ?? 0;
      dataMap[itemId] = {
        type: 'task_progress',
        questName: task.name,
        npcName: task.trader.name,
        npcImageLink: task.trader.imageLink,
        description: obj.description,
        progress: `0 / ${count}`,
        status: 'not_started',
      };
      refMap[itemId] = { taskId: task.id, objectiveId: obj.id, count };
    }
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const [itemId, info] of Object.entries(unlockByItem)) {
    if (dataMap[itemId]) continue; // task_progress has priority
    const task = taskById.get(info.taskId);
    if (!task) continue;
    dataMap[itemId] = {
      type: 'unlock_trade',
      questName: task.name,
      npcName: task.trader.name,
      npcImageLink: task.trader.imageLink,
      traderName: info.trader.name,
      status: 'not_started',
      objectives: task.objectives.map((o) => ({ description: o.description, completed: false })),
    };
    refMap[itemId] = {
      taskId: task.id,
      objectives: task.objectives.map((o) => ({
        id: o.id,
        count: o.__typename === 'TaskObjectiveItem' ? (o.count ?? 0) : 0,
      })),
    };
  }

  return { dataMap, refMap };
}

/** Client-side: overlays live status/progress from the persisted quest store. */
export function applyQuestProgress(
  dataMap: Record<string, EftQuestData>,
  refMap: Record<string, QuestProgressRef>,
  completedQuests: string[],
  itemProgress: Record<string, Record<string, number>>,
): Map<string, EftQuestData> {
  const completed = new Set(completedQuests);
  const map = new Map<string, EftQuestData>();

  for (const [itemId, base] of Object.entries(dataMap)) {
    const ref = refMap[itemId];
    if (!ref) { map.set(itemId, base); continue; }
    const taskDone = completed.has(ref.taskId);

    if (base.type === 'task_progress') {
      const count = ref.count ?? 0;
      const raw = ref.objectiveId ? itemProgress[ref.taskId]?.[ref.objectiveId] ?? 0 : 0;
      const found = Math.min(count, raw);
      map.set(itemId, {
        ...base,
        progress: `${found} / ${count}`,
        status: taskDone ? 'completed' : found > 0 ? 'in_progress' : 'not_started',
      });
    } else {
      const objectives = base.objectives.map((o, i) => {
        const r = ref.objectives?.[i];
        const done = taskDone || (!!r && r.count > 0 && (itemProgress[ref.taskId]?.[r.id] ?? 0) >= r.count);
        return { ...o, completed: done };
      });
      map.set(itemId, {
        ...base,
        objectives,
        status: taskDone ? 'completed' : objectives.some((o) => o.completed) ? 'in_progress' : 'not_started',
      });
    }
  }

  return map;
}
