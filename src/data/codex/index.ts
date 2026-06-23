import type { CodexArticle } from '@/types/codex';
import { loreArticle } from './lore';
import { timelineArticle } from './timeline';
import { factionsArticle } from './factions';
import { corporationsArticle } from './corporations';
import { locationsArticle } from './locations';
import { theoriesArticle } from './theories';

// Реестр статей кодекса (gamesetting). research-лор EFT, см. @/types/codex.
const CODEX_ARTICLES: Record<string, CodexArticle> = {
  lore: loreArticle,
  timeline: timelineArticle,
  factions: factionsArticle,
  corporations: corporationsArticle,
  locations: locationsArticle,
  theories: theoriesArticle,
};

export function getCodexArticle(slug: string): CodexArticle | null {
  return CODEX_ARTICLES[slug] ?? null;
}
