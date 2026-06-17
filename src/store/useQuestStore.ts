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

  // UX-8: Progress persistence
  loadProgress: (completedQuests: string[], itemProgress: Record<string, Record<string, number>>) => void;

  // UX-9: Pins & Notes
  pinnedQuests: string[];
  togglePin: (id: string) => void;
  questNotes: Record<string, string>;
  setNote: (id: string, note: string) => void;
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

      loadProgress: (completedQuests, itemProgress) => set({ completedQuests, itemProgress }),

      pinnedQuests: [],
      togglePin: (id) =>
        set((s) => ({
          pinnedQuests: s.pinnedQuests.includes(id)
            ? s.pinnedQuests.filter((q) => q !== id)
            : [...s.pinnedQuests, id],
        })),

      questNotes: {},
      setNote: (id, note) =>
        set((s) => ({
          questNotes: { ...s.questNotes, [id]: note },
        })),
    }),
    {
      name: 'cta-quest-progress',
      partialize: (s) => ({
        completedQuests: s.completedQuests,
        itemProgress: s.itemProgress,
        pinnedQuests: s.pinnedQuests,
        questNotes: s.questNotes,
      }),
    },
  ),
);

// Bridge API for /eft/progress/tracker
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

// UX-8: Export/Import helpers
export function exportProgress(
  completedQuests: string[],
  itemProgress: Record<string, Record<string, number>>,
): string {
  return JSON.stringify({ version: 1, completedQuests, itemProgress }, null, 2);
}

export function importProgress(json: string): {
  completedQuests: string[];
  itemProgress: Record<string, Record<string, number>>;
} | null {
  try {
    const data = JSON.parse(json) as unknown;
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    if (d.version !== 1) return null;
    if (!Array.isArray(d.completedQuests)) return null;
    return {
      completedQuests: d.completedQuests as string[],
      itemProgress: (d.itemProgress as Record<string, Record<string, number>>) ?? {},
    };
  } catch {
    return null;
  }
}
