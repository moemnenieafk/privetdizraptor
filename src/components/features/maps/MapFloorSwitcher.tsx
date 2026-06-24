'use client';

import { useMemo } from 'react';
import type { MapFloor } from '@/data/eft-map-config';

interface Props {
  floors: MapFloor[];
  active: number;
  onChange: (i: number) => void;
}

/** Числовая метка этажа: наземный = 1, иначе число из имени, подземные → -1. */
function floorLevel(f: MapFloor, i: number): number {
  if (i === 0) return 1;
  const n = f.name.match(/(\d+)/)?.[1];
  return n ? Number(n) : -1;
}

/** Угловой вертикальный переключатель этажей (верхние сверху): -1 / 1 / 2 / 3… */
export function MapFloorSwitcher({ floors, active, onChange }: Props) {
  const ordered = useMemo(
    () => floors.map((f, i) => ({ f, i, lvl: floorLevel(f, i) })).sort((a, b) => b.lvl - a.lvl),
    [floors],
  );

  return (
    <div className="absolute left-3 top-1/2 z-[500] flex -translate-y-1/2 flex-col gap-1 rounded-sm border border-lines-hover bg-(--color-base)/80 p-1 backdrop-blur-md">
      {ordered.map(({ f, i, lvl }) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          title={f.name}
          className={`flex h-8 w-8 items-center justify-center rounded-xs font-blender-medium text-sm tabular-nums transition-colors ${
            i === active
              ? 'bg-(--primary) text-(--color-base)'
              : 'text-text-secondary hover:bg-card-menu hover:text-(--primary)'
          }`}
        >
          {lvl}
        </button>
      ))}
    </div>
  );
}
