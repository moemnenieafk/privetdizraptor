"use client";

import { Minus, Plus, Star, Scale } from 'lucide-react';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useItemsStore } from '@/store/useItemsStore';
import { useInventoryStore } from '@/store/useInventoryStore';

interface ItemActionsProps {
  itemId: string;
}

export function ItemActions({ itemId }: ItemActionsProps) {
  const isFavorite = useFavoritesStore((s) => s.isFavorite(itemId));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const compareIds = useItemsStore((s) => s.compareIds);
  const toggleCompare = useItemsStore((s) => s.toggleCompare);
  const isComparing = compareIds.includes(itemId);

  const count = useInventoryStore((s) => s.getCount(itemId));
  const increment = useInventoryStore((s) => s.increment);
  const decrement = useInventoryStore((s) => s.decrement);

  return (
    <div className="flex flex-col gap-2">
      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => toggleFavorite(itemId)}
          className={`flex h-9 items-center justify-center gap-1.5 rounded border font-blender-medium text-type-caption uppercase tracking-wider transition-all duration-200 ${
            isFavorite
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
              : 'border-lines-hover bg-(--color-card-menu) text-(--text-muted) hover:border-(--primary)/40 hover:text-(--primary)'
          }`}
        >
          <Star className={`h-3.5 w-3.5 shrink-0 ${isFavorite ? 'fill-current' : ''}`} />
          <span>{isFavorite ? 'Избранное' : 'В избранное'}</span>
        </button>

        <button
          onClick={() => toggleCompare(itemId)}
          className={`flex h-9 items-center justify-center gap-1.5 rounded border font-blender-medium text-type-caption uppercase tracking-wider transition-all duration-200 ${
            isComparing
              ? 'border-(--primary)/40 bg-(--primary)/10 text-(--primary)'
              : 'border-lines-hover bg-(--color-card-menu) text-(--text-muted) hover:border-(--primary)/40 hover:text-(--primary)'
          }`}
        >
          <Scale className="h-3.5 w-3.5 shrink-0" />
          <span>{isComparing ? 'В сравнении' : 'Сравнить'}</span>
        </button>
      </div>

      {/* Inventory tracker */}
      <div className="flex h-9 items-center rounded border border-lines-hover bg-(--color-card-menu) overflow-hidden">
        <button
          onClick={() => decrement(itemId)}
          disabled={count === 0}
          className="flex h-full w-9 shrink-0 items-center justify-center text-(--text-muted) transition-colors hover:bg-(--primary)/10 hover:text-(--primary) disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Уменьшить"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-1 items-center justify-center gap-2 px-2">
          <span className={`font-blender-medium text-sm tabular-nums ${count === 0 ? 'text-(--text-muted)' : 'text-text-primary'}`}>
            {count}
          </span>
          <span className="font-blender-book text-type-caption uppercase tracking-wider text-(--text-muted)">
            в стэше
          </span>
        </div>

        <button
          onClick={() => increment(itemId)}
          className="flex h-full w-9 shrink-0 items-center justify-center text-(--text-muted) transition-colors hover:bg-(--primary)/10 hover:text-(--primary)"
          aria-label="Увеличить"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
