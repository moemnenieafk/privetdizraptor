'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { HEADER_DICTIONARY, type MenuItem } from '@/data/headerConfig';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';

// Only segments that genuinely can't be found in menuItems tree
const ROOT_OVERRIDES: Record<string, string | null> = {
  eft: 'EFT',
  item: null, // routing artifact — no breadcrumb
  task: null, // routing artifact (/eft/quests/task/[id]) — no breadcrumb
};

// BSG-идентификатор (24 hex) — сырой параметр динамического роута, в крошках не показываем.
const BSG_ID_RE = /^[a-f0-9]{24}$/i;

function findNodeByPath(items: MenuItem[], targetPath: string): MenuItem | null {
  for (const node of items) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

// Приоритет резолва: ROOT_OVERRIDES → узел дерева навигации (точный path) →
// словарь breadcrumbNames (сегмент → русский лейбл; карты/категории/слаги) → сырой сегмент.
function resolveLabel(
  segment: string,
  fullPath: string,
  menuItems: MenuItem[],
  names: Record<string, string>,
): string | null {
  if (segment in ROOT_OVERRIDES) return ROOT_OVERRIDES[segment];
  if (BSG_ID_RE.test(segment)) return null; // сырой id — скрываем (деталь назовёт себя сама)
  return findNodeByPath(menuItems, fullPath)?.label ?? names[segment] ?? segment;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const dynamicCrumbs = useBreadcrumbStore((s) => s.dynamicCrumbs);

  const segments = (pathname ?? '').split('/').filter(Boolean);
  const cfg = HEADER_DICTIONARY['eft'];
  const menuItems = cfg?.menuItems ?? [];
  const names = cfg?.breadcrumbNames ?? {};

  if (segments.length <= 1) return null;

  // Detect flat dynamic item route: /eft/items/item/[slug]
  const isDynamicItemPage =
    segments[segments.length - 2] === 'item' &&
    segments[segments.length - 3] === 'items';

  const staticSegments = isDynamicItemPage
    ? segments.slice(0, segments.length - 2) // drop 'item' + slug
    : segments;

  const staticCrumbs = staticSegments
    .map((segment, index) => {
      const path = `/${staticSegments.slice(0, index + 1).join('/')}`;
      const label = resolveLabel(segment, path, menuItems, names);
      return label !== null ? { label, href: path } : null;
    })
    .filter((c): c is { label: string; href: string } => c !== null);

  // dynamicCrumbs (useBreadcrumbStore) — имя сущности с детальной страницы
  // (предмет / достижение / …): приклеиваем к статическому префиксу.
  const allCrumbs = isDynamicItemPage
    ? [...staticCrumbs, ...dynamicCrumbs]
    : dynamicCrumbs.length > 0 && BSG_ID_RE.test(segments[segments.length - 1] ?? '')
      ? [...staticCrumbs, ...dynamicCrumbs]
      : staticCrumbs;

  if (allCrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex w-full items-center">
      <ol className="flex flex-wrap items-center gap-2 text-[0.625rem] font-blender-medium uppercase tracking-wider">
        {allCrumbs.map((crumb, index) => {
          const isLast = index === allCrumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <li>
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? 'page' : undefined}
                    className={isLast ? 'text-(--primary) pointer-events-none' : 'text-text-secondary'}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {!isLast && <li aria-hidden="true" className="text-text-muted">/</li>}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
