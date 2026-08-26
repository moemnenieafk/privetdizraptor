import type { TaskObjective, TaskObjectiveItem } from '@/types/quest';
import { useInventoryStore } from '@/store/useInventoryStore';

// Квест-предметы (findQuestItem/giveQuestItem/plantQuestItem) — НЕ реальные предметы инвентаря,
// в схрон их не кладём. Синкаем только ОБЫЧНЫЕ предметы, помеченные «найдено в рейде».
const QUEST_ITEM_TYPES = new Set(['findQuestItem', 'giveQuestItem', 'plantQuestItem']);

/** Цель, которую зеркалим в схрон: item-цель + найдено в рейде + обычный предмет (не квест-предмет). */
export function isFirStashObjective(obj: TaskObjective): boolean {
  if (obj.__typename !== 'TaskObjectiveItem') return false;
  const o = obj as TaskObjectiveItem;
  return !!o.foundInRaid && !!o.item?.id && !QUEST_ITEM_TYPES.has(o.type);
}

/**
 * Зеркалим изменение собранного кол-ва FiR-предмета квеста в схрон (/eft/progress/stash):
 * положительная дельта — добавить в схрон, отрицательная — убрать. Клампится [0, ∞) стором.
 */
export function syncStashDelta(itemId: string, delta: number): void {
  if (!delta) return;
  useInventoryStore.getState().bumpCount(itemId, delta, Number.MAX_SAFE_INTEGER);
}
