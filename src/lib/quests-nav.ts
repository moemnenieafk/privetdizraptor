import { HEADER_DICTIONARY, MenuItem } from '@/data/headerConfig';

export interface QuestsHubNavTab {
  id: string;
  label: string;
  menuTitle?: string;
  href: string;
  iconUrl?: string;
}

function findNodeByPath(items: MenuItem[], targetPath: string): MenuItem | null {
  for (const item of items) {
    if (item.path === targetPath) return item;
    if (item.children) {
      const found = findNodeByPath(item.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function toTabs(items: MenuItem[] | undefined): QuestsHubNavTab[] {
  return (items ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    menuTitle: c.menuTitle,
    href: c.path || '#',
    iconUrl: c.iconUrl || '',
  }));
}

/**
 * Навигация раздела «Задания» из словаря меню (единый источник — HEADER_DICTIONARY):
 *  - sections: разделы верхнего уровня (Сюжетные / Побочные / События)
 *  - children: дети текущего узла (торговцы на «Побочных», истории на «Сюжетных»); [] если их нет
 */
export function getQuestsNav(currentPath: string): { sections: QuestsHubNavTab[]; children: QuestsHubNavTab[] } {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  return {
    sections: toTabs(findNodeByPath(eftMenu, '/eft/quests')?.children),
    children: toTabs(findNodeByPath(eftMenu, currentPath)?.children),
  };
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
 * Для глубоких уровней (страница торговца/истории/квеста): разделы + СОСЕДИ.
 * Соседи = дети родителя текущего узла (другие торговцы / другие истории).
 * `parentLabel` — заголовок раздела-родителя (для метки ряда соседей).
 */
export function getQuestsSiblings(currentPath: string): {
  sections: QuestsHubNavTab[];
  siblings: QuestsHubNavTab[];
  parentLabel: string;
} {
  const eftMenu = HEADER_DICTIONARY['eft'].menuItems;
  const found = findWithParent(eftMenu, currentPath, null);
  return {
    sections: toTabs(findNodeByPath(eftMenu, '/eft/quests')?.children),
    siblings: toTabs(found?.parent?.children),
    parentLabel: found?.parent?.label ?? 'Разделы',
  };
}
