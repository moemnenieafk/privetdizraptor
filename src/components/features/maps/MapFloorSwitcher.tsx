'use client';

import { useMemo } from 'react';
import { floorLevel, type MapFloor } from '@/data/eft-map-config';

interface Props {
  floors: MapFloor[];
  active: number;
  onChange: (i: number) => void;
}

/** Угловой вертикальный переключатель этажей (верхние сверху): -1 / 1 / 2 / 3… */
export function MapFloorSwitcher({ floors, active, onChange }: Props) {
  const ordered = useMemo(
    () => floors.map((f, i) => ({ f, i, lvl: floorLevel(f, i) })).sort((a, b) => b.lvl - a.lvl),
    [floors],
  );

  return (
    <div className="group absolute left-3 top-1/2 z-[500] flex -translate-y-1/2 flex-col gap-1 rounded-sm border border-lines-hover bg-(--color-base)/80 p-1 backdrop-blur-md">
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
      <div
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 ml-2 w-max max-w-60 -translate-y-1/2 rounded-sm border border-lines-hover bg-card-menu px-2.5 py-1.5 font-blender-book text-xs leading-snug text-text-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        Используй ALT + Scroll, чтобы переключать этажи.
      </div>
    </div>
  );
}
