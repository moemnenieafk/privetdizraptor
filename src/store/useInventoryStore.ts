import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface InventoryStore {
  ownedItems: Record<string, number>;
  /** Метка «найдено в рейде» — ПО ОТДЕЛЬНОЙ ЯЧЕЙКЕ схрона (не по предмету целиком): ключ = юнит-ключ
   *  ячейки `${itemId}#${stackIndex}` (тот же cell.id, что в раскладке). Клик по ячейке помечает
   *  ровно её, не трогая другие стеки/копии того же предмета. Значение — просто признак (true).
   *  Для будущей связки с «Важными предметами» FiR-количество предмета выводится суммой помеченных
   *  ячеек этого itemId (× stackCount). Осиротевшие ключи (стек исчез при уменьшении владения) не
   *  рендерятся и безвредны; полностью чистятся при resetStash. */
  firUnits: Record<string, boolean>;
  /** Одноразовая миграция: прогресс убежища (itemProgress) слит в схрон. persist,
   *  гарант идемпотентности migrateHideoutProgressIntoStash (src/lib/stash-migration.ts). */
  hideoutMerged: boolean;
  setHideoutMerged: (v: boolean) => void;
  getCount: (id: string) => number;
  setCount: (id: string, n: number) => void;
  /** Функциональный ±delta с клампом [0, max] от ЖИВОГО значения стора (против гонки
   *  быстрых кликов hold-repeat: onChange от рендер-value «залипает»). Тот же приём, что
   *  useHideoutStore.bumpItemProgress. Прямой ввод числа по-прежнему идёт через setCount. */
  bumpCount: (id: string, delta: number, max: number) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  /** Переключить FiR-метку ОДНОЙ ячейки схрона по её юнит-ключу (cell.id `${itemId}#${i}`). */
  toggleFirUnit: (unitKey: string) => void;
  /** Полный сброс схрона: очищает всё владение и FiR-метки. Флаг hideoutMerged НЕ трогаем
   *  (миграция уже проведена, повторять её не нужно). */
  resetStash: () => void;
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      ownedItems: {},
      firUnits: {},
      hideoutMerged: false,
      setHideoutMerged: (v) => set({ hideoutMerged: v }),
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
      toggleFirUnit: (unitKey) =>
        set((state) => {
          const copy = { ...state.firUnits };
          if (copy[unitKey]) delete copy[unitKey];
          else copy[unitKey] = true;
          return { firUnits: copy };
        }),
      resetStash: () => set({ ownedItems: {}, firUnits: {} }),
    }),
    { name: 'cta-inventory' }
  )
);
