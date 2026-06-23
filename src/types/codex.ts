/**
 * Статьи раздела «Кодекс» (gamesetting). Контент — research-лор EFT
 * (внутриигровые тексты, веб-сериал BSG, заявления разработчиков). Без внешних ссылок.
 */

export interface CodexSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export interface CodexTimelineEntry {
  date: string;
  title: string;
  text: string;
}

export interface CodexRelated {
  label: string;
  href: string;
}

export interface CodexArticle {
  slug: string;
  title: string;
  subtitle?: string;
  /** Иконка-глиф в шапке (маска), напр. '/icons/eft/05-gamesetting/tarkov-lore.svg'. */
  icon?: string;
  intro: string;
  sections: CodexSection[];
  /** Вертикальный таймлайн (только «Хронология»). */
  timeline?: CodexTimelineEntry[];
  related?: CodexRelated[];
  /** Типы источников (in-game / BSG Raid / dev statement) — без URL. */
  sources?: string[];
  confidence?: 'canon' | 'mixed';
}
