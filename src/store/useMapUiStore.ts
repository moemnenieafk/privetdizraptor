import { create } from 'zustand';

export type MapSheet = 'maps' | 'quests' | 'search' | 'layers' | 'raid';

interface MapUiState {
  activeSheet: MapSheet | null;
  chromeCollapsed: boolean;
  /** Открыта ли панель слоёв/фильтров. Единый канал для десктоп-бара и мобильного MobileMapBar. */
  layersOpen: boolean;
  /** Открыт ли левый drawer «ПОИСК НА ЛОКАЦИИ» (десктоп). Левая лупа в баре. */
  searchOpen: boolean;
  /** Активен ли инструмент «линейка» (click-to-measure). Тоггл в баре, замер — во вьюере. */
  rulerActive: boolean;
  openSheet: (sheet: MapSheet) => void;
  closeSheet: () => void;
  toggleSheet: (sheet: MapSheet) => void;
  toggleChrome: () => void;
  setLayersOpen: (v: boolean) => void;
  toggleLayers: () => void;
  setSearchOpen: (v: boolean) => void;
  toggleSearch: () => void;
  setRulerActive: (v: boolean) => void;
  toggleRuler: () => void;
}

// На узких экранах (<1440) два drawer'а налезают друг на друга → открытие одного
// авто-закрывает противоположный. На широких — независимые тогглы (GRILL-2 правило 4).
const narrow = (): boolean => typeof window !== 'undefined' && window.innerWidth < 1440;

export const useMapUiStore = create<MapUiState>((set) => ({
  activeSheet: null,
  chromeCollapsed: false,
  layersOpen: false,
  searchOpen: false,
  rulerActive: false,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleSheet: (sheet) =>
    set((s) => ({ activeSheet: s.activeSheet === sheet ? null : sheet })),
  toggleChrome: () => set((s) => ({ chromeCollapsed: !s.chromeCollapsed })),
  setLayersOpen: (layersOpen) =>
    set((s) => ({ layersOpen, searchOpen: layersOpen && narrow() ? false : s.searchOpen })),
  toggleLayers: () =>
    set((s) => {
      const layersOpen = !s.layersOpen;
      return { layersOpen, searchOpen: layersOpen && narrow() ? false : s.searchOpen };
    }),
  setSearchOpen: (searchOpen) =>
    set((s) => ({ searchOpen, layersOpen: searchOpen && narrow() ? false : s.layersOpen })),
  toggleSearch: () =>
    set((s) => {
      const searchOpen = !s.searchOpen;
      return { searchOpen, layersOpen: searchOpen && narrow() ? false : s.layersOpen };
    }),
  setRulerActive: (rulerActive) => set({ rulerActive }),
  toggleRuler: () => set((s) => ({ rulerActive: !s.rulerActive })),
}));