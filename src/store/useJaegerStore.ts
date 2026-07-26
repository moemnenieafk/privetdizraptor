import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Рекорд game04 «Егерь ловит покушать». Минимальный persist (как record-часть других игр зала).
interface JaegerStore {
  bestScore: number;
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  recordRun: (score: number) => void;
}

export const useJaegerStore = create<JaegerStore>()(
  persist(
    (set, get) => ({
      bestScore: 0,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),
      recordRun: (score) => {
        if (score > get().bestScore) set({ bestScore: score });
      },
    }),
    {
      name: 'cta-jaeger',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({ bestScore: s.bestScore }),
    },
  ),
);
