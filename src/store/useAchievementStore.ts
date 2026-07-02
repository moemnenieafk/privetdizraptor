import { create } from "zustand";
import { persist } from "zustand/middleware";

// Фаза 2 достижений — ручной трекинг игрока (публичного API «ачивки игрока» в EFT нет).
// completed — «выполнено», tracked — «отслеживаю» (вотчлист). Persist локально; для
// залогиненных синкается в БД через AchievementSync (зеркало ProgressSync квестов).
interface AchievementStore {
  completedIds: string[];
  trackedIds: string[];
  toggleCompleted: (id: string) => void;
  toggleTracked: (id: string) => void;
  /** заливка из облака при логине */
  loadProgress: (completedIds: string[], trackedIds: string[]) => void;
  resetProgress: () => void;
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set) => ({
      completedIds: [],
      trackedIds: [],
      toggleCompleted: (id) =>
        set((s) => {
          const isDone = !s.completedIds.includes(id);
          return {
            completedIds: isDone
              ? [...s.completedIds, id]
              : s.completedIds.filter((x) => x !== id),
            // выполненное снимаем из вотчлиста
            trackedIds: isDone ? s.trackedIds.filter((x) => x !== id) : s.trackedIds,
          };
        }),
      toggleTracked: (id) =>
        set((s) => ({
          trackedIds: s.trackedIds.includes(id)
            ? s.trackedIds.filter((x) => x !== id)
            : [...s.trackedIds, id],
        })),
      loadProgress: (completedIds, trackedIds) => set({ completedIds, trackedIds }),
      resetProgress: () => set({ completedIds: [], trackedIds: [] }),
    }),
    {
      name: "cta-achievement-progress",
      partialize: (s) => ({
        completedIds: s.completedIds,
        trackedIds: s.trackedIds,
      }),
    },
  ),
);
