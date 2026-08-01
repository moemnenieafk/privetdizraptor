import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// «Мои ключи» — глобальный набор id ключей (применимы к любой карте; на карте берём пересечение
// с её замками). Persist в localStorage — переживает сессию/смену карты (реверс Ключ→Двери).
interface MyKeysState {
  keys: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

export const useMyKeysStore = create<MyKeysState>()(
  persist(
    (set) => ({
      keys: [],
      toggle: (id) =>
        set((s) => ({ keys: s.keys.includes(id) ? s.keys.filter((k) => k !== id) : [...s.keys, id] })),
      clear: () => set({ keys: [] }),
    }),
    { name: 'cta-my-keys' },
  ),
);
