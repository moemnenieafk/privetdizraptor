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
  meta: Record<string, unknown> | null;
  /** Статик-карты (ручные маркеры): индекс этажа для фильтра вместо game-Y top/bottom. */
  floor?: number | null;
  /** Статик-карты: под-категория (spawn/loot/container) для иконки/подписи. */
  category?: string | null;
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
  config: EftMapConfig;
  markers: MapViewMarker[];
}
