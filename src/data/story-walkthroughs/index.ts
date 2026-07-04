// Реестр walkthrough-гайдов сюжетных историй: слаг → данные (порядок = хронология глав).
// Новая история = файл рядом + запись здесь. Типы модели — ./types.

import type { StoryWalkthrough } from './types';
import { TOUR_WALKTHROUGH } from './tour';
import { HEAVEN_ON_FIRE_WALKTHROUGH } from './heaven-on-fire';
import { TICKET_WALKTHROUGH } from './ticket';
import { BATYA_WALKTHROUGH } from './batya';
import { UNKNOWNS_WALKTHROUGH } from './unknowns';
import { BLUE_FIRE_WALKTHROUGH } from './blue-fire';
import { ALREADY_HERE_WALKTHROUGH } from './already-here';
import { WITNESS_WALKTHROUGH } from './witness';
import { LABYRINTH_WALKTHROUGH } from './labyrinth';
import { BOREAS_WALKTHROUGH } from './boreas';

export const STORY_WALKTHROUGHS: Record<string, StoryWalkthrough> = {
  tour: TOUR_WALKTHROUGH,
  'heaven-on-fire': HEAVEN_ON_FIRE_WALKTHROUGH,
  ticket: TICKET_WALKTHROUGH,
  batya: BATYA_WALKTHROUGH,
  unknowns: UNKNOWNS_WALKTHROUGH,
  'blue-fire': BLUE_FIRE_WALKTHROUGH,
  'already-here': ALREADY_HERE_WALKTHROUGH,
  witness: WITNESS_WALKTHROUGH,
  labyrinth: LABYRINTH_WALKTHROUGH,
  boreas: BOREAS_WALKTHROUGH,
};
