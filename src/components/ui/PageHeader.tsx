import type { ReactNode } from 'react';
import { PAGE_CONTENT_DICTIONARY } from '@/data/pageContent';

interface PageHeaderProps {
  pageId?: string;
  title?: string;
  description?: string;
  iconClass?: string;
  count?: number;
  /** Опциональный слот справа (кнопки/CTA) — выравнивается по центру строки шапки. */
  action?: ReactNode;
  /** Плотный режим: меньший нижний отступ (первый экран — напр. главная). */
  dense?: boolean;
}

export function PageHeader({ pageId, title, description, iconClass, count, action, dense }: PageHeaderProps) {
  const content = pageId ? PAGE_CONTENT_DICTIONARY[pageId] : null;

  // Приоритет: Данные из словаря -> Явно переданные пропсы -> Дефолтные значения
  const finalTitle = content?.title || title || 'Раздел';
  const finalDesc = content?.description || description || '';
  const finalIcon = content?.iconClass || iconClass || 'icon-eft-items-loot-tier';

  return (
    <div className={`flex items-center gap-5 ${dense ? 'mb-6' : 'mb-12'}`}>
      {/* Добавлен text-(--color-base) для инверсии цвета иконки */}
      <div className="shrink-0 flex items-center justify-center w-13.25 h-13.25 rounded bg-(--primary) text-(--color-base)">
        <div className={`w-7 h-7 icon-mask ${finalIcon}`}></div>
      </div>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-[1.75rem] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">{finalTitle}</h1>
          {count != null && count > 0 && (
            <span className="px-2 py-0.5 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] border border-(--primary)/40 rounded font-blender-medium text-sm text-(--primary) leading-snug">
              {count}
            </span>
          )}
        </div>
        {finalDesc && <p className="mt-2 text-sm text-text-secondary max-w-2xl">{finalDesc}</p>}
      </div>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
