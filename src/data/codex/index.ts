import type { CodexArticle } from '@/types/codex';
import { loreArticle } from './lore';
import { timelineArticle } from './timeline';
import { factionsArticle } from './factions';
import { corporationsArticle } from './corporations';
import { locationsArticle } from './locations';
import { theoriesArticle } from './theories';
import { audiotapesArticle } from './audiotapes';
import { docsNotesArticle } from './docs-notes';

// Реестр статей кодекса (gamesetting). research-лор EFT, см. @/types/codex.
const CODEX_ARTICLES: Record<string, CodexArticle> = {
  lore: loreArticle,
  timeline: timelineArticle,
  factions: factionsArticle,
  corporations: corporationsArticle,
  locations: locationsArticle,
  theories: theoriesArticle,
  audiotapes: audiotapesArticle,
  'docs-notes': docsNotesArticle,
};

export function getCodexArticle(slug: string): CodexArticle | null {
  return CODEX_ARTICLES[slug] ?? null;
}

// Статика — первичный источник для сида БД (E10, фаза 3) и аварийный фолбэк,
// пока миграция не накатана. После сида источник правды — таблица codex_articles.
export const STATIC_CODEX = CODEX_ARTICLES;
export const CODEX_SLUGS = Object.keys(CODEX_ARTICLES);
