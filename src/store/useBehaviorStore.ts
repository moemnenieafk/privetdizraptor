import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BehaviorDomain, BehaviorSignals } from '@/lib/role-inference';
import { decayCounts } from '@/lib/behavior-signals';

// Персистентные счётчики поведения для авто-инференса роли «Ульты».
// recordVisit() затухает накопленное к «сейчас» и добавляет +1 текущему домену.

interface BehaviorStore {
  counts: BehaviorSignals;
  lastDecayAt: number;
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  recordVisit: (domain: BehaviorDomain) => void;
  /** Текущие сигналы (уже затухшие на момент последнего визита). */
  signals: () => BehaviorSignals;
}

export const useBehaviorStore = create<BehaviorStore>()(
  persist(
    (set, get) => ({
      counts: {},
      lastDecayAt: 0,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      recordVisit: (domain) => {
        const now = Date.now();
        const state = get();
        const base = state.lastDecayAt > 0 ? decayCounts(state.counts, now - state.lastDecayAt) : { ...state.counts };
        base[domain] = (base[domain] ?? 0) + 1;
        set({ counts: base, lastDecayAt: now });
      },

      signals: () => get().counts,
    }),
    {
      name: 'cta-behavior',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (state) => ({ counts: state.counts, lastDecayAt: state.lastDecayAt }),
    },
  ),
);
