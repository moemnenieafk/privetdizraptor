import { HEADER_DICTIONARY, type MenuItem } from '@/data/headerConfig';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';
import type { SectionPlaceholderTab } from '@/components/ui/SectionPlaceholder';

/** Рекурсивный поиск узла меню по точному пути (как в items/[...category]). */
export function findNodeByPath(items: MenuItem[], targetPath: string): MenuItem | null {
  for (const item of items) {
    if (item.path === targetPath) return item;
    if (item.children) {
      const found = findNodeByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

export interface SectionPlaceholderData {
  title: string;
  description?: string;
  iconUrl?: string;
  iconClass?: string;
  tabs: SectionPlaceholderTab[];
  activeHref: string;
}

/**
 * Собирает пропсы для `SectionPlaceholder` из дерева меню EFT по текущему пути.
 * Табы = дети узла (если есть) либо соседи (дети родителя). Возвращает null,
 * если путь не найден в меню → роут вызывает notFound().
 */
export function getSectionPlaceholder(currentPath: string): SectionPlaceholderData | null {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const node = findNodeByPath(eftMenu, currentPath);
  if (!node) return null;

  const parentPath = currentPath.split('/').slice(0, -1).join('/');
  const parentNode = findNodeByPath(eftMenu, parentPath);
  const tabSource = node.children && node.children.length > 0 ? node.children : (parentNode?.children ?? []);

  const tabs: SectionPlaceholderTab[] = tabSource.map((child) => ({
    id: child.id,
    label: child.menuTitle ?? child.label,
    href: child.path ?? '#',
    iconUrl: child.iconUrl ?? child.iconUrlBear,
  }));

  const pageId = currentPath.replace(/^\//, '').replace(/\//g, '-');
  const pageContent = PAGE_CONTENT_DICTIONARY[pageId];

  return {
    title: pageContent?.title ?? node.label,
    description: pageContent?.description,
    iconUrl: node.iconUrl ?? node.iconUrlBear,
    iconClass: pageContent?.iconClass,
    tabs,
    activeHref: currentPath,
  };
}
