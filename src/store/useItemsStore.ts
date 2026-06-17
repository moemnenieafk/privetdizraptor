import { create } from 'zustand';

interface ItemsStore {
  selectedTraders: string[];
  toggleTrader: (id: string) => void;
  clearTraders: () => void;
}

export const useItemsStore = create<ItemsStore>((set) => ({
  selectedTraders: [],
  toggleTrader: (id) =>
    set((state) => ({
      selectedTraders: state.selectedTraders.includes(id)
        ? state.selectedTraders.filter((t) => t !== id)
        : [...state.selectedTraders, id],
    })),
  clearTraders: () => set({ selectedTraders: [] }),
}));
