/**
 * Сюжетные (lore) квесты EFT — длинные walkthrough-гайды.
 * Контент — из docs/new-pages/Руководство_Сюжетных_Квестов_Tarkov_2.md.
 * Отличается от трейдерских квестов (те — список QuestNode из EFT_QUESTS).
 */

export type StoryDifficulty = 'Лёгкая' | 'Средняя' | 'Сложная' | 'Экстрим';

/** Строка таблицы требуемых предметов / целей. */
export interface StoryItemRow {
  item: string;
  count?: string;
  status?: string;
  location?: string;
}

/** Вариант выбора (ветвление сюжета, напр. кейс в «Билете»). */
export interface StoryDecisionOption {
  label: string;
  consequence: string;
  reward?: string;
}

/** Блок walkthrough — дискриминированный союз (никаких any). */
export type StorySection =
  | { type: 'text'; heading?: string; paragraphs: string[] }
  | { type: 'steps'; heading?: string; steps: { title?: string; text: string }[] }
  | { type: 'items'; heading: string; note?: string; rows: StoryItemRow[] }
  | { type: 'decision'; heading: string; note?: string; options: StoryDecisionOption[] };

export interface StoryVideoGuide {
  url: string;
  title?: string;
  author?: string;
}

export interface StoryQuestChapter {
  slug: string;
  titleRu: string;
  titleEn: string;
  chapterNumber: number;
  difficulty?: StoryDifficulty;
  /** Hero-изображение; пока не задано — рендерится стилизованная заглушка. */
  heroImage?: string;
  summary: string;
  activation?: string;
  prerequisites?: string[];
  sections: StorySection[];
  rewards?: string[];
  achievement?: string;
  videoGuides?: StoryVideoGuide[];
}
