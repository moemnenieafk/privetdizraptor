import { create } from 'zustand';
import { defaultLayerVisibility } from '@/components/features/maps/map-layers';

/**
 * Эфемерное состояние вида карты (§18.1 спеки E11 — CTA-MAPS-MARKER-UGC-SPEC).
 * НЕ персистится: двусторонний синк с URL search params (permalink), см. useMapViewUrlSync.
 * Селекторы возвращают примитивы — производные списки считать в компоненте через useMemo.
 *
 * activeFilters = ЕДИНАЯ видимость слоёв маркеров (GRILL-2 §3): и вьюер (MapViewerClient),
 * и правая легенда (MapLayersDrawer), и левый drawer (MapSearchDrawer) читают/пишут её.
 * Сид дефолтами при создании стора — иначе первый рендер спрятал бы все слои.
 */
interface MapViewState {
  zoom: number;
  centerX: number;
  centerY: number;
  floor: number;
  selectedMarkerId: string | null;
  activeFilters: Record<string, boolean>;
  activePresetId: string | null;

  setFloor: (floor: number) => void;
  setView: (v: { zoom?: number; centerX?: number; centerY?: number }) => void;
  selectMarker: (id: string | null) => void;
  setFilter: (key: string, on: boolean) => void;
  /** Переключить видимость одного слоя (тоггл/чекбокс). */
  toggleFilter: (key: string) => void;
  /** Задать видимость группы слоёв разом (чекбокс группы/узла в легенде). */
  setGroupFilters: (keys: string[], on: boolean) => void;
  /** Соло: включить ТОЛЬКО эти слои, все остальные выключить (Alt+клик по категории). */
  soloFilters: (keys: string[]) => void;
  setPreset: (id: string | null) => void;
  /** Гидрация из URL при маунте (только присутствующие ключи). */
  hydrate: (partial: Partial<MapViewState>) => void;
}

export const useMapViewStore = create<MapViewState>((set) => ({
  zoom: 0,
  centerX: 0,
  centerY: 0,
  floor: 0,
  selectedMarkerId: null,
  activeFilters: defaultLayerVisibility(),
  activePresetId: null,

  setFloor: (floor) => set({ floor }),
  setView: (v) => set((s) => ({ ...s, ...v })),
  selectMarker: (selectedMarkerId) => set({ selectedMarkerId }),
  setFilter: (key, on) => set((s) => ({ activeFilters: { ...s.activeFilters, [key]: on } })),
  toggleFilter: (key) => set((s) => ({ activeFilters: { ...s.activeFilters, [key]: !s.activeFilters[key] } })),
  setGroupFilters: (keys, on) =>
    set((s) => ({ activeFilters: { ...s.activeFilters, ...Object.fromEntries(keys.map((k) => [k, on])) } })),
  soloFilters: (keys) =>
    set((s) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(s.activeFilters)) next[k] = false;
      for (const k of keys) next[k] = true;
      return { activeFilters: next };
    }),
  setPreset: (activePresetId) => set({ activePresetId }),
  hydrate: (partial) => set(partial),
}));
