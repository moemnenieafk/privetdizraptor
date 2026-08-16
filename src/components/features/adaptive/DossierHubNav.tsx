'use client';

import { usePathname } from 'next/navigation';
import { getSectionHubNav } from '@/lib/section-hub-nav';
import { SectionNavTab } from '@/components/features/navigation/SectionNavTab';

// Шапка Досье = канон HubNav (docs/decisions/hubnav-architecture.md): контентная область
// делится на ДВЕ равные половины (lg:w-[32.625rem] ≈ 522px, gap-7). Слева — иконка(21²)+H1+описание,
// справа — «НАВИГАЦИЯ ПО РАЗДЕЛУ»+линия, ряд иконок-табов разделов и (если есть) подразделы вторым
// рядом. Вёрстка 1:1 с базовым SectionHubNav variant='full'; здесь тонкая обёртка, т.к. Досье уже
// живёт внутри контейнера max-w-275 px-4 (eft/hub/page.tsx), поэтому свой mx-auto/max-w/px не нужен.
// Ряд табов само-вычисляется из HEADER_DICTIONARY (getSectionHubNav) — синхронен с меню.

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface DossierHubNavProps {
  title: string;
  description?: string;
  /** Путь монохром-иконки левого блока. */
  iconUrl: string;
  /** Корень раздела, чьи дети = ряд табов. По умолчанию — Прогресс. */
  rootPath?: string;
}

export function DossierHubNav({ title, description, iconUrl, rootPath = '/eft/progress' }: DossierHubNavProps) {
  const pathname = usePathname();
  const { sections, sub } = getSectionHubNav(rootPath, pathname);
  if (sections.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-6 mb-8 lg:mb-12 lg:flex-row lg:items-center lg:gap-7">
      {/* Левая половина: иконка + заголовок + описание */}
      <div className="flex items-center gap-4 lg:w-[32.625rem] lg:shrink-0 lg:gap-7">
        <div className="w-21 h-21 shrink-0 flex items-center justify-center rounded-md bg-(--color-darkbase)">
          <div
            aria-hidden="true"
            className="w-10.5 h-10.5 bg-(--primary)"
            style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
          />
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

      {/* Правая половина: навигация по разделу (ряд разделов + подразделы вторым рядом) */}
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
