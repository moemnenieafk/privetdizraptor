import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskRaw, TaskObjective, TaskObjectiveItem } from '@/types/quest';

interface QuestStore {
  // Runtime cache — populated by QuestMapClient on mount, not persisted
  tasks: TaskRaw[];
  setTasks: (tasks: TaskRaw[]) => void;

  completedQuests: string[];
  toggleQuest: (id: string) => void;
  resetProgress: () => void;

  // UX-3: Item tracking — questId → objectiveId → foundCount
  itemProgress: Record<string, Record<string, number>>;
  setItemCount: (questId: string, objectiveId: string, count: number) => void;
  incrementItem: (questId: string, objectiveId: string, max: number) => void;
  decrementItem: (questId: string, objectiveId: string) => void;
  resetItemProgress: (questId: string) => void;

  // B: завершение НЕ-предметных целей (галки) — локально-персистентно (Tier 1).
  // Item-цели завершаются через itemProgress (счётчик ≥ нужного), тут их нет.
  checkedObjectives: Record<string, string[]>; // questId → objectiveId[]
  toggleCheckedObjective: (questId: string, objectiveId: string) => void;

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
      tasks: [],
      setTasks: (tasks) => set({ tasks }),

      completedQuests: [],
      toggleQuest: (id) =>
        set((s) => {
          const isCompleting = !s.completedQuests.includes(id);
          return {
            completedQuests: isCompleting
              ? [...s.completedQuests, id]
              : s.completedQuests.filter((q) => q !== id),
            pinnedQuests: isCompleting
              ? s.pinnedQuests.filter((p) => p !== id)
              : s.pinnedQuests,
          };
        }),
      resetProgress: () => set({ completedQuests: [], itemProgress: {}, checkedObjectives: {} }),

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
          const { [questId]: _item, ...itemRest } = s.itemProgress;
          const { [questId]: _checks, ...checkRest } = s.checkedObjectives;
          return { itemProgress: itemRest, checkedObjectives: checkRest };
        }),

      checkedObjectives: {},
      toggleCheckedObjective: (questId, objectiveId) =>
        set((s) => {
          const cur = s.checkedObjectives[questId] ?? [];
          const next = cur.includes(objectiveId)
            ? cur.filter((o) => o !== objectiveId)
            : [...cur, objectiveId];
          const rest = { ...s.checkedObjectives };
          if (next.length) rest[questId] = next;
          else delete rest[questId];
          return { checkedObjectives: rest };
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
        checkedObjectives: s.checkedObjectives,
        pinnedQuests: s.pinnedQuests,
        questNotes: s.questNotes,
      }),
    },
  ),
);

// B: единый предикат «цель завершена». item-цель — счётчик ≥ нужного (перс. itemProgress);
// прочие — прожата галка (перс. checkedObjectives). Используют QuestDetail и авто-закрытие.
export function isObjectiveComplete(
  obj: TaskObjective,
  questId: string,
  itemProgress: Record<string, Record<string, number>>,
  checkedObjectives: Record<string, string[]>,
): boolean {
  if (obj.__typename === 'TaskObjectiveItem') {
    const count = (obj as TaskObjectiveItem).count ?? 0;
    if (count === 0) return true;
    return (itemProgress[questId]?.[obj.id] ?? 0) >= count;
  }
  return checkedObjectives[questId]?.includes(obj.id) ?? false;
}

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
