import { useInventoryStore } from '@/store/useInventoryStore';
import { useHideoutStore } from '@/store/useHideoutStore';

// Одноразовая миграция (итерация 5): прогресс сбора материалов убежища (useHideoutStore.itemProgress)
// сливается в единый пул владения — схрон (useInventoryStore.ownedItems). Ключ itemProgress —
// `${station}|${level}|${itemId}` (см. hideoutItemKey), itemId = последний сегмент после '|'.
// Идемпотентно: флаг hideoutMerged (persist) гарантирует однократность.
export function migrateHideoutProgressIntoStash(): void {
  const inventory = useInventoryStore.getState();
  if (inventory.hideoutMerged) return;

  const { itemProgress, clearItemProgress } = useHideoutStore.getState();

  // Суммируем count по itemId (у одного предмета может быть много ключей station|level|itemId).
  const sums: Record<string, number> = {};
  for (const [key, count] of Object.entries(itemProgress)) {
    if (count <= 0) continue;
    const itemId = key.slice(key.lastIndexOf('|') + 1);
    if (!itemId) continue;
    sums[itemId] = (sums[itemId] ?? 0) + count;
  }

  const { bumpCount, setHideoutMerged } = useInventoryStore.getState();
  for (const [itemId, sum] of Object.entries(sums)) {
    if (sum > 0) bumpCount(itemId, sum, 99999);
  }

  clearItemProgress();
  setHideoutMerged(true);
}
