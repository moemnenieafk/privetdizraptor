import { create } from 'zustand';

interface ItemsStore {
  selectedTraders: string[];
  toggleTrader: (id: string) => void;
  clearTraders: () => void;
  compareIds: string[];
  toggleCompare: (id: string) => void;
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
  toggleCompare: (id) =>
    set((state) => {
      if (state.compareIds.includes(id)) {
        return { compareIds: state.compareIds.filter((c) => c !== id) };
      }
      if (state.compareIds.length >= MAX_COMPARE) return state;
      return { compareIds: [...state.compareIds, id] };
    }),
  clearCompare: () => set({ compareIds: [] }),

  catalogReturnPath: null,
  setCatalogReturnPath: (path) => set({ catalogReturnPath: path }),
}));
