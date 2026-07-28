import { create } from 'zustand';

/**
 * Эфемерное состояние вида карты (§18.1 спеки E11 — CTA-MAPS-MARKER-UGC-SPEC).
 * НЕ персистится: двусторонний синк с URL search params (permalink), см. useMapViewUrlSync.
 * Селекторы возвращают примитивы — производные списки считать в компоненте через useMemo.
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
  activeFilters: {},
  activePresetId: null,

  setFloor: (floor) => set({ floor }),
  setView: (v) => set((s) => ({ ...s, ...v })),
  selectMarker: (selectedMarkerId) => set({ selectedMarkerId }),
  setFilter: (key, on) => set((s) => ({ activeFilters: { ...s.activeFilters, [key]: on } })),
  setPreset: (activePresetId) => set({ activePresetId }),
  hydrate: (partial) => set(partial),
}));
