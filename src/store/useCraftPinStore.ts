import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Закреплённые крафты — скрепка на карточке (спека craft-production-tracker §3, упрощение).
 * Держит id закреплённых крафтов; страница показывает их секцией «Закреплённые» сверху.
 * persist localStorage. Заменил прежний накопитель-стор «Список нужного» (был лишним).
 */
interface CraftPinStore {
  pinned: string[];
  /** Закрепить/открепить крафт по id. */
  toggle: (craftId: string) => void;
  reset: () => void;
}

export const useCraftPinStore = create<CraftPinStore>()(
  persist(
    (set) => ({
      pinned: [],
      toggle: (craftId) =>
        set((state) => ({
          pinned: state.pinned.includes(craftId)
            ? state.pinned.filter((id) => id !== craftId)
            : [...state.pinned, craftId],
        })),
      reset: () => set({ pinned: [] }),
    }),
    {
      name: 'craft-pin-storage',
      partialize: (s) => ({ pinned: s.pinned }),
    },
  ),
);
