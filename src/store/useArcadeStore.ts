import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Мета-состояние зала автоматов (НЕ покадровое — то живёт в useRef игры). Только выбор
// игры и звук. Звук по умолчанию ВЫКЛючен (аркада — виджет ожидания, не должна орать).

interface ArcadeStore {
  selectedGameId: string;
  muted: boolean;
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  selectGame: (id: string) => void;
  toggleMuted: () => void;
}

export const useArcadeStore = create<ArcadeStore>()(
  persist(
    (set) => ({
      selectedGameId: 'save-the-servers',
      muted: true,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),
      selectGame: (id) => set({ selectedGameId: id }),
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
    }),
    {
      name: 'cta-arcade',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({ selectedGameId: s.selectedGameId, muted: s.muted }),
    },
  ),
);
