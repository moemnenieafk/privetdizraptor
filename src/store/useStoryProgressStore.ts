import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Прогресс walkthrough-гайдов сюжетных историй (страница /eft/quests/<story>).
// Чеки «ВЫПОЛНЕНО?» условий: ключ `${slug}|${step}|${blockIdx}` (шаг) или
// `${slug}|${step}|${subId}|${blockIdx}` (под-шаг ветки/вложенности).
// branchChoice — выбранный игроком путь на шаге-развилке: `${slug}|${step}` → branchId.
// v1 — localStorage (облако — отдельной задачей, см. tracking-story-quests).
interface StoryProgressStore {
  conditionDone: Record<string, boolean>;
  branchChoice: Record<string, string>;
  toggleCondition: (key: string) => void;
  setBranch: (key: string, branchId: string) => void;
  resetStory: (slug: string) => void;
}

export const storyConditionKey = (slug: string, step: number, blockIdx: number, subId?: string) =>
  subId ? `${slug}|${step}|${subId}|${blockIdx}` : `${slug}|${step}|${blockIdx}`;

export const storyBranchKey = (slug: string, step: number) => `${slug}|${step}`;

export const useStoryProgressStore = create<StoryProgressStore>()(
  persist(
    (set) => ({
      conditionDone: {},
      branchChoice: {},
      toggleCondition: (key) =>
        set((s) => ({ conditionDone: { ...s.conditionDone, [key]: !s.conditionDone[key] } })),
      setBranch: (key, branchId) =>
        set((s) => ({ branchChoice: { ...s.branchChoice, [key]: branchId } })),
      resetStory: (slug) =>
        set((s) => {
          const prefix = `${slug}|`;
          const nextDone: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(s.conditionDone)) {
            if (!k.startsWith(prefix)) nextDone[k] = v;
          }
          const nextBranch: Record<string, string> = {};
          for (const [k, v] of Object.entries(s.branchChoice)) {
            if (!k.startsWith(prefix)) nextBranch[k] = v;
          }
          return { conditionDone: nextDone, branchChoice: nextBranch };
        }),
    }),
    { name: 'cta-story-progress' },
  ),
);
