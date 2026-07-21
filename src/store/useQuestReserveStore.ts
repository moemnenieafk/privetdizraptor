import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Распределение предметов из схрона по заданиям.
 *
 * Счётчик «В схроне» (useInventoryStore) знает только общее количество: если
 * ключ-карта нужна в трёх заданиях по одной штуке, а в схроне лежит одна — без
 * распределения все три задания показали бы себя закрытыми. Здесь хранится,
 * сколько единиц игрок закрепил за конкретным заданием.
 *
 * Структура: questId -> itemId -> количество. Ноль не хранится, ключи чистятся,
 * иначе стор растёт мусором при каждом снятии резерва.
 */
interface QuestReserveStore {
  reserved: Record<string, Record<string, number>>;
  /** Сколько закреплено за конкретным заданием. */
  getReserved: (questId: string, itemId: string) => number;
  /** Сколько закреплено за всеми заданиями суммарно. */
  getTotalReserved: (itemId: string) => number;
  setReserved: (questId: string, itemId: string, count: number) => void;
  clearQuest: (questId: string) => void;
}

export const useQuestReserveStore = create<QuestReserveStore>()(
  persist(
    (set, get) => ({
      reserved: {},

      getReserved: (questId, itemId) => get().reserved[questId]?.[itemId] ?? 0,

      getTotalReserved: (itemId) => {
        let total = 0;
        for (const perItem of Object.values(get().reserved)) total += perItem[itemId] ?? 0;
        return total;
      },

      setReserved: (questId, itemId, count) =>
        set((state) => {
          const next = { ...state.reserved };
          const perQuest = { ...(next[questId] ?? {}) };

          if (count <= 0) delete perQuest[itemId];
          else perQuest[itemId] = count;

          if (Object.keys(perQuest).length === 0) delete next[questId];
          else next[questId] = perQuest;

          return { reserved: next };
        }),

      clearQuest: (questId) =>
        set((state) => {
          if (!state.reserved[questId]) return state;
          const next = { ...state.reserved };
          delete next[questId];
          return { reserved: next };
        }),
    }),
    { name: 'cta-quest-reserve' },
  ),
);

/**
 * Сколько единиц предмета ещё свободно: в схроне минус закреплённое
 * за другими заданиями. Не селектор, чтобы не тянуть два стора в один хук.
 */
export function freeForQuest(
  owned: number,
  totalReserved: number,
  reservedHere: number,
): number {
  return Math.max(0, owned - (totalReserved - reservedHere));
}
