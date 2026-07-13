// Восстановление слотов у деталей пресета.
//
// tarkov.dev отдаёт containsItems БЕЗ информации о слоте (проверено на живом синке:
// 3789 из 3789 деталей без slotNameId). Поэтому выводим слот сами: у нас есть
// allowedItemIds по каждому слоту, значит для детали можно найти слот, который её
// принимает. Обходим дерево слотов вширь от базы: поставили планку — открылись её
// слоты — в них садятся прицел и рукоять.
//
// Надёжнее атрибутов: не зависит от того, что источник решит отдать в следующем патче.
import type { EftSlot, EftWeaponsDump } from "@/lib/eft-weapons";

/** Слот, открытый для заполнения: сам слот + путь до него от корня. */
interface OpenSlot {
  slot: EftSlot;
  /** Кто владеет слотом: база или уже поставленный модуль. */
  ownerItemId: string;
}

/**
 * Проставляет slotNameId деталям каждого пресета. Мутирует dump.presets на месте —
 * зовётся ровно один раз, в конце getEftWeaponsDump().
 *
 * Возвращает счётчики для диагностики синка.
 */
export function resolvePresetSlots(dump: EftWeaponsDump): {
  resolved: number;
  unresolved: number;
} {
  const slotsByItem = new Map<string, EftSlot[]>();
  for (const b of dump.bases) slotsByItem.set(b.itemId, b.slots);
  for (const p of dump.parts) {
    if (p.slots.length > 0) slotsByItem.set(p.itemId, p.slots);
  }

  let resolved = 0;
  let unresolved = 0;

  for (const preset of dump.presets) {
    // Детали, которые ещё не пристроены. Дубликаты возможны (две одинаковые планки).
    const pending = preset.parts.filter((p) => p.slotNameId === "");
    if (pending.length === 0) continue;

    const open: OpenSlot[] = (slotsByItem.get(preset.baseItemId) ?? []).map((slot) => ({
      slot,
      ownerItemId: preset.baseItemId,
    }));
    const placed = new Set<string>(); // ownerItemId|slotId — занятые слоты

    // Обход вширь: за проход пристраиваем всё, что влезает в открытые слоты,
    // и открываем слоты только что поставленных модулей. Повторяем, пока есть прогресс.
    let progress = true;
    while (progress) {
      progress = false;

      for (const slot of open) {
        const key = `${slot.ownerItemId}|${slot.slot.slotId}`;
        if (placed.has(key)) continue;

        const allowed = new Set(slot.slot.allowedItemIds);
        const hit = pending.find((p) => p.slotNameId === "" && allowed.has(p.itemId));
        if (!hit) continue;

        hit.slotNameId = slot.slot.nameId;
        placed.add(key);
        resolved++;
        progress = true;

        // Поставленный модуль открывает свои слоты (планка → крышка → прицел).
        for (const child of slotsByItem.get(hit.itemId) ?? []) {
          open.push({ slot: child, ownerItemId: hit.itemId });
        }
      }
    }

    unresolved += pending.filter((p) => p.slotNameId === "").length;
  }

  return { resolved, unresolved };
}