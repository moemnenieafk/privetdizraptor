import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InventoryStore {
  ownedItems: Record<string, number>;
  getCount: (id: string) => number;
  setCount: (id: string, n: number) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      ownedItems: {},
      getCount: (id) => get().ownedItems[id] ?? 0,
      setCount: (id, n) =>
        set((state) => ({
          ownedItems: { ...state.ownedItems, [id]: Math.max(0, n) },
        })),
      increment: (id) =>
        set((state) => ({
          ownedItems: { ...state.ownedItems, [id]: (state.ownedItems[id] ?? 0) + 1 },
        })),
      decrement: (id) =>
        set((state) => ({
          ownedItems: {
            ...state.ownedItems,
            [id]: Math.max(0, (state.ownedItems[id] ?? 0) - 1),
          },
        })),
    }),
    { name: 'cta-inventory' }
  )
);
