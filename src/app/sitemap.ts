import type { MetadataRoute } from 'next';
import { HEADER_DICTIONARY, type MenuItem } from '@/data/headerConfig';
import { INTERACTIVE_MAP_SLUGS } from '@/data/eft-map-config';
import { STORY_WALKTHROUGHS } from '@/data/story-walkthroughs';
import { LOOT_CONTAINERS } from '@/data/loot-containers';
import { LEGAL_DOC_ORDER, LEGAL_DOCS } from '@/data/legal-docs';
import { PRIVATE_PATHS, absoluteUrl } from '@/lib/site';

// Sitemap строится из дерева навигации (единый источник правды) + статических датасетов.
// Динамика из БД (5000+ предметов) сюда сознательно НЕ тянется: билд не должен зависеть
// от Supabase. Каталоги категорий в sitemap есть — краулер дойдёт до карточек по ссылкам.

const isPrivate = (path: string) =>
  PRIVATE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/** Рекурсивный обход дерева меню → плоский список путей. */
function collectMenuPaths(items: MenuItem[], acc: Set<string>): void {
  for (const item of items) {
    if (item.path?.startsWith('/') && !isPrivate(item.path)) acc.add(item.path);
    if (item.children?.length) collectMenuPaths(item.children, acc);
    if (item.subItems?.length) collectMenuPaths(item.subItems, acc);
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const paths = new Set<string>(['/', '/eft']);

  for (const config of Object.values(HEADER_DICTIONARY)) {
    collectMenuPaths(config.menuItems, paths);
  }

  for (const slug of INTERACTIVE_MAP_SLUGS) paths.add(`/eft/maps/${slug}`);
  for (const slug of Object.keys(STORY_WALKTHROUGHS)) paths.add(`/eft/quests/${slug}`);
  for (const c of LOOT_CONTAINERS) paths.add(`/eft/loot-containers/${c.slug}`);
  for (const slug of LEGAL_DOC_ORDER) {
    // Черновики юр-документов в индекс не отдаём.
    if (!LEGAL_DOCS[slug].draft) paths.add(`/legal/${slug}`);
  }

  const priorityOf = (path: string): number => {
    if (path === '/') return 1;
    if (path === '/eft') return 0.9;
    if (path.startsWith('/legal')) return 0.3;
    return path.split('/').length <= 3 ? 0.8 : 0.6;
  };

  return [...paths].sort().map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path.startsWith('/eft/items') ? 'daily' : 'weekly',
    priority: priorityOf(path),
  }));
}
