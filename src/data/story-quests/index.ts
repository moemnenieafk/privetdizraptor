import type { StoryQuestChapter } from '@/types/story-quest';
import { tour } from './tour';
import { heavenOnFire } from './heaven-on-fire';
import { ticket } from './ticket';
import { witness } from './witness';
import { batya } from './batya';
import { blueFire } from './blue-fire';
import { alreadyHere } from './already-here';
import { unknowns } from './unknowns';
import { labyrinth } from './labyrinth';
import { boreas } from './boreas';

/** Сюжетные главы по slug (совпадает с путями /eft/quests/<slug> в headerConfig). */
export const STORY_QUESTS: Record<string, StoryQuestChapter> = {
  tour,
  'heaven-on-fire': heavenOnFire,
  ticket,
  witness,
  batya,
  'blue-fire': blueFire,
  'already-here': alreadyHere,
  unknowns,
  labyrinth,
  boreas,
};

export const STORY_QUEST_LIST: StoryQuestChapter[] = Object.values(STORY_QUESTS).sort(
  (a, b) => a.chapterNumber - b.chapterNumber,
);

export function getStoryQuest(slug: string): StoryQuestChapter | null {
  return STORY_QUESTS[slug] ?? null;
}
