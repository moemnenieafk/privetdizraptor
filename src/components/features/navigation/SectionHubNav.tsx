'use client';
import { usePathname } from 'next/navigation';
import { getSectionHubNav } from '@/lib/section-hub-nav';
import { SectionNavTab } from './SectionNavTab';

interface SectionHubNavProps {
  /** Корень раздела в меню, дети которого = ряд разделов. Напр. '/eft/gamesetting'. */
  rootPath: string;
  /** Метка ряда разделов верхнего уровня. */
  sectionsLabel?: string;
}

/**
 * Тонкая полоса-переключатель раздела (аналог QuestsNavBar «Заданий»), но
 * само-вычисляемая из HEADER_DICTIONARY по rootPath + usePathname.
 * Ряды: «Разделы» (всегда) + подраздел/соседи текущего узла (если есть).
 * На самом хабе (pathname === rootPath) не рендерится — там карточки.
 */
export function SectionHubNav({ rootPath, sectionsLabel = 'Разделы' }: SectionHubNavProps) {
  const pathname = usePathname();
  if (pathname === rootPath) return null;

  const { sections, sub } = getSectionHubNav(rootPath, pathname);
  if (sections.length === 0) return null;

  const rows = [{ label: sectionsLabel, tabs: sections }];
  if (sub && sub.tabs.length > 0) rows.push(sub);

  return (
    <nav className="w-full max-w-275 mx-auto flex flex-col gap-3 px-4 pt-7 xl:px-0">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted sm:w-28">
            {row.label}
          </span>
          <div className="flex flex-wrap gap-2">
            {row.tabs.map((tab) => (
              <SectionNavTab key={tab.id} tab={tab} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
