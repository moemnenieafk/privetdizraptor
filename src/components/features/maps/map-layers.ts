import type { MapViewMarker } from './map-types';
import { spawnSubkind, containerFile, extractSubtype, lockKind, hazardSubtype, stationarySubtype, type MarkerIconInput } from '@/data/map-marker-icons';
import { LOOT_15 } from '@/data/map-markers/loot-15';

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
  /** CSS-маска класс (icon-eft-*) из нашей таксономии — приоритет над резолвером (loose-категории). */
  iconClass?: string;
  /** Прямой путь к цветному svg/webp — рендер полноцветным `<img>` (как «Случайная добыча»),
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
        defaultOff: true,
        children: LOOSE_SUBLAYERS.map((c) => ({
          key: `loose-${c.slug}`,
          label: c.label,
          sample: { type: 'loot_loose' } as MarkerIconInput,
          iconClass: c.iconClass,
          defaultOff: true,
        })),
      },
    ],
  },
  {
    group: 'Задания',
    items: [{ key: 'quest_zone', label: 'Зоны квестов', sample: { type: 'quest_zone' } }],
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

/* ─────────────── LOD: тир видимости по зуму (§4 споки E11) ───────────────
 * Тир маркера считаем по ключу слоя. Порог — ДОЛЯ зум-спана карты [minZoom,maxZoom]
 * (абсолютные z-уровни непереносимы: у карт разный диапазон, от −5…2 до 2…6).
 * §4-таблица с поправкой GRILL-1 (спавны = z4-тир целей; якоря = только выходы/переходы):
 *   тир 0 (якорь) — всегда: выходы, переходы
 *   тир 1 (≈z3)   — цели/опасности: зоны квестов, боссы, hazard
 *   тир 2 (≈z4)   — спавны, замки, рычаги, стационарки
 *   тир 3 (≈z5+)  — фон: контейнеры, случайная добыча
 * Пороги эмпирические — тюнятся визуально. */
export type LodTier = 0 | 1 | 2 | 3;

export function lodTierForKey(key: string): LodTier {
  // Контейнеры/добыча по дефолту выключены и включаются точечно из drawer'а → показываем СРАЗУ
  // (тир 0, без зум-порога), иначе тоггл на общем зуме «не срабатывает» до приближения (V4DYA).
  if (key.startsWith('container-') || key.startsWith('loose-')) return 0;
  if (key.startsWith('extract-') || key === 'transit') return 0;
  if (key === 'quest_zone' || key.startsWith('hazard') || key === 'spawn-boss') return 1;
  if (key.startsWith('spawn-') || key.startsWith('lock') || key === 'switch' || key.startsWith('stationary')) return 2;
  return 2;
}

/** Доля зум-спана, с которой тир начинает показываться. Тир 0 — всегда. */
const LOD_TIER_MIN_FRAC: Record<LodTier, number> = { 0: 0, 1: 0.34, 2: 0.56, 3: 0.78 };

/** Виден ли слой на данной доле зум-спана (0..1). */
export const lodVisibleAt = (key: string, zoomFrac: number): boolean =>
  zoomFrac >= LOD_TIER_MIN_FRAC[lodTierForKey(key)];

/** Плоский список листьев (реальные слои). */
export const ALL_LAYER_ITEMS: LayerItem[] = LAYER_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => i.children ?? [i]),
);

/**
 * Начальная видимость слоёв (V4DYA): МИНИМУМ на входе, чтобы не грузить лишние маркеры —
 * выходы ЧВК + Платный, спавны ЧВК, все опасности. Остальное выключено (юзер включает точечно
 * из легенды/drawer'а). Так снимаем нагрузку и лишнюю подгрузку.
 */
const DEFAULT_ON = new Set(['extract-pmc', 'extract-paidcar', 'spawn-pmc']);
export const defaultLayerVisibility = (): Record<string, boolean> =>
  Object.fromEntries(ALL_LAYER_ITEMS.map((i) => [i.key, DEFAULT_ON.has(i.key) || i.key.startsWith('hazard')]));
