"use client";

import Link from 'next/link';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { CategoryItem } from '@/app/eft/items/[...category]/ItemsCategoryClient';
import { itemIconUrl } from '@/lib/item-icon';

interface FavoritesStripProps {
  favoriteIds: string[];
  items: CategoryItem[];
}

export function FavoritesStrip({ favoriteIds, items }: FavoritesStripProps) {
  const favItems = items.filter((item) => favoriteIds.includes(item.id));
  if (favItems.length === 0) return null;

  return (
    <div className="w-full">
      <p className="mb-2 font-blender-medium text-type-caption uppercase tracking-widest text-(--text-muted)">
        ★ Избранное
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {favItems.map((item) => (
          <Link
            key={item.id}
            href={`/eft/items/item/${item.normalizedName}`}
            className="group relative flex shrink-0 flex-col items-center gap-1 rounded border border-lines-hover bg-(--color-card-menu) p-1.5 transition-colors hover:border-(--primary)/50 hover:bg-(--primary)/5"
          >
            <div
              className="relative h-12 w-12 overflow-hidden rounded-xs"
              style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
            >
              <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.7)]" />
              <img
                src={itemIconUrl(item.id)}
                alt={item.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain p-1 transition-transform duration-200 group-hover:scale-110"
                onError={(e) => {
                  const t = e.currentTarget;
                  if (!t.dataset.tried) {
                    t.dataset.tried = 'true';
                    t.src = item.image512pxLink || '/images/placeholder.webp';
                  }
                }}
              />
            </div>
            <span className="max-w-12 truncate font-blender-medium text-type-caption uppercase tracking-wide text-(--text-muted) group-hover:text-text-primary">
              {item.shortName}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
