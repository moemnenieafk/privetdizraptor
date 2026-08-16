import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Флаг «первый вход в досье» — мягкий онбординг-момент (подсветить архетип, позвать в
// «Путь Новобранца»), БЕЗ модалок-стопперов (§4 спеки, R01/R18i). Локально, без аккаунта.
// skipHydration как у соседей (SSR-safe): rehydrate() зовём в эффекте на клиенте.

interface FirstVisitStore {
  /** true, пока досье ни разу не отметили просмотренным. */
  isFirstVisit: boolean;
  _hasHydrated: boolean;
  setHasHydrated: () => void;
  /** Пометить, что онбординг-момент показан — больше не первый вход. */
  markVisited: () => void;
  /** Сброс (для отладки/повторного онбординга). */
  reset: () => void;
}

export const useFirstVisitStore = create<FirstVisitStore>()(
  persist(
    (set) => ({
      isFirstVisit: true,
      _hasHydrated: false,
      setHasHydrated: () => set({ _hasHydrated: true }),
      markVisited: () => set({ isFirstVisit: false }),
      reset: () => set({ isFirstVisit: true }),
    }),
    {
      name: 'cta-first-visit',
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated();
      },
      partialize: (s) => ({ isFirstVisit: s.isFirstVisit }),
    },
  ),
);
