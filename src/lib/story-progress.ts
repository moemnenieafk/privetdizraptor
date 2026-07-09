// Прогресс walkthrough-историй: чистый расчёт «шагов пройдено / всего» + «продолжить с главы N».
// Логика 1:1 с деривацией stepDone в StoryWalkthrough (чеки useStoryProgressStore +
// авто-чек убежища). Держим отдельно, чтобы дайджест «Трекинга» считал прогресс без рендера гайда.
// Решение: docs/decisions/done/tracking-story-quests.md.
import type {
  StoryWalkthrough,
  WalkthroughStep,
  WalkthroughSubStep,
  WalkthroughBlock,
  WalkthroughCondition,
} from '@/data/story-walkthroughs/types';
import { storyConditionKey, storyBranchKey } from '@/store/useStoryProgressStore';

export interface StoryProgress {
  /** Пройдено контентных шагов. */
  done: number;
  /** Всего контентных шагов истории. */
  total: number;
  /** Первый непройденный контентный шаг (для «продолжить с главы N»); null — история пройдена. */
  nextStep: number | null;
}

// Убежище авто-чекается: условие-постройка закрыто, если уровень станции достигнут.
function isAutoDone(c: WalkthroughCondition, levels: Record<string, number>): boolean {
  return c.kind === 'hideout' && c.station
    ? (levels[c.station.normalizedName] ?? 0) >= c.station.level
    : false;
}

// Под-шаги шага с учётом выбранной ветки развилки.
function subsFor(step: WalkthroughStep, choice: string | undefined): WalkthroughSubStep[] {
  if (step.branches) {
    const br = step.branches.find((b) => b.id === choice);
    return br ? br.substeps : [];
  }
  return step.substeps ?? [];
}

function stepHasContent(s: WalkthroughStep): boolean {
  return (
    s.blocks.length > 0 || Boolean(s.media) || Boolean(s.branches?.length) || Boolean(s.substeps?.length)
  );
}

// Все condition-блоки списка закрыты? Пустой список условий → allowEmpty.
function blocksDone(
  blocks: WalkthroughBlock[],
  slug: string,
  n: number,
  subId: string | undefined,
  allowEmpty: boolean,
  conditionDone: Record<string, boolean>,
  levels: Record<string, number>,
): boolean {
  const cond = blocks.map((b, idx) => ({ b, idx })).filter(({ b }) => b.condition);
  if (cond.length === 0) return allowEmpty;
  return cond.every(({ b, idx }) => {
    const key = storyConditionKey(slug, n, idx, subId);
    return conditionDone[key] || (b.condition ? isAutoDone(b.condition, levels) : false);
  });
}

// Готовность шага: свои условия + все под-шаги выбранного пути (развилка требует выбора).
function stepDone(
  story: StoryWalkthrough,
  s: WalkthroughStep,
  conditionDone: Record<string, boolean>,
  branchChoice: Record<string, string>,
  levels: Record<string, number>,
): boolean {
  const choice = branchChoice[storyBranchKey(story.slug, s.n)];
  const subs = subsFor(s, choice);
  const subDone = (sub: WalkthroughSubStep) =>
    blocksDone(sub.blocks, story.slug, s.n, sub.id, false, conditionDone, levels);

  if (s.branches) {
    return (
      Boolean(choice) &&
      subs.length > 0 &&
      subs.every(subDone) &&
      blocksDone(s.blocks, story.slug, s.n, undefined, true, conditionDone, levels)
    );
  }
  if (s.substeps?.length) {
    return (
      subs.every(subDone) &&
      blocksDone(s.blocks, story.slug, s.n, undefined, true, conditionDone, levels)
    );
  }
  return blocksDone(s.blocks, story.slug, s.n, undefined, false, conditionDone, levels);
}

// Прогресс одной истории по её контентным шагам.
export function computeStoryProgress(
  story: StoryWalkthrough,
  conditionDone: Record<string, boolean>,
  branchChoice: Record<string, string>,
  levels: Record<string, number>,
): StoryProgress {
  const steps = story.steps.filter(stepHasContent);
  let done = 0;
  let nextStep: number | null = null;
  for (const s of steps) {
    if (stepDone(story, s, conditionDone, branchChoice, levels)) done += 1;
    else if (nextStep === null) nextStep = s.n;
  }
  return { done, total: steps.length, nextStep };
}
