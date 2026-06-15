"use client";

import { ItemGridSize } from '@/components/ui/ItemGridSize';
import { useEftItemTile } from './context';
import type { EftTopStat } from './types';

interface EftHeaderProps {
  stat?: string;
}

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

export function EftHeader({ stat }: EftHeaderProps) {
  const { item } = useEftItemTile();
  const statDisplay = stat ?? (item.topStat ? renderTopStat(item.topStat) : null);

  return (
    <div className="mb-3 grid grid-cols-3 items-center gap-1">
      {/* Left: short name */}
      <span className="font-blender-medium text-xs uppercase tracking-wider text-text-primary truncate min-w-0">
        {item.shortName}
      </span>

      {/* Center: dynamic top indicator */}
      <div className="flex items-center justify-center">
        {statDisplay && (
          <span
            className="font-blender-medium text-[10px] whitespace-nowrap"
            style={{ color: '#9A8866' }}
          >
            {statDisplay}
          </span>
        )}
      </div>

      {/* Right: grid size — label first, icon right */}
      <div className="flex justify-end">
        <ItemGridSize width={item.width} height={item.height} showLabel labelFirst />
      </div>
    </div>
  );
}
