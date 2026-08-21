import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * «Список нужного» — стаб (спека craft-production-tracker §3). Скрепка на карточке крафта
 * складывает id входов сюда; полноценный экран списка — follow-up.
 *
 * items: itemId → накопленное нужное количество. persist localStorage.
 */
interface ShoppingListStore {
  items: Record<string, number>;

  /** Суммирует переданные количества в items (накопление). */
  add: (entries: { id: string; count: number }[]) => void;
  remove: (id: string) => void;
  reset: () => void;
  /** Число различных позиций в списке. */
  count: () => number;
}

export const useShoppingListStore = create<ShoppingListStore>()(
  persist(
    (set, get) => ({
      items: {},

      add: (entries) =>
        set((state) => {
          const next = { ...state.items };
          for (const { id, count } of entries) {
            const add = Number.isFinite(count) ? count : 0;
            next[id] = (next[id] ?? 0) + add;
          }
          return { items: next };
        }),

      remove: (id) =>
        set((state) => {
          const next = { ...state.items };
          delete next[id];
          return { items: next };
        }),

      reset: () => set({ items: {} }),

      count: () => Object.keys(get().items).length,
    }),
    {
      name: 'shopping-list-storage',
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
