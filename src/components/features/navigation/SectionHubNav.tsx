'use client';
import { usePathname } from 'next/navigation';
import { getSectionHubNav, type SectionHubNavTab } from '@/lib/section-hub-nav';
import { useEntitlements } from '@/components/features/subscription/GatingProvider';
import { visibleForGate } from '@/lib/gating/nav-visibility';
import { SectionNavTab } from './SectionNavTab';

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface SectionHubNavProps {
  /** Корень раздела в меню, дети которого = ряд разделов. Напр. '/eft/gamesetting'. */
  rootPath: string;
  /** 'full' — шапка с иконкой+заголовком+навигацией (аналог QuestsHubNav, для индексных страниц);
   *  'bar' — тонкая полоса-переключатель (аналог QuestsNavBar, для страниц со своим заголовком). */
  variant?: 'full' | 'bar';
  /** full: заголовок/описание/иконка левого блока (иначе берётся из узла меню на стороне вызова). */
  title?: string;
  description?: string;
  iconUrl?: string;
  iconClass?: string;
  /** bar: рендерить только на глубоких путях (глубина от rootPath ≥ 2) — деталь-страницы. */
  deepOnly?: boolean;
  /** Класс ширины контейнера (по умолчанию max-w-275; для статьи — max-w-3xl). */
  widthClass?: string;
  sectionsLabel?: string;
  /** Доп. классы контейнера variant='full'. Для прямого использования (не через layout) —
   *  сюда `mb-7` (28px hubnav→контент, канон DESIGN_SYSTEM.md §2.1), т.к. mb у контейнера нет. */
  className?: string;
}

/**
 * Секционная навигация «Кодекса» (и любого раздела), само-вычисляемая из HEADER_DICTIONARY
 * по rootPath + usePathname. На самом хабе (pathname === rootPath) не рендерится — там карточки.
 */
export function SectionHubNav({
  rootPath,
  variant = 'bar',
  title,
  description,
  iconUrl,
  iconClass,
  deepOnly = false,
  widthClass = 'max-w-275',
  sectionsLabel = 'Разделы',
  className,
}: SectionHubNavProps) {
  const pathname = usePathname();
  const snapshot = useEntitlements();
  if (pathname === rootPath) return null;

  const raw = getSectionHubNav(rootPath, pathname);
  // Гейт-фильтр: 'hide'+нет доступа → пункт выпадает; 'lock' → остаётся, но с бейджем-замком
  // (SectionNavTab сам его рисует по tab.locked); 'show' → как обычно. Всё free → без изменений.
  const gateTabs = (tabs: SectionHubNavTab[]): SectionHubNavTab[] =>
    tabs
      .map((tab) => ({ tab, verdict: visibleForGate({ path: tab.href, gateKey: tab.gateKey }, snapshot) }))
      .filter(({ verdict }) => verdict !== 'hide')
      .map(({ tab, verdict }) => (verdict === 'lock' ? { ...tab, locked: true } : tab));

  const sections = gateTabs(raw.sections);
  const sub = raw.sub ? { ...raw.sub, tabs: gateTabs(raw.sub.tabs) } : null;
  if (sections.length === 0) return null;

  if (variant === 'full') {
    return (
      // Отступ hubnav→контент НЕ здесь: через layout (SectionLayoutNav/ComlinkHubNav) им владеет
      // верхний pt-7 (28px) страничного <main>. При ПРЯМОМ использовании внутри <main> зазор
      // задаётся пропом className="mb-7". Канон — DESIGN_SYSTEM.md §2.1.
      <div className={`w-full ${widthClass} mx-auto flex flex-col gap-6 px-4 lg:flex-row lg:items-center lg:gap-7 xl:px-0${className ? ` ${className}` : ''}`}>
        {/* Левый блок: иконка + заголовок + описание */}
        <div className="flex items-center gap-4 lg:w-[32.625rem] lg:shrink-0 lg:gap-7">
          <div className="w-21 h-21 shrink-0 flex items-center justify-center rounded-md bg-(--color-darkbase)">
            {iconUrl ? (
              <div
                aria-hidden="true"
                className="w-10.5 h-10.5 bg-(--primary)"
                style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
              />
            ) : (
              <div aria-hidden="true" className={`w-10.5 h-10.5 bg-(--primary) icon-mask ${iconClass ?? 'icon-eft-lore-tarkov'}`} />
            )}
          </div>
          <div>
            <h1 className="text-[1.75rem] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-sm text-sm text-text-secondary font-blender-book">{description}</p>
            )}
          </div>
        </div>

        {/* Правый блок: навигация по разделу (ряд разделов + подраздел/соседи) */}
        <div className="flex w-full flex-col gap-4 lg:w-[32.625rem] lg:shrink-0">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Навигация по разделу
            </span>
            <div className="flex-1 h-px bg-lines-hover" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {sections.map((tab) => (
                <SectionNavTab key={tab.id} tab={tab} />
              ))}
            </div>
            {sub && sub.tabs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sub.tabs.map((tab) => (
                  <SectionNavTab key={tab.id} tab={tab} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // variant === 'bar'
  if (deepOnly) {
    const rel = pathname.slice(rootPath.length).split('/').filter(Boolean);
    if (rel.length < 2) return null;
  }

  const rows = [{ label: sectionsLabel, tabs: sections }];
  if (sub && sub.tabs.length > 0) rows.push(sub);

  return (
    <nav className={`w-full ${widthClass} mx-auto flex flex-col gap-3 px-4 pt-7 xl:px-0`}>
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
