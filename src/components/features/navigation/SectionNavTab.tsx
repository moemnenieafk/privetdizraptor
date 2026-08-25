'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { SectionHubNavTab } from '@/lib/section-hub-nav';

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface SectionNavTabProps {
  tab: SectionHubNavTab;
  /** Переопределяет автоопределение active по URL (для глубоких путей ≠ href таба). */
  activeHref?: string;
}

/**
 * Одна кнопка-переключатель секционной навигации.
 * Иконка: `.webp` (растровые фото) → <img>, `.svg` → CSS-маска в цвет primary.
 * Визуально 1:1 с QuestNavTab «Заданий».
 */
export function SectionNavTab({ tab, activeHref }: SectionNavTabProps) {
  const pathname = usePathname();
  const base = activeHref ?? pathname;
  const isActive = base === tab.href || base.startsWith(`${tab.href}/`);
  const isRaster = /\.(webp|png|jpe?g)$/i.test(tab.iconUrl ?? '');

  return (
    <div className="relative">
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
        // eslint-disable-next-line @next/next/no-img-element -- локальные webp-аватары, паттерн из QuestNavTab
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
      {tab.locked && (
        // Раздел за пэйволом: малый бейдж-замок в углу, но пункт остаётся кликабельным
        // (страница сама покажет апселл). NIGHTFALL-токены, без литерального hex.
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card-menu border border-lines-hover"
        >
          <Lock className="h-2 w-2 text-(--primary)" />
        </span>
      )}
    </div>
  );
}
