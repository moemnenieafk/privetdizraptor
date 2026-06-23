import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Построенные уровни станций убежища (для «осталось собрать» и «запускаемо сейчас»).
// Ключ — stationNormalizedName из зеркала hideout_upgrades; значение — текущий уровень (0 = не построен).
interface HideoutStore {
  levels: Record<string, number>;
  setLevel: (station: string, level: number) => void;
  reset: () => void;
}

export const useHideoutStore = create<HideoutStore>()(
  persist(
    (set) => ({
      levels: {},
      setLevel: (station, level) =>
        set((state) => ({ levels: { ...state.levels, [station]: Math.max(0, level) } })),
      reset: () => set({ levels: {} }),
    }),
    { name: 'cta-hideout' },
  ),
);
