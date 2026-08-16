'use client';

import { usePathname } from 'next/navigation';
import { getSectionHubNav } from '@/lib/section-hub-nav';
import { SectionNavTab } from '@/components/features/navigation/SectionNavTab';

// Шапка досье (HubNav по макету V4DYA): слева иконка+заголовок+описание, справа лейбл
// «НАВИГАЦИЯ ПО РАЗДЕЛУ» + ряд иконок-табов разделов Прогресса. Ряд табов само-вычисляется
// из HEADER_DICTIONARY (дети '/eft/progress' — Досье/Аркады/Убежище/Бартер/Сезоны/Сборки/
// Трекер/Важное), поэтому синхронен с меню: добавили роут — появился таб. Активный таб —
// текущий путь (/eft/hub). Визуал табов 1:1 с секционной навигацией разделов (SectionNavTab).

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
  const { sections } = getSectionHubNav(rootPath, pathname);

  return (
    <div className="@container/dossiernav w-full">
      <div className="flex flex-col gap-6 @4xl/dossiernav:flex-row @4xl/dossiernav:items-center @4xl/dossiernav:justify-between @4xl/dossiernav:gap-12">
        {/* Левый блок: иконка + заголовок + описание */}
        <div className="flex items-center gap-4 @4xl/dossiernav:gap-7">
          <div className="flex size-21 shrink-0 items-center justify-center rounded-md bg-(--color-darkbase)">
            <div
              aria-hidden="true"
              className="size-10.5 bg-(--primary)"
              style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
            />
          </div>
          <div>
            <h1 className="text-[1.75rem] font-blender-medium uppercase leading-none tracking-tighter text-text-primary">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-sm text-sm font-blender-book text-text-secondary">{description}</p>
            )}
          </div>
        </div>

        {/* Правый блок: лейбл + ряд иконок-табов разделов */}
        {sections.length > 0 && (
          <div className="flex w-full flex-col gap-4 @4xl/dossiernav:w-auto">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
                Навигация по разделу
              </span>
              <div className="h-px flex-1 bg-lines-hover @4xl/dossiernav:hidden" />
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.map((tab) => (
                <SectionNavTab key={tab.id} tab={tab} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
