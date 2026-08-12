import type { MapViewMarker } from './map-types';
import type { EditorialMarkerData } from './EditorialMarkerCard';
import { isItemId } from '@/data/map-marker-icons';

/**
 * ФАЗА 0 «единой системы маркеров» (docs/decisions/unified-markers.md): МОСТ НА ЧТЕНИИ.
 * Editorial-маркеры (Wizard/CMS) живут в изолированной таблице/рендере и НЕ попадают в
 * drawer-секции/фильтр/ПКМ-цикл синканого слоя. Пока полноценная единая таблица не заведена
 * (Фазы 1–5), выражаем editorial на языке `MapViewMarker` — чтобы деривации drawer'а
 * (`containerGroups`/`looseTiles`) и индекс позиций (`positionsByLayerRef`) видели их наравне
 * с синканными. Мост обратим: убрать этот модуль и его два вызова — поведение вернётся 1:1.
 *
 * ВАЖНО: это НЕ рендер маркеров (их рисует свой editorial-слой) — только нормализация для
 * ЧТЕНИЯ (счётчики/тайлы/цикл). Двойного рендера нет: консюмеры берут отсюда лишь производные.
 */

/** Вокабуляр типов editorial → synced (`layerKeyForMarker` знает только synced-имена). */
const EDITORIAL_TYPE_TO_VIEW: Record<string, string> = {
  loot: 'loot_loose',
  container: 'loot_container',
  stationary: 'stationary_weapon',
};

const avg = (nums: number[]): number => nums.reduce((s, n) => s + n, 0) / nums.length;

/**
 * Нормализует пачку editorial-маркеров в `MapViewMarker[]`.
 * @param markers  editorial-маркеры карты (уже без `hidden` — как приходят в проп карты).
 * @param lootCatFor  классификатор loose-лута (itemId → одна из 15 категорий). Инъекция, т.к.
 *                    считается из каталога+прайса (серверные данные) — тот же путь, что синканные.
 */
export function buildEditorialBridge(
  markers: EditorialMarkerData[],
  lootCatFor: (itemId: string) => string,
  /** Резолвер имени предмета (itemId → ru-имя) для поиска по лут-пулу. Инъекция из каталога. */
  lootNameFor?: (itemId: string) => string | undefined,
): MapViewMarker[] {
  return markers.map((e, i) => {
    const type = EDITORIAL_TYPE_TO_VIEW[e.type] ?? e.type;
    // Лут-пул: имена всех возможных предметов спота — чтобы поиск на локации находил по любому из них.
    const lootItemNames =
      e.lootItems && e.lootItems.length > 0
        ? e.lootItems.map((id) => lootNameFor?.(id)).filter((n): n is string => !!n)
        : null;

    // Область-лассо (polygon) — точки нет, берём центроид (как editorial-рендер для капли зоны).
    const position =
      e.polygon && e.polygon.length > 0
        ? { x: avg(e.polygon.map((p) => p.x)), y: e.y ?? 0, z: avg(e.polygon.map((p) => p.z)) }
        : { x: e.x, y: e.y ?? 0, z: e.z };

    // Editorial loose хранит предмет в `category` (id 24-hex); замок — ключ в `linkId` (linkKind='item')
    // → чтобы секция «Ключи» (реверс Ключ→Двери) видела editorial-замки наравне с синканными.
    const linkedItemId =
      type === 'loot_loose' && isItemId(e.category)
        ? (e.category ?? null)
        : type === 'lock' && e.linkKind === 'item' && e.linkId
          ? e.linkId
          : null;
    const lootCat =
      type === 'loot_loose' ? (linkedItemId ? lootCatFor(linkedItemId) : 'others') : null;

    return {
      id: e.id ?? `editorial-${i}`,
      type,
      position,
      outline: null,
      top: null,
      bottom: null,
      label: e.title || null,
      faction: e.faction ?? null,
      sides: null,
      categories: null,
      linkedItemId,
      // Editorial container: `category` = ключ категории (weapon-box/jacket/…) → `containerFile`.
      category: e.category ?? null,
      lootCat,
      lootItemNames,
      meta: null,
      floor: e.floor ?? null,
    } satisfies MapViewMarker;
  });
}
