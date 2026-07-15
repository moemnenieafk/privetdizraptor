import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Прогресс «Пути Новобранца»: какие этапы пройдены. Локально, без аккаунта.

interface RookieStore {
  completed: string[];
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  complete: (stageId: string) => void;
  reset: () => void;
}

export const useRookieStore = create<RookieStore>()(
  persist(
    (set) => ({
      completed: [],
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),
      complete: (stageId) =>
        set((s) => (s.completed.includes(stageId) ? s : { completed: [...s.completed, stageId] })),
      reset: () => set({ completed: [] }),
    }),
    {
      name: 'cta-rookie-path',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({ completed: state.completed }),
    },
  ),
);
