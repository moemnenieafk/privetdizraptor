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
 * положительная дельта — добавить в схрон, отрицательная — убрать. Добавленные ячейки СРАЗУ
 * помечаются «найдено в рейде» (та же метка firUnits, что ставит кнопка в «Мой Схрон»).
 * Ключ ячейки — `${itemId}#${index}` (квест-FiR-предметы нестакаемые → 1 предмет = 1 ячейка).
 */
export function syncStashDelta(itemId: string, delta: number): void {
  if (!delta) return;
  const store = useInventoryStore.getState();
  const before = store.ownedItems[itemId] ?? 0;
  store.bumpCount(itemId, delta, Number.MAX_SAFE_INTEGER);
  const after = useInventoryStore.getState().ownedItems[itemId] ?? 0;
  const setFirUnit = useInventoryStore.getState().setFirUnit;
  if (after > before) {
    for (let i = before; i < after; i++) setFirUnit(`${itemId}#${i}`, true);
  } else if (after < before) {
    for (let i = after; i < before; i++) setFirUnit(`${itemId}#${i}`, false);
  }
}
