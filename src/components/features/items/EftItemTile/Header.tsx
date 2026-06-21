"use client";

import { ItemGridSize } from '@/components/ui/ItemGridSize';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useEftItemTile } from './context';
import type { EftTopStat } from './types';

function renderTopStat(topStat: EftTopStat): string | null {
  switch (topStat.kind) {
    case 'capacity':   return `${topStat.value}`;
    case 'durability': return `${topStat.current}/${topStat.max}`;
    case 'hearing':    return `${topStat.value} м`;
    case 'weight':     return `${topStat.value} кг`;
    case 'uses':       return `${topStat.value} исп.`;
    case 'custom':     return topStat.label ? `${topStat.label}: ${topStat.value}` : String(topStat.value);
    case 'hidden':     return null;
  }
}

export function EftHeader() {
  const { item } = useEftItemTile();
  const isFavorite = useFavoritesStore((s) => s.isFavorite(item.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const statDisplay = item.topStat ? renderTopStat(item.topStat) : null;

  return (
    <div className="mb-3 flex items-center gap-1">
      {/* Fav button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.id); }}
        className={`shrink-0 text-sm leading-none transition-colors ${
          isFavorite ? 'text-amber-400' : 'text-(--text-muted) hover:text-(--primary)'
        }`}
        aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      >
        {isFavorite ? '★' : '☆'}
      </button>

      {/* Short name */}
      <span className="min-w-0 shrink font-blender-medium text-xs uppercase tracking-wider text-text-primary truncate">
        {item.shortName}
      </span>

      {/* Dynamic stat — centered between name and grid */}
      {statDisplay ? (
        <span className="flex-1 text-center font-blender-medium text-type-caption whitespace-nowrap" style={{ color: '#9A8866' }}>
          {statDisplay}
        </span>
      ) : (
        <span className="flex-1" />
      )}

      {/* Quest badge */}
      {(item.questCount ?? 0) > 0 && (
        <span className="shrink-0 rounded-xs bg-amber-400/15 px-1 font-blender-medium text-type-caption uppercase tracking-wider text-amber-400">
          Квест ×{item.questCount}
        </span>
      )}

      {/* Grid size */}
      <div className="shrink-0">
        <ItemGridSize width={item.width} height={item.height} showLabel labelFirst />
      </div>
    </div>
  );
}
