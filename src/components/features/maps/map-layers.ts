import type { MapViewMarker } from './map-types';
import { spawnSubkind, containerFile, type MarkerIconInput } from '@/data/map-marker-icons';

/**
 * Таксономия СЛОЁВ интерактивной карты — единая точка правды для рендера (группировка
 * маркеров в L.LayerGroup) и для drawer'а «Слои». Дерево: группа → под-слой (лист) ИЛИ
 * раскрываемый узел с детьми-листьями (Контейнеры → типы, Случайная добыча → категории).
 * Ключ слоя маркера считает `layerKeyForMarker`. Иконку под-слоя даёт `sample` (резолвер).
 */

export interface LayerItem {
  /** ключ листа = ключ L.LayerGroup + состояние видимости (для узла с children — синтетический). */
  key: string;
  label: string;
  sample: MarkerIconInput;
  defaultOff?: boolean;
  /** раскрываемый узел: дети-листья (сам узел слоем не является — тумблер всех детей). */
  children?: LayerItem[];
}

export interface LayerGroup {
  group: string;
  items: LayerItem[];
}

/* ── Контейнеры: файл иконки → ru-подпись (дедуп по файлу; пустые скрывает drawer) ── */
const CONTAINER_SUBLAYERS: { file: string; label: string }[] = [
  { file: 'sportsbag', label: 'Спортивная сумка' },
  { file: 'weaponbox-5x5', label: 'Оружейный ящик' },
  { file: 'toolbox', label: 'Ящик с инструментами' },
  { file: 'wooden-crate', label: 'Деревянный ящик' },
  { file: 'jacket', label: 'Куртка' },
  { file: 'pc-block', label: 'Системный блок' },
  { file: 'drawer', label: 'Выдвижной ящик' },
  { file: 'cash-register', label: 'Кассовый аппарат' },
  { file: 'wooden-grenade-box', label: 'Гранатный ящик' },
  { file: 'dead-scav', label: 'Труп Дикого' },
  { file: 'burried-barrel-cache', label: 'Закопанная бочка' },
  { file: 'medbag-smu06', label: 'Медсумка' },
  { file: 'dead-pmc', label: 'Труп ЧВК' },
  { file: 'ground-cache', label: 'Схрон в земле' },
  { file: 'wooden-technical-supply-crate', label: 'Ящик техснабжения' },
  { file: 'wooden-ammo-box', label: 'Патронный ящик' },
  { file: 'medcase', label: 'Медукладка' },
  { file: 'plastic-suitcase', label: 'Пластиковый чемодан' },
  { file: 'bank-safe', label: 'Сейф' },
  { file: 'wooden-ration-supply-crate', label: 'Ящик с провизией' },
  { file: 'wooden-medical-supply-crate', label: 'Ящик медобеспечения' },
  { file: 'civilian-body', label: 'Труп гражданского' },
  { file: 'laborant', label: 'Труп лаборанта' },
  { file: 'cash-register-tar2-2', label: 'Банковская касса' },
  { file: 'common-fund-stash', label: 'Схрон' },
];

/* ── Случайная добыча: slug категории предмета (item_categories) → ru-подпись ── */
const LOOSE_SUBLAYERS: { slug: string; label: string }[] = [
  { slug: 'barter', label: 'Бартер' },
  { slug: 'provisions', label: 'Провизия' },
  { slug: 'injectors', label: 'Инъекторы' },
  { slug: 'keys', label: 'Ключи' },
  { slug: 'poster', label: 'Постеры' },
  { slug: 'container', label: 'Кейсы' },
  { slug: 'other', label: 'Другое' },
];

/** Фракция выхода → под-слой. */
const extractFaction = (m: MapViewMarker): 'pmc' | 'scav' | 'shared' => {
  const f = (m.faction ?? '').toLowerCase();
  return f === 'pmc' ? 'pmc' : f === 'scav' ? 'scav' : 'shared';
};

/** Ключ под-слоя (листа) для маркера, или null — тип не отображается слоем. */
export function layerKeyForMarker(m: MapViewMarker): string | null {
  switch (m.type) {
    case 'extract':
      return `extract-${extractFaction(m)}`;
    case 'spawn':
      return `spawn-${spawnSubkind(m)}`;
    case 'transit':
      return 'transit';
    case 'hazard':
      return 'hazard';
    case 'lock':
      return 'lock';
    case 'switch':
      return 'switch';
    case 'loot_container':
      return `container-${containerFile(m)}`;
    case 'loot_loose':
      return `loose-${m.lootCat ?? 'other'}`;
    case 'stationary_weapon':
      return 'stationary';
    case 'quest_zone':
      return 'quest_zone';
    default:
      return null;
  }
}

/** Дерево слоёв для drawer'а. */
export const LAYER_GROUPS: LayerGroup[] = [
  {
    group: 'Выходы',
    items: [
      { key: 'extract-pmc', label: 'ЧВК', sample: { type: 'extract', faction: 'pmc' } },
      { key: 'extract-scav', label: 'Дикий', sample: { type: 'extract', faction: 'scav' } },
      { key: 'extract-shared', label: 'Общий', sample: { type: 'extract', faction: 'all' } },
    ],
  },
  {
    group: 'Спавны',
    items: [
      { key: 'spawn-pmc', label: 'ЧВК', sample: { type: 'spawn', faction: 'pmc' } },
      { key: 'spawn-scav', label: 'Дикий', sample: { type: 'spawn', faction: 'scav' } },
      { key: 'spawn-sniper', label: 'Снайпер Дикого', sample: { type: 'spawn', categories: ['sniper'] } },
      { key: 'spawn-boss', label: 'Босс', sample: { type: 'spawn', categories: ['boss'] } },
    ],
  },
  {
    group: 'Интерактив',
    items: [
      { key: 'lock', label: 'Замки', sample: { type: 'lock' } },
      { key: 'switch', label: 'Рычаги', sample: { type: 'switch' } },
    ],
  },
  {
    group: 'Добыча',
    items: [
      {
        key: 'containers',
        label: 'Контейнеры',
        sample: { type: 'loot_container', category: 'weapon-box' },
        children: CONTAINER_SUBLAYERS.map((c) => ({
          key: `container-${c.file}`,
          label: c.label,
          sample: { type: 'loot_container', label: c.label } as MarkerIconInput,
        })),
      },
      {
        key: 'loose',
        label: 'Случайная добыча',
        sample: { type: 'loot_loose' },
        defaultOff: true,
        children: LOOSE_SUBLAYERS.map((c) => ({
          key: `loose-${c.slug}`,
          label: c.label,
          sample: { type: 'loot_loose' } as MarkerIconInput,
          defaultOff: true,
        })),
      },
      { key: 'stationary', label: 'Стационарки', sample: { type: 'stationary_weapon' } },
    ],
  },
  {
    group: 'Навигация',
    items: [{ key: 'transit', label: 'Переходы', sample: { type: 'transit' } }],
  },
  {
    group: 'Прочее',
    items: [
      { key: 'hazard', label: 'Опасности', sample: { type: 'hazard' } },
      { key: 'quest_zone', label: 'Зоны квестов', sample: { type: 'quest_zone' } },
    ],
  },
];

/** Плоский список листьев (реальные слои). */
export const ALL_LAYER_ITEMS: LayerItem[] = LAYER_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => i.children ?? [i]),
);

/** Начальная видимость: все листья вкл, кроме defaultOff. */
export const defaultLayerVisibility = (): Record<string, boolean> =>
  Object.fromEntries(ALL_LAYER_ITEMS.map((i) => [i.key, !i.defaultOff]));
