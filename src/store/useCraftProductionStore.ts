import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Трекинг активного производства крафтов убежища (спека craft-production-tracker §2).
 *
 * Одна станция = один активный крафт (реш. A): ключ — stationKey, значение — снапшот запуска.
 * `durationSec` замораживается в момент старта (эффективное время с текущим навыком) — прокачка
 * навыка позже идущий крафт НЕ ускоряет. Таймер экстраполируется от `startedAt` на клиенте.
 *
 * persist localStorage; _hasHydrated — флаг завершённой гидрации (паттерн useManualProfileStore).
 */
export type ProductionEntry = { craftId: string; startedAt: number; durationSec: number };

interface CraftProductionStore {
  active: Record<string, ProductionEntry>;
  _hasHydrated: boolean;

  /** Старт ТОЛЬКО если станция свободна (нет активной записи). Пишет снапшот. Занята → false. */
  start: (stationKey: string, craftId: string, durationSec: number) => boolean;
  /** Отмена крафта — удаляет запись станции. */
  cancel: (stationKey: string) => void;
  /** Забрать крафт — удаляет запись, освобождает станцию (эффект как cancel; имя для ясности сайта вызова). */
  collect: (stationKey: string) => void;
  reset: () => void;
}

export const useCraftProductionStore = create<CraftProductionStore>()(
  persist(
    (set, get) => ({
      active: {},
      _hasHydrated: false,

      start: (stationKey, craftId, durationSec) => {
        if (get().active[stationKey]) return false;
        const safeDuration = Number.isFinite(durationSec) ? Math.max(0, Math.floor(durationSec)) : 0;
        set((state) => ({
          active: {
            ...state.active,
            [stationKey]: { craftId, startedAt: Date.now(), durationSec: safeDuration },
          },
        }));
        return true;
      },

      cancel: (stationKey) =>
        set((state) => {
          const next = { ...state.active };
          delete next[stationKey];
          return { active: next };
        }),

      collect: (stationKey) =>
        set((state) => {
          const next = { ...state.active };
          delete next[stationKey];
          return { active: next };
        }),

      reset: () => set({ active: {} }),
    }),
    {
      name: 'craft-production-storage',
      partialize: (s) => ({ active: s.active }),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
    },
  ),
);

/** Остаток секунд крафта, кламп ≥0. Защита от NaN/отрицательных: невалидные поля → 0. */
export function remainingSec(
  entry: { startedAt: number; durationSec: number },
  now: number,
): number {
  const duration = Number.isFinite(entry.durationSec) ? entry.durationSec : 0;
  const started = Number.isFinite(entry.startedAt) ? entry.startedAt : now;
  const nowSafe = Number.isFinite(now) ? now : started;
  const elapsed = Math.floor((nowSafe - started) / 1000);
  return Math.max(0, duration - elapsed);
}

/** Статус крафта: таймер>0 → «producing», иначе «done». */
export function productionStatus(
  entry: { startedAt: number; durationSec: number },
  now: number,
): 'producing' | 'done' {
  return remainingSec(entry, now) > 0 ? 'producing' : 'done';
}
