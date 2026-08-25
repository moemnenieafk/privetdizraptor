import { HEADER_DICTIONARY, type MenuItem } from '@/data/headerConfig';
import { findNodeByPath } from '@/lib/section-nav';

export interface SectionHubNavTab {
  id: string;
  label: string;
  menuTitle?: string;
  href: string;
  iconUrl?: string;
  /** Явное переопределение gate-ключа раздела (иначе выводится из href). */
  gateKey?: string;
  /** Проставляется навигацией: раздел за пэйволом (behavior='lock', нет доступа) → бейдж-замок. */
  locked?: boolean;
}

export interface SectionHubNavData {
  sections: SectionHubNavTab[];
  sub: { label: string; tabs: SectionHubNavTab[] } | null;
}

function toTabs(items: MenuItem[] | undefined): SectionHubNavTab[] {
  return (items ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    menuTitle: c.menuTitle,
    href: c.path || '#',
    iconUrl: c.iconUrl || '',
    gateKey: c.gateKey,
  }));
}

function findWithParent(
  items: MenuItem[],
  targetPath: string,
  parent: MenuItem | null,
): { node: MenuItem; parent: MenuItem | null } | null {
  for (const item of items) {
    if (item.path === targetPath) return { node: item, parent };
    if (item.children) {
      const found = findWithParent(item.children, targetPath, item);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Секция-агностичная навигация-переключатель из словаря меню (единый источник — HEADER_DICTIONARY):
 *  - sections: разделы верхнего уровня (дети rootPath) — всегда;
 *  - sub: подряд текущего узла (его дети) либо соседи (дети родителя), не дублируя ряд sections.
 * Аналог getQuestsNav, но параметризован корнем. Для «Кодекса»: rootPath='/eft/gamesetting'.
 */
export function getSectionHubNav(rootPath: string, currentPath: string): SectionHubNavData {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const root = findNodeByPath(eftMenu, rootPath);
  const sections = toTabs(root?.children);

  const found = findWithParent(root?.children ?? [], currentPath, root ?? null);
  let sub: SectionHubNavData['sub'] = null;
  if (found) {
    if (found.node.children && found.node.children.length > 0) {
      sub = { label: found.node.menuTitle ?? found.node.label, tabs: toTabs(found.node.children) };
    } else if (found.parent && found.parent !== root) {
      sub = { label: found.parent.menuTitle ?? found.parent.label, tabs: toTabs(found.parent.children) };
    }
  }
  return { sections, sub };
}

export interface SectionHubCard {
  id: string;
  title: string;
  description: string;
  href: string;
  iconPath?: string;
}

/**
 * Узел меню, наиболее точно совпадающий с текущим путём (самое глубокое совпадение
 * по префиксу). Нужен шапке HubNav: заголовок/описание/иконка активного подраздела.
 */
export function findSectionNode(rootPath: string, currentPath: string): MenuItem | null {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const root = findNodeByPath(eftMenu, rootPath);
  if (!root) return null;

  const matches: MenuItem[] = [];
  const walk = (items: MenuItem[]): void => {
    for (const item of items) {
      if (item.path && (currentPath === item.path || currentPath.startsWith(`${item.path}/`))) {
        matches.push(item);
      }
      if (item.children) walk(item.children);
    }
  };
  walk(root.children ?? []);
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => ((b.path?.length ?? 0) > (a.path?.length ?? 0) ? b : a));
}

/**
 * Карточки индекса раздела — прямые дети rootPath из HEADER_DICTIONARY.
 * Держит хаб и верхнюю навигацию на одном источнике: добавил роут в словарь —
 * появилась и карточка, и пункт в HubNav.
 */
export function getSectionHubCards(rootPath: string): SectionHubCard[] {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const root = findNodeByPath(eftMenu, rootPath);
  return (root?.children ?? [])
    .filter((c): c is MenuItem & { path: string } => Boolean(c.path))
    .map((c) => ({
      id: c.id,
      title: c.label,
      description: c.description ?? '',
      href: c.path,
      iconPath: c.iconUrl,
    }));
}
