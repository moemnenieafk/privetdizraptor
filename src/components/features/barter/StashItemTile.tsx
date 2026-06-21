'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useBarterStore } from '@/store/useBarterStore';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { StashItem } from '@/types/barter';

interface Props {
  item: StashItem;
  onHover?: (x: number, y: number) => void;
  onHoverMove?: (x: number, y: number) => void;
  onLeave?: () => void;
}

export function StashItemTile({ item, onHover, onHoverMove, onLeave }: Props) {
  const removeItem = useBarterStore((s) => s.removeItem);

  return (
    <div
      className="group relative w-full h-full border border-lines-hover hover:border-(--primary) transition-colors duration-150 cursor-default overflow-hidden"
      style={{ background: getTarkovBackgroundColor(item.backgroundColor) }}
      onMouseEnter={(e) => onHover?.(e.clientX, e.clientY)}
      onMouseMove={(e) => onHoverMove?.(e.clientX, e.clientY)}
      onMouseLeave={() => onLeave?.()}
    >
      {item.image512pxLink && (
        <Image
          src={item.image512pxLink}
          alt={item.shortName}
          fill
          className="object-contain p-0.75"
          sizes={`${item.width * 54}px`}
          unoptimized
        />
      )}

      <span className="absolute bottom-0 left-0 px-0.75 py-px bg-black/50 font-blender-medium text-type-caption uppercase text-text-muted leading-tight select-none">
        {item.width}×{item.height}
      </span>

      <button
        className="absolute top-0 right-0 w-4 h-4 bg-black/70 text-failure flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
        onClick={() => removeItem(item.uid)}
        title={`Убрать ${item.shortName}`}
        type="button"
      >
        <X size={9} strokeWidth={2.5} />
      </button>
    </div>
  );
}
