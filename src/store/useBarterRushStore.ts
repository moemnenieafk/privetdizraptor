import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Аркадная статистика «Потока сделок» — ЛОКАЛЬНАЯ и отдельная от profit-XP экономики
// (useGamificationStore). Угадывание сделок не начисляет реальный XP и не растит ранг:
// это тренажёр интуиции со своим счётом/комбо. Синк с аккаунтом не нужен → без миграций.

export interface RushRoundInput {
  correct: boolean;
  /** Текущее комбо ПОСЛЕ раунда (0 при промахе). */
  combo: number;
  /** Текущий счёт сессии ПОСЛЕ раунда. */
  score: number;
}

interface BarterRushStore {
  bestCombo: number;
  bestScore: number;
  played: number;
  correct: number;
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  recordRound: (input: RushRoundInput) => void;
  resetStats: () => void;
}

export const useBarterRushStore = create<BarterRushStore>()(
  persist(
    (set) => ({
      bestCombo: 0,
      bestScore: 0,
      played: 0,
      correct: 0,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),

      recordRound: ({ correct, combo, score }) =>
        set((s) => ({
          played: s.played + 1,
          correct: s.correct + (correct ? 1 : 0),
          bestCombo: Math.max(s.bestCombo, combo),
          bestScore: Math.max(s.bestScore, score),
        })),

      resetStats: () => set({ bestCombo: 0, bestScore: 0, played: 0, correct: 0 }),
    }),
    {
      name: 'cta-barter-rush',
      // SSR-safe: rehydrate() зовём в эффекте на клиенте (как в useGamificationStore).
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({
        bestCombo: s.bestCombo,
        bestScore: s.bestScore,
        played: s.played,
        correct: s.correct,
      }),
    },
  ),
);
