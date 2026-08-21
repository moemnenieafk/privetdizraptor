import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InventoryStore {
  ownedItems: Record<string, number>;
  getCount: (id: string) => number;
  setCount: (id: string, n: number) => void;
  /** Функциональный ±delta с клампом [0, max] от ЖИВОГО значения стора (против гонки
   *  быстрых кликов hold-repeat: onChange от рендер-value «залипает»). Тот же приём, что
   *  useHideoutStore.bumpItemProgress. Прямой ввод числа по-прежнему идёт через setCount. */
  bumpCount: (id: string, delta: number, max: number) => void;
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
      bumpCount: (id, delta, max) =>
        set((state) => {
          const cur = state.ownedItems[id] ?? 0;
          return { ownedItems: { ...state.ownedItems, [id]: Math.max(0, Math.min(max, cur + delta)) } };
        }),
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
