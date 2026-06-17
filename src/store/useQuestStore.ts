import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskRaw, TaskObjectiveItem } from '@/types/quest';

interface QuestStore {
  completedQuests: string[];
  toggleQuest: (id: string) => void;
  resetProgress: () => void;

  // UX-3: Item tracking — questId → objectiveId → foundCount
  itemProgress: Record<string, Record<string, number>>;
  setItemCount: (questId: string, objectiveId: string, count: number) => void;
  incrementItem: (questId: string, objectiveId: string, max: number) => void;
  decrementItem: (questId: string, objectiveId: string) => void;
  resetItemProgress: (questId: string) => void;
}

export const useQuestStore = create<QuestStore>()(
  persist(
    (set) => ({
      completedQuests: [],
      toggleQuest: (id) =>
        set((s) => ({
          completedQuests: s.completedQuests.includes(id)
            ? s.completedQuests.filter((q) => q !== id)
            : [...s.completedQuests, id],
        })),
      resetProgress: () => set({ completedQuests: [], itemProgress: {} }),

      itemProgress: {},

      setItemCount: (questId, objectiveId, count) =>
        set((s) => ({
          itemProgress: {
            ...s.itemProgress,
            [questId]: { ...(s.itemProgress[questId] ?? {}), [objectiveId]: Math.max(0, count) },
          },
        })),

      incrementItem: (questId, objectiveId, max) =>
        set((s) => {
          const current = s.itemProgress[questId]?.[objectiveId] ?? 0;
          return {
            itemProgress: {
              ...s.itemProgress,
              [questId]: { ...(s.itemProgress[questId] ?? {}), [objectiveId]: Math.min(max, current + 1) },
            },
          };
        }),

      decrementItem: (questId, objectiveId) =>
        set((s) => {
          const current = s.itemProgress[questId]?.[objectiveId] ?? 0;
          return {
            itemProgress: {
              ...s.itemProgress,
              [questId]: { ...(s.itemProgress[questId] ?? {}), [objectiveId]: Math.max(0, current - 1) },
            },
          };
        }),

      resetItemProgress: (questId) =>
        set((s) => {
          const { [questId]: _removed, ...rest } = s.itemProgress;
          return { itemProgress: rest };
        }),
    }),
    {
      name: 'cta-quest-progress',
      partialize: (s) => ({
        completedQuests: s.completedQuests,
        itemProgress: s.itemProgress,
      }),
    },
  ),
);

// Bridge API for /eft/progress/items — агрегирует все нужные предметы из активных квестов
export function getActiveItemRequirements(
  tasks: TaskRaw[],
  completedQuests: string[],
  itemProgress: Record<string, Record<string, number>>,
): Array<{
  questId: string;
  questName: string;
  objectiveId: string;
  item: { id: string; name: string; shortName: string; image512pxLink: string };
  needed: number;
  found: number;
  foundInRaid: boolean;
}> {
  const completedSet = new Set(completedQuests);
  return tasks
    .filter((t) => !completedSet.has(t.id))
    .flatMap((t) =>
      t.objectives
        .filter((o): o is TaskObjectiveItem => o.__typename === 'TaskObjectiveItem')
        .map((o) => ({
          questId: t.id,
          questName: t.name,
          objectiveId: o.id,
          item: o.item,
          needed: o.count,
          found: itemProgress[t.id]?.[o.id] ?? 0,
          foundInRaid: o.foundInRaid,
        })),
    );
}
