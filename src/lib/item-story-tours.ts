// Обратный индекс «предмет → сюжетные истории, где он нужен» для блока ТУР
// в левой колонке карточки предмета. Чистый расчёт (без React/стора) — гоняется
// в RSC (ItemDetailLayout), чтобы тяжёлые данные историй НЕ уезжали в клиент.
// Ключи условий строим той же storyConditionKey, что и walkthrough-страница, —
// клиент по ним считает N/M из useStoryProgressStore.
import { STORY_WALKTHROUGHS } from '@/data/story-walkthroughs';
import { storyConditionKey } from '@/store/useStoryProgressStore';
import type { StoryWalkthrough, WalkthroughBlock } from '@/data/story-walkthroughs/types';

export interface ItemStoryTour {
  slug: string;
  title: string;
  iconUrl: string;
  /** Hero-баннер истории (кропается object-cover в блоке ТУР). */
  heroImage?: string;
  /** Ключи condition-блоков истории, где нужен именно этот предмет (для прогресса N/M). */
  conditionKeys: string[];
}

function collectItemKeys(story: StoryWalkthrough, itemId: string): string[] {
  const keys: string[] = [];
  const scan = (blocks: WalkthroughBlock[], n: number, subId?: string) => {
    blocks.forEach((b, idx) => {
      if (b.condition?.item?.id === itemId) keys.push(storyConditionKey(story.slug, n, idx, subId));
    });
  };
  for (const step of story.steps) {
    scan(step.blocks, step.n);
    for (const sub of step.substeps ?? []) scan(sub.blocks, step.n, sub.id);
    for (const branch of step.branches ?? []) {
      for (const sub of branch.substeps) scan(sub.blocks, step.n, sub.id);
    }
  }
  return keys;
}

/** Истории, в которых этот предмет фигурирует как условие. Пусто → блок ТУР не рисуется. */
export function getItemStoryTours(itemId: string): ItemStoryTour[] {
  const tours: ItemStoryTour[] = [];
  for (const story of Object.values(STORY_WALKTHROUGHS)) {
    const conditionKeys = collectItemKeys(story, itemId);
    if (conditionKeys.length > 0) {
      tours.push({
        slug: story.slug,
        title: story.title,
        iconUrl: story.iconUrl,
        heroImage: story.heroImage,
        conditionKeys,
      });
    }
  }
  return tours;
}
