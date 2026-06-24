'use client';

import Link from 'next/link';
import { mapIconClass, mapOrderIndex } from '@/data/map-icons';

interface NavMap {
  slug: string;
  name: string;
}

interface Props {
  maps: NavMap[];
  activeSlug?: string;
  className?: string;
}

/** Иконки-табы локаций для быстрого переключения между картами (как навигация раздела). */
export function MapNavStrip({ maps, activeSlug, className }: Props) {
  const sorted = [...maps].sort((a, b) => mapOrderIndex(a.slug) - mapOrderIndex(b.slug));

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {sorted.map((m) => {
        const icon = mapIconClass(m.slug);
        const active = m.slug === activeSlug;
        return (
          <Link
            key={m.slug}
            href={`/eft/maps/${m.slug}`}
            title={m.name}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-all hover:text-(--primary) ${
              active ? 'text-(--primary)' : 'text-text-secondary'
            }`}
            style={{ opacity: activeSlug && !active ? 0.55 : 1 }}
          >
            {icon ? (
              <span className={`icon-mask ${icon} h-7 w-7`} />
            ) : (
              <span className="font-blender-medium text-type-caption uppercase leading-none">{m.name.slice(0, 3)}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
