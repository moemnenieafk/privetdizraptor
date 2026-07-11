import { create } from 'zustand';

export type MapSheet = 'maps' | 'quests' | 'search' | 'layers' | 'raid';

interface MapUiState {
  activeSheet: MapSheet | null;
  chromeCollapsed: boolean;
  openSheet: (sheet: MapSheet) => void;
  closeSheet: () => void;
  toggleSheet: (sheet: MapSheet) => void;
  toggleChrome: () => void;
}

export const useMapUiStore = create<MapUiState>((set) => ({
  activeSheet: null,
  chromeCollapsed: false,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleSheet: (sheet) =>
    set((s) => ({ activeSheet: s.activeSheet === sheet ? null : sheet })),
  toggleChrome: () => set((s) => ({ chromeCollapsed: !s.chromeCollapsed })),
}));