// src/lib/stash-stacks.ts
// Чистая, детерминированная разбивка предметов на стеки-юниты по стек-лимитам.
// Без React, без побочек, без Date/random — одинаковый вход даёт одинаковый выход.
// Каждый StackUnit.key → передаётся в packer как StashEntry.id (packer агностичен к ключу).

export interface OwnedStackInput {
  itemId: string;
  count: number;
  gridWidth: number;
  gridHeight: number;
  rarity?: string;
  stackMaxSize?: number;
}

export interface StackUnit {
  key: string; // `${itemId}#${i}` — уникален (у предмета может быть несколько стеков)
  itemId: string;
  stackCount: number; // размер конкретного стека (последний = остаток)
  gridWidth: number;
  gridHeight: number;
  rarity?: string;
  // Проставляется ТОЛЬКО на последнем возвращённом стеке при обрезке по MAX_STACKS_PER_ITEM:
  // сколько юнитов предмета НЕ поместилось (для UI-бейджа «+N»). Иначе поля нет.
  overflowRemaining?: number;
}

// Гард переполнения: максимум стеков на один предмет.
export const MAX_STACKS_PER_ITEM = 500;

/**
 * Разбивает каждый предмет на стеки-юниты по его stackMaxSize.
 * S = stackMaxSize && >0 ? stackMaxSize : 1; nStacks = ceil(count/S).
 * Полные стеки по S, последний — остаток count - (nStacks-1)*S. count<=0 → 0 стеков.
 * При nStacks > MAX_STACKS_PER_ITEM возвращаются первые MAX_STACKS_PER_ITEM стеков,
 * а на последнем проставляется overflowRemaining = count - MAX_STACKS_PER_ITEM*S.
 * Порядок стабилен: по входному массиву, затем по индексу i.
 */
export function expandToStacks(items: OwnedStackInput[]): StackUnit[] {
  const units: StackUnit[] = [];

  for (const item of items) {
    if (item.count <= 0) continue;

    const s = item.stackMaxSize && item.stackMaxSize > 0 ? item.stackMaxSize : 1;
    const nStacks = Math.ceil(item.count / s);
    const emitted = Math.min(nStacks, MAX_STACKS_PER_ITEM);

    for (let i = 0; i < emitted; i++) {
      const isLastFull = i === nStacks - 1;
      const stackCount = isLastFull ? item.count - (nStacks - 1) * s : s;

      const unit: StackUnit = {
        key: `${item.itemId}#${i}`,
        itemId: item.itemId,
        stackCount,
        gridWidth: item.gridWidth,
        gridHeight: item.gridHeight,
      };
      if (item.rarity !== undefined) unit.rarity = item.rarity;

      // Обрезка: на последнем выданном стеке помечаем непоместившийся остаток.
      if (i === emitted - 1 && nStacks > MAX_STACKS_PER_ITEM) {
        unit.overflowRemaining = item.count - MAX_STACKS_PER_ITEM * s;
      }

      units.push(unit);
    }
  }

  return units;
}
