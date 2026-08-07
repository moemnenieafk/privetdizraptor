import { create } from 'zustand';

export type QuestSheet = 'search' | 'traders' | 'maps' | 'save' | 'pinned';

interface QuestMapUiState {
  activeSheet: QuestSheet | null;
  openSheet: (sheet: QuestSheet) => void;
  closeSheet: () => void;
  toggleSheet: (sheet: QuestSheet) => void;
}

export const useQuestMapUiStore = create<QuestMapUiState>((set) => ({
  activeSheet: null,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleSheet: (sheet) =>
    set((s) => ({ activeSheet: s.activeSheet === sheet ? null : sheet })),
}));