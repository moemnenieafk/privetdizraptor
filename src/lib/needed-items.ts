// Консолидированный ридер объединённого трекера «Важные предметы» (RSC-only).
// Собирает индекс «предмет → кому нужен» из статических квестов (по режиму профиля) +
// зеркала убежища. Категории целей (решение important-items-merge):
//   • single-item (giveItem/findItem/plantItem/sellItem с .item) → per-item агрегат;
//   • any-of (o.anyOf + acceptedItems[]) → отдельная «групповая строка» «N из категории»;
//   • квест-предметы (findQuestItem/…) → per-item, флаг isQuestItem (только рейд, нельзя купить).
// FiR — per-source (и квесты, и убежище). Имена/иконки — наш Storage (itemIconUrl), не baked.
import { getQuests, type QuestMode } from '@/data/quests';
import { getHideoutNeeds } from '@/db/hideout';
import { itemIconUrl } from '@/lib/item-icon';
import type { TaskObjectiveItem } from '@/types/quest';

export type NeededMode = QuestMode;

export interface NeededQuestSource {
  questId: string;
  questName: string;
  trader: string;
  objectiveId: string;
  count: number;
  fir: boolean;
  /** giveItem | findItem | plantItem | sellItem | findQuestItem | … */
  type: string;
}
export interface NeededHideoutSource {
  station: string;
  stationName: string;
  level: number;
  count: number;
  fir: boolean;
}
export interface NeededItem {
  itemId: string;
  itemName: string;
  itemShort: string;
  itemIcon: string;
  quests: NeededQuestSource[];
  hideout: NeededHideoutSource[];
  /** Предмет — квест-предмет (только рейд, нельзя купить/застэшить). */
  isQuestItem: boolean;
  /** Сумма нужного по всем источникам. */
  neededTotal: number;
  /** Из neededTotal — сколько должно быть FiR. */
  neededFir: number;
}
export interface NeededGroupVariant {
  id: string;
  name: string;
  shortName: string;
  icon: string;
}
export interface NeededGroup {
  /** objectiveId — стабильный ключ строки-группы. */
  key: string;
  questId: string;
  questName: string;
  trader: string;
  count: number;
  fir: boolean;
  /** Принимаемые варианты (любой из них засчитывается). */
  accepted: NeededGroupVariant[];
}
export interface NeededData {
  items: NeededItem[];
  groups: NeededGroup[];
}

const REAL = new Set(['giveItem', 'findItem', 'plantItem', 'sellItem']);
const QITEM = new Set(['findQuestItem', 'giveQuestItem', 'plantQuestItem']);

/** Собрать индекс нужных предметов для режима (regular/pve). RSC-only (читает зеркало убежища). */
export async function buildNeededItems(mode: NeededMode = 'regular'): Promise<NeededData> {
  const quests = getQuests(mode);
  const items = new Map<string, NeededItem>();
  const groups: NeededGroup[] = [];

  const ensure = (id: string, name: string, short: string): NeededItem => {
    let ni = items.get(id);
    if (!ni) {
      ni = {
        itemId: id,
        itemName: name,
        itemShort: short,
        itemIcon: itemIconUrl(id),
        quests: [],
        hideout: [],
        isQuestItem: false,
        neededTotal: 0,
        neededFir: 0,
      };
      items.set(id, ni);
    }
    return ni;
  };

  for (const t of quests) {
    for (const o of t.objectives) {
      if (o.__typename !== 'TaskObjectiveItem') continue;
      const oi = o as TaskObjectiveItem;
      const isQItem = QITEM.has(oi.type);
      if (!isQItem && !REAL.has(oi.type)) continue;

      // any-of → отдельная групповая строка (не мержим в per-item)
      if (oi.anyOf && Array.isArray(oi.acceptedItems) && oi.acceptedItems.length > 1) {
        groups.push({
          key: oi.id,
          questId: t.id,
          questName: t.name,
          trader: t.trader.name,
          count: oi.count ?? 1,
          fir: !!oi.foundInRaid,
          accepted: oi.acceptedItems.map((a) => ({
            id: a.id,
            name: a.name,
            shortName: a.shortName,
            icon: itemIconUrl(a.id),
          })),
        });
        continue;
      }

      if (!oi.item) continue; // нерезолвнутый предмет → пропуск (§4.4)
      const ni = ensure(oi.item.id, oi.item.name, oi.item.shortName);
      ni.quests.push({
        questId: t.id,
        questName: t.name,
        trader: t.trader.name,
        objectiveId: oi.id,
        count: oi.count ?? 1,
        fir: !!oi.foundInRaid,
        type: oi.type,
      });
      if (isQItem) ni.isQuestItem = true;
    }
  }

  // Убежище — из зеркала (уже агрегировано по предмету, FiR в sources).
  const hideout = await getHideoutNeeds();
  for (const h of hideout) {
    const ni = ensure(h.itemId, h.itemName, h.itemShort);
    if (!ni.itemName) ni.itemName = h.itemName;
    if (!ni.itemShort) ni.itemShort = h.itemShort;
    for (const s of h.sources) {
      ni.hideout.push({
        station: s.station,
        stationName: s.stationName,
        level: s.level,
        count: s.count,
        fir: !!s.fir,
      });
    }
  }

  for (const ni of items.values()) {
    let total = 0;
    let fir = 0;
    for (const q of ni.quests) {
      total += q.count;
      if (q.fir) fir += q.count;
    }
    for (const h of ni.hideout) {
      total += h.count;
      if (h.fir) fir += h.count;
    }
    ni.neededTotal = total;
    ni.neededFir = fir;
  }

  const list = [...items.values()].sort(
    (a, b) => b.neededTotal - a.neededTotal || a.itemName.localeCompare(b.itemName),
  );
  return { items: list, groups };
}
