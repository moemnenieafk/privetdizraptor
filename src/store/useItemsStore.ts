import { create } from 'zustand';

interface ItemsStore {
  selectedTraders: string[];
  toggleTrader: (id: string) => void;
  clearTraders: () => void;
  compareIds: string[];
  /** Категория текущего сравнения (slug каталога). Жёсткий скоуп: сравниваем внутри одной. */
  compareCategory: string | null;
  toggleCompare: (id: string, categorySlug: string) => void;
  clearCompare: () => void;
  /** Последний просмотренный раздел каталога — куда вернуть со страницы предмета. */
  catalogReturnPath: string | null;
  setCatalogReturnPath: (path: string | null) => void;
}

const MAX_COMPARE = 4;

export const useItemsStore = create<ItemsStore>((set) => ({
  selectedTraders: [],
  toggleTrader: (id) =>
    set((state) => ({
      selectedTraders: state.selectedTraders.includes(id)
        ? state.selectedTraders.filter((t) => t !== id)
        : [...state.selectedTraders, id],
    })),
  clearTraders: () => set({ selectedTraders: [] }),

  compareIds: [],
  compareCategory: null,
  toggleCompare: (id, categorySlug) =>
    set((state) => {
      // Смена категории — начинаем сравнение заново (жёсткий скоуп: только внутри одной).
      if (state.compareCategory !== categorySlug) {
        return { compareCategory: categorySlug, compareIds: [id] };
      }
      if (state.compareIds.includes(id)) {
        const next = state.compareIds.filter((c) => c !== id);
        return { compareIds: next, compareCategory: next.length ? categorySlug : null };
      }
      if (state.compareIds.length >= MAX_COMPARE) return state;
      return { compareIds: [...state.compareIds, id] };
    }),
  clearCompare: () => set({ compareIds: [], compareCategory: null }),

  catalogReturnPath: null,
  setCatalogReturnPath: (path) => set({ catalogReturnPath: path }),
}));
