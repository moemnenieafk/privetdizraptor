import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Построенные уровни станций убежища (для «осталось собрать» и «запускаемо сейчас»).
// Ключ — stationNormalizedName из зеркала hideout_upgrades; значение — текущий уровень (0 = не построен).
//
// itemProgress — «бак материалов» вкладки «Трекинг»: счётчики собранных предметов
// под конкретный уровень станции. Ключ: `${station}|${level}|${itemId}`.
// При постройке уровня счётчики этого уровня очищаются (материалы «потрачены»).
interface HideoutStore {
  levels: Record<string, number>;
  itemProgress: Record<string, number>;
  setLevel: (station: string, level: number) => void;
  setItemProgress: (key: string, count: number) => void;
  /** Функциональный ±delta (читает живое значение стора, клампит [0, max]) — против гонок быстрых кликов. */
  bumpItemProgress: (key: string, delta: number, max: number) => void;
  clearLevelProgress: (station: string, level: number) => void;
  /** Обнулить ВЕСЬ прогресс сбора материалов (не трогает построенные уровни). */
  clearItemProgress: () => void;
  reset: () => void;
}

export const hideoutItemKey = (station: string, level: number, itemId: string) =>
  `${station}|${level}|${itemId}`;

export const useHideoutStore = create<HideoutStore>()(
  persist(
    (set) => ({
      levels: {},
      itemProgress: {},
      setLevel: (station, level) =>
        set((state) => ({ levels: { ...state.levels, [station]: Math.max(0, level) } })),
      setItemProgress: (key, count) =>
        set((state) => ({ itemProgress: { ...state.itemProgress, [key]: Math.max(0, count) } })),
      bumpItemProgress: (key, delta, max) =>
        set((state) => {
          const cur = state.itemProgress[key] ?? 0;
          return { itemProgress: { ...state.itemProgress, [key]: Math.max(0, Math.min(max, cur + delta)) } };
        }),
      clearItemProgress: () => set({ itemProgress: {} }),
      clearLevelProgress: (station, level) =>
        set((state) => {
          const prefix = `${station}|${level}|`;
          const next: Record<string, number> = {};
          for (const [k, v] of Object.entries(state.itemProgress)) {
            if (!k.startsWith(prefix)) next[k] = v;
          }
          return { itemProgress: next };
        }),
      reset: () => set({ levels: {}, itemProgress: {} }),
    }),
    { name: 'cta-hideout' },
  ),
);
