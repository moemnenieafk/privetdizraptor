'use client';
import type { ReactNode } from 'react';
import type { QuestsHubNavTab } from '@/lib/quests-nav';
import { QuestNavTab } from './QuestNavTab';

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface QuestsHubNavProps {
  tabs: QuestsHubNavTab[];
  subTabs?: QuestsHubNavTab[];
  subLabel?: string;
  /** Кастомный левый блок (напр. трейдер + фильтры). Если задан — заменяет дефолтный заголовок. */
  leftSlot?: ReactNode;
  iconClass?: string;
  iconUrl?: string;
  title?: string;
  description?: string;
  count?: number;
  activeHref?: string;
}

/**
 * Навигация-шапка раздела «Задания»: заголовок слева + до двух рядов справа
 * (разделы верхнего уровня + опц. дети текущего — торговцы/истории).
 * Презентационный аналог features/items/HubNav БЕЗ store и фильтра торговцев.
 * Растровые иконки (.webp фото торговцев) рендерятся <img>, векторные (.svg) — маской.
 */
export function QuestsHubNav({
  tabs,
  subTabs,
  leftSlot,
  iconClass,
  iconUrl,
  title,
  description,
  count,
  activeHref,
}: QuestsHubNavProps) {
  return (
    <div className="w-full max-w-275 mx-auto flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-7 mb-8 lg:mb-12">

      {/* Left Block: кастомный слот (трейдер+фильтры) или дефолтный заголовок */}
      {leftSlot ?? (
      <div className="flex items-center gap-4 lg:gap-7 lg:w-[32.625rem] lg:shrink-0">
        <div className="w-21 h-21 shrink-0 bg-(--color-darkbase) rounded-md flex items-center justify-center">
          <div className="text-(--primary) [&>svg]:fill-current [&>path]:fill-current">
            {iconUrl ? (
              <div
                aria-hidden="true"
                className="w-10.5 h-10.5 bg-(--primary)"
                style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
              />
            ) : (
              <div
                aria-hidden="true"
                className={`w-10.5 h-10.5 bg-(--primary) icon-mask ${iconClass ?? 'icon-eft-quests'}`}
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[1.75rem] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
              {title}
            </h1>
            {count != null && count > 0 && (
              <span className="px-2 py-0.5 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] border border-(--primary)/40 rounded font-blender-medium text-sm text-(--primary) leading-snug">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-2 text-sm text-text-secondary max-w-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      )}

      {/* Right Block: фикс ширина = навигация при 6 иконках в ряд (эталон — торговцы, 404px), чтобы не прыгала */}
      <div className="flex w-full flex-col gap-4 lg:w-[32.625rem] lg:shrink-0">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Навигация по разделу
          </span>
          <div className="flex-1 h-px bg-lines-hover" />
        </div>
        <div className="flex flex-wrap lg:flex-nowrap gap-3.5 lg:gap-7">
          <div className="grid w-max grid-cols-6 gap-2">
            {tabs.map((tab) => (
              <QuestNavTab key={tab.id} tab={tab} activeHref={activeHref} />
            ))}
          </div>
          {subTabs && subTabs.length > 0 && (
            <div className="grid grid-cols-6 gap-3.5 w-max lg:w-64 lg:gap-7">
              {subTabs.map((tab) => (
                <QuestNavTab key={tab.id} tab={tab} activeHref={activeHref} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
