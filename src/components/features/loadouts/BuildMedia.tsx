'use client';

// Медиа сборки: hero-рендер (пресет → дефолт-пресет → голая база) + планка иконок
// установленных модулей. Все картинки — с нашей R2 через lib/build-media.
// Mobile-first: тач-таргеты 44px, планка скроллится горизонтально.
import Link from 'next/link';
import { buildHero, buildPartIcons, type PresetRef } from '@/lib/build-media';
import type { BuildResult } from '@/lib/weapon-build';

interface BuildMediaProps {
  baseItemId: string;
  baseName: string;
  result: BuildResult;
  presets: PresetRef[];
  /** Имя предмета по id — для alt и тултипов планки. */
  nameOf: (itemId: string) => string;
  /** Компактный режим для карточек в списках (/my, /find). */
  compact?: boolean;
  className?: string;
}

export function BuildMedia({
  baseItemId,
  baseName,
  result,
  presets,
  nameOf,
  compact = false,
  className,
}: BuildMediaProps) {
  const hero = buildHero(baseItemId, result, presets);
  const icons = buildPartIcons(result);

  return (
    <div className={`flex w-full flex-col gap-3 ${className ?? ''}`}>
      {/* Hero: «бак» в духе FillMedia, но горизонтальный — ствол широкий */}
      <div
        className={`relative w-full overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase) ${
          compact ? 'h-28' : 'h-44 md:h-56'
        }`}
      >
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_25px_rgba(0,0,0,0.85)]" />

        <img
          src={hero.src}
          alt={baseName}
          loading="lazy"
          className="absolute inset-0 z-10 h-full w-full object-contain p-3"
        />

        {hero.kind === 'preset' && (
          <span className="absolute left-2 top-2 z-20 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
            Пресет
          </span>
        )}

        {!compact && (
          <span className="absolute bottom-2 right-2 z-20 font-blender-medium text-xs text-text-secondary">
            {icons.length} {modWord(icons.length)}
          </span>
        )}
      </div>

      {/* Планка модулей */}
      {icons.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {icons.map((ic) => (
            <Link
              key={`${ic.slotNameId}-${ic.itemId}`}
              href={`/eft/items/item/${ic.itemId}`}
              title={nameOf(ic.itemId)}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase) transition-colors hover:border-(--primary)"
            >
              <img
                src={ic.src}
                alt={nameOf(ic.itemId)}
                loading="lazy"
                className="h-full w-full object-contain p-0.5"
              />
              {/* Точка = модуль стоит во вложенном слоте (планка → крышка → прицел) */}
              {ic.depth > 0 && (
                <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-(--primary)/70" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Скелетон вместо спиннера, пока грузится справочник предметов. */
export function BuildMediaSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className={`w-full animate-pulse rounded-sm bg-card-menu ${
          compact ? 'h-28' : 'h-44 md:h-56'
        }`}
        aria-hidden="true"
      />
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-11 w-11 shrink-0 animate-pulse rounded-sm bg-card-menu"
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

function modWord(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (dd >= 11 && dd <= 14) return 'модулей';
  if (d === 1) return 'модуль';
  if (d >= 2 && d <= 4) return 'модуля';
  return 'модулей';
}