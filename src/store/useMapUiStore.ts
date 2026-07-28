import { create } from 'zustand';

export type MapSheet = 'maps' | 'quests' | 'search' | 'layers' | 'raid';

interface MapUiState {
  activeSheet: MapSheet | null;
  chromeCollapsed: boolean;
  /** Открыта ли панель слоёв/фильтров. Единый канал для десктоп-бара и мобильного MobileMapBar. */
  layersOpen: boolean;
  /** Активен ли инструмент «линейка» (click-to-measure). Тоггл в баре, замер — во вьюере. */
  rulerActive: boolean;
  openSheet: (sheet: MapSheet) => void;
  closeSheet: () => void;
  toggleSheet: (sheet: MapSheet) => void;
  toggleChrome: () => void;
  setLayersOpen: (v: boolean) => void;
  toggleLayers: () => void;
  setRulerActive: (v: boolean) => void;
  toggleRuler: () => void;
}

export const useMapUiStore = create<MapUiState>((set) => ({
  activeSheet: null,
  chromeCollapsed: false,
  layersOpen: false,
  rulerActive: false,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleSheet: (sheet) =>
    set((s) => ({ activeSheet: s.activeSheet === sheet ? null : sheet })),
  toggleChrome: () => set((s) => ({ chromeCollapsed: !s.chromeCollapsed })),
  setLayersOpen: (layersOpen) => set({ layersOpen }),
  toggleLayers: () => set((s) => ({ layersOpen: !s.layersOpen })),
  setRulerActive: (rulerActive) => set({ rulerActive }),
  toggleRuler: () => set((s) => ({ rulerActive: !s.rulerActive })),
}));