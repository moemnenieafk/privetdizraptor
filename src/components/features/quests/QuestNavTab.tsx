'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { QuestsHubNavTab } from '@/lib/quests-nav';

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface QuestNavTabProps {
  tab: QuestsHubNavTab;
  /** Переопределяет автоопределение active по URL (нужно на task/[id], где путь ≠ href таба). */
  activeHref?: string;
}

/**
 * Одна кнопка-переключатель навигации «Заданий».
 * Иконка: `.webp` (фото торговцев) → <img>, `.svg` → CSS-маска в цвет primary.
 * Общая для QuestsHubNav (шапка) и QuestsNavBar (тонкая полоса).
 */
export function QuestNavTab({ tab, activeHref }: QuestNavTabProps) {
  const pathname = usePathname();
  const base = activeHref ?? pathname;
  const isActive =
    base === tab.href || base.startsWith(`${tab.href}/`);
  const isRaster = /\.(webp|png|jpe?g)$/i.test(tab.iconUrl ?? '');

  return (
    <Link
      href={tab.href}
      title={tab.menuTitle ?? tab.label}
      className={`w-9 h-9 rounded flex items-center justify-center overflow-hidden transition-[background-color,border-color] duration-200 ${
        isActive
          ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
          : 'bg-card-menu border border-lines-hover hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
      }`}
    >
      {isRaster ? (
        // eslint-disable-next-line @next/next/no-img-element -- локальные webp-аватары торговцев, паттерн из items/HubNav
        <img
          src={tab.iconUrl ?? ''}
          alt=""
          className={`w-full h-full object-cover transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-60'}`}
        />
      ) : (
        <div
          aria-hidden="true"
          className={`w-5.5 h-5.5 transition-[background-color,opacity] duration-200 ${isActive ? 'bg-(--primary) opacity-100' : 'bg-text-primary opacity-60'}`}
          style={{ WebkitMaskImage: `url(${tab.iconUrl ?? ''})`, maskImage: `url(${tab.iconUrl ?? ''})`, ...MASK_BASE }}
        />
      )}
    </Link>
  );
}
