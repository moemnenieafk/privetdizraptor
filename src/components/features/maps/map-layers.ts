import type { MapViewMarker } from './map-types';
import { spawnSubkind, containerFile, extractSubtype, lockKind, hazardSubtype, stationarySubtype, questZoneKind, type MarkerIconInput } from '@/data/map-marker-icons';
import { LOOT_15 } from '@/data/map-markers/loot-15';
import { BP_SEASON_1_DOC_IDS, BP_SEASON_1_DOCS } from '@/data/eft-season-items';
import { itemIconUrl } from '@/lib/item-icon';

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
  /** CSS-маска класс (icon-eft-*) из нашей таксономии — приоритет над резолвером (loose-категории). */
  iconClass?: string;
  /** Прямой путь к цветному svg/webp — рендер полноцветным `<img>` (как контейнеры/опасности),
   * приоритет над iconClass и резолвером. Для детальных маркеров, которые нельзя схлопывать в маску. */
  iconImg?: string;
  /** раскрываемый узел: дети-листья (сам узел слоем не является — тумблер всех детей). */
  children?: LayerItem[];
}

export interface LayerGroup {
  group: string;
  items: LayerItem[];
}

/* ── Контейнеры: файл иконки → ru-подпись (дедуп по файлу; пустые скрывает drawer) ── */
const CONTAINER_SUBLAYERS: { file: string; label: string; item?: string }[] = [
  { file: 'sportsbag', label: 'Спортивная сумка' },
  { file: 'weaponbox-5x2', label: 'Оружейный ящик 5×2', item: '5909d5ef86f77467974efbd8' },
  { file: 'weaponbox-6x3', label: 'Оружейный ящик 6×3', item: '5909d76c86f77471e53d2adf' },
  { file: 'weaponbox-4x4', label: 'Оружейный ящик 4×4', item: '5909d7cf86f77470ee57d75a' },
  { file: 'weaponbox-5x5', label: 'Оружейный ящик 5×5', item: '5909d89086f77472591234a0' },
  { file: 'toolbox', label: 'Ящик с инструментами' },
  { file: 'wooden-crate', label: 'Деревянный ящик' },
  { file: 'jacket', label: 'Куртка' },
  { file: 'jacket-worker-blue', label: 'Куртка рабочего', item: '5914944186f774189e5e76c2' },
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

/* ── Случайная добыча: 15 категорий (общий источник LOOT_15, ключи = слои `loose-<key>`) ── */
const LOOSE_SUBLAYERS = LOOT_15.map((c) => ({ slug: c.key, label: c.label, iconClass: c.icon }));

/** Ключ под-слоя (листа) для маркера, или null — тип не отображается слоем. */
export function layerKeyForMarker(m: MapViewMarker): string | null {
  // Документация TerraGroup (BP S1): каждый департамент — свой под-слой bp-doc-<id> (раскрываемый
  // узел в легенде → тумблер каждого документа; в дереве показываются только присутствующие на карте).
  if ((m.type === 'loot_loose' || m.type === 'loot') && m.linkedItemId && BP_SEASON_1_DOC_IDS.has(m.linkedItemId)) {
    return `bp-doc-${m.linkedItemId}`;
  }
  switch (m.type) {
    case 'extract':
      return `extract-${extractSubtype(m)}`;
    case 'spawn':
      return `spawn-${spawnSubkind(m)}`;
    case 'transit':
      return 'transit';
    case 'hazard':
      return `hazard-${hazardSubtype(m)}`;
    case 'lock':
      return lockKind(m) === 'marked' ? 'lock-marked' : 'lock-standard';
    case 'switch':
      return 'switch';
    case 'loot_container':
      return `container-${containerFile(m)}`;
    case 'loot_loose':
      return `loose-${m.lootCat ?? 'other'}`;
    case 'stationary_weapon':
      return `stationary-${stationarySubtype(m)}`;
    case 'quest_zone':
      return `quest-${questZoneKind(m)}`;
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
      { key: 'extract-paidcar', label: 'Платный (машина)', sample: { type: 'extract', label: 'В-Выход' } },
      { key: 'extract-codeword', label: 'Кодовое слово', sample: { type: 'extract', transferItemName: 'кодовым словом' } },
      { key: 'extract-redrebel', label: 'Альпинист (Red Rebel)', sample: { type: 'extract', label: 'Тропа альпиниста' } },
      { key: 'extract-nobackpack', label: 'Без рюкзака', sample: { type: 'extract', label: 'Вентиляционная шахта' } },
      { key: 'extract-greenflare', label: 'Зелёный сигнал', sample: { type: 'extract', label: '(Сигнал)' } },
      { key: 'transit', label: 'Переходы', sample: { type: 'transit' } },
    ],
  },
  {
    group: 'Спавны',
    items: [
      { key: 'spawn-pmc', label: 'ЧВК', sample: { type: 'spawn', faction: 'pmc' } },
      { key: 'spawn-scav', label: 'Дикий', sample: { type: 'spawn', faction: 'scav' } },
      { key: 'spawn-sniper', label: 'Снайпер Дикого', sample: { type: 'spawn', categories: ['sniper'] } },
      { key: 'spawn-boss', label: 'Босс', sample: { type: 'spawn', categories: ['boss'] } },
      { key: 'spawn-rogue', label: 'Отступники (Rogue)', sample: { type: 'spawn', spawnFaction: 'rogue' } },
      { key: 'spawn-black-division', label: 'Black Division', sample: { type: 'spawn', spawnFaction: 'black-division' } },
    ],
  },
  {
    group: 'Интерактив',
    items: [
      {
        key: 'lock-standard',
        label: 'Закрытые комнаты',
        sample: { type: 'lock' },
        iconImg: '/icons/eft/01-maps/markers/interactive/lock/lock-mechanical.svg',
      },
      {
        key: 'lock-marked',
        label: 'Меченые комнаты',
        sample: { type: 'lock' },
        iconImg: '/icons/eft/01-maps/markers/interactive/lock/lock-mechanical-marked.svg',
      },
      { key: 'switch', label: 'Рычаги', sample: { type: 'switch' } },
      {
        key: 'stationary',
        label: 'Стационарное оружие',
        sample: { type: 'stationary_weapon' },
        iconImg: '/icons/eft/01-maps/markers/interactive/mounted-armaments.svg',
        children: [
          { key: 'stationary-ags30', label: 'АГС-30', sample: { type: 'stationary_weapon' }, iconImg: '/images/maps/eft/markers/stationary/stationary-ags30.webp' },
          { key: 'stationary-nvs', label: 'НСВ «Утёс»', sample: { type: 'stationary_weapon' }, iconImg: '/images/maps/eft/markers/stationary/stationary-nvs-utes.webp' },
        ],
      },
    ],
  },
  {
    group: 'Добыча',
    items: [
      {
        key: 'containers',
        label: 'Контейнеры',
        sample: { type: 'loot_container', category: 'weapon-box' },
        iconImg: '/icons/eft/01-maps/markers/loot/loot-containers-marker.svg',
        children: CONTAINER_SUBLAYERS.map((c) => ({
          key: `container-${c.file}`,
          label: c.label,
          sample: { type: 'loot_container', label: c.label, linkedItemId: c.item } as MarkerIconInput,
        })),
      },
      {
        key: 'loose',
        label: 'Случайная добыча',
        sample: { type: 'loot_loose' },
        children: LOOSE_SUBLAYERS.map((c) => ({
          key: `loose-${c.slug}`,
          label: c.label,
          sample: { type: 'loot_loose' } as MarkerIconInput,
          iconClass: c.iconClass,
        })),
      },
      {
        // Раскрываемый узел (сам слоем не является) — тумблер всех департаментов; иконка-монета BP.
        key: 'bp-season-1-docs',
        label: 'Документация Terragroup — BP S1',
        sample: { type: 'loot_loose' } as MarkerIconInput,
        iconClass: 'icon-eft-battlepass-docs-coin',
        children: BP_SEASON_1_DOCS.map((d) => ({
          key: `bp-doc-${d.id}`,
          label: d.name,
          sample: { type: 'loot_loose' } as MarkerIconInput,
          iconImg: itemIconUrl(d.id),
        })),
      },
    ],
  },
  {
    group: 'Задания',
    items: [
      { key: 'quest-target', label: 'Цель задания', sample: { type: 'quest_zone' }, iconImg: '/icons/eft/01-maps/markers/quest/quest-maker.svg' },
      { key: 'quest-item', label: 'Предметы для заданий', sample: { type: 'quest_zone' }, iconImg: '/icons/eft/01-maps/markers/quest/quest-item.svg' },
    ],
  },
  {
    group: 'Опасности',
    items: [
      { key: 'hazard-sniper', label: 'Снайпер', sample: { type: 'hazard' }, iconImg: '/icons/eft/01-maps/markers/danger/danger-sniper-death.svg' },
      { key: 'hazard-mine', label: 'Противопехотная мина', sample: { type: 'hazard' }, iconImg: '/icons/eft/01-maps/markers/danger/danger-mines-death.svg' },
      { key: 'hazard-mortar', label: 'Угроза миномётного обстрела', sample: { type: 'hazard' }, iconImg: '/icons/eft/01-maps/markers/danger/danger-mortar-death.svg' },
      { key: 'hazard-tripwire', label: 'Гранаты-растяжки', sample: { type: 'hazard' }, iconImg: '/icons/eft/01-maps/markers/danger/danger-tripwire-grenades.svg' },
      { key: 'hazard-other', label: 'Опасная зона', sample: { type: 'hazard' }, iconImg: '/icons/eft/01-maps/markers/danger/danger.svg' },
    ],
  },
];

/** Плоский список листьев (реальные слои). */
export const ALL_LAYER_ITEMS: LayerItem[] = LAYER_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => i.children ?? [i]),
);

/**
 * Начальная видимость слоёв на ВСЕХ картах (V4DYA, 2026-08-27). Ровно 4 группы включены,
 * маркер виден сразу на любом зуме (LOD-гейтинг снят). Остальное — точечно из легенды/drawer'а:
 *   • Выходы — все (+ переходы)
 *   • Спавны — только ЧВК (spawn-pmc)
 *   • Добыча — Документация Terragroup (BP S1) = все департаменты (bp-doc-*)
 *   • Задания — все (quest-target/quest-item)
 */
export const defaultLayerVisibility = (): Record<string, boolean> =>
  Object.fromEntries(
    ALL_LAYER_ITEMS.map((i) => {
      const on =
        i.key.startsWith('extract-') || i.key === 'transit' || // Выходы (все) + переходы
        i.key === 'spawn-pmc' ||                               // Спавны — только ЧВК
        i.key.startsWith('bp-doc-') ||                         // Добыча — Документация Terragroup (BP S1)
        i.key.startsWith('quest');                             // Задания (все)
      return [i.key, on];
    }),
  );
