"use client";

import { ItemGridSize } from '@/components/ui/ItemGridSize';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { useEftItemTile } from './context';

interface EftHeaderProps {
  stat?: string;
  showColorDot?: boolean;
}

export function EftHeader({ stat, showColorDot = true }: EftHeaderProps) {
  const { item } = useEftItemTile();

  return (
    <div className="mb-3 flex items-center gap-1.5">
      <span className="font-blender-medium text-xs uppercase tracking-wider text-text-primary truncate shrink min-w-0">
        {item.shortName}
      </span>
      {stat && (
        <span className="font-blender-medium text-[10px] text-text-muted whitespace-nowrap shrink-0">
          {stat}
        </span>
      )}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        <ItemGridSize width={item.width} height={item.height} showLabel />
        {showColorDot && item.backgroundColor && (
          <span
            className="w-2 h-2 rounded-full shrink-0 border border-white/20"
            style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor).replace('0.3)', '0.9)') }}
          />
        )}
      </div>
    </div>
  );
}
