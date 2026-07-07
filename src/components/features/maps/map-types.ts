import type { EftMapConfig } from '@/data/eft-map-config';

/** Сериализуемый маркер для клиента (подмножество map_markers). */
export interface MapViewMarker {
  id: string;
  type: string;
  position: { x: number; y: number; z: number } | null;
  outline: { x: number; y: number; z: number }[] | null;
  /** Диапазон игровой высоты (game-Y) — для фильтра по этажу. */
  top: number | null;
  bottom: number | null;
  label: string | null;
  faction: string | null;
  sides: string[] | null;
  categories: string[] | null;
  /** Привязка к предмету (контейнер/лут/выход-transferItem/ключ замка) — иконка + кросс-линк. */
  linkedItemId?: string | null;
  /** Спавн предмета (loot_loose): тарковский цвет фона слота (blue/yellow/violet…) для плитки. */
  itemBg?: string | null;
  /** Выход: имя нужного предмета (transferItem) — для выбора иконки (кодовое слово). */
  transferItemName?: string | null;
  /** loose loot: slug категории предмета (barter/provisions/injectors/keys/poster/container/other) — для под-слоя. */
  lootCat?: string | null;
  meta: Record<string, unknown> | null;
  /** Статик-карты (ручные маркеры): индекс этажа для фильтра вместо game-Y top/bottom. */
  floor?: number | null;
  /** Статик-карты: под-категория (spawn/loot/container) для иконки/подписи. */
  category?: string | null;
  /** Статик-карты (quest-маркеры): привязка к квесту/цели — клик и deep-link. */
  questId?: string | null;
  objectiveId?: string | null;
}

/** Полный пакет данных одной карты для интерактивного вьюера. */
export interface MapView {
  slug: string;
  name: string;
  imageUrl: string;
  author: string | null;
  authorLink: string | null;
  raidDuration: number | null;
  players: string | null;
  minPlayerLevel: number | null;
  maxPlayerLevel: number | null;
  /** Статик-карты: стоимость входа/выхода + сводка спавнов для нижней панели. */
  entryCost?: string | null;
  exitCost?: string | null;
  spawns?: string | null;
  config: EftMapConfig;
  markers: MapViewMarker[];
}
