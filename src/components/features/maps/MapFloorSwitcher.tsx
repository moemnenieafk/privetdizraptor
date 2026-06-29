'use client';

import { useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { floorLevel, orderFloorsByLevel, type MapFloor } from '@/data/eft-map-config';

interface Props {
  floors: MapFloor[];
  active: number;
  onChange: (i: number) => void;
}

/** Компактный переключатель этажей (стиль панели зума): ▲ / номер текущего этажа / ▼. */
export function MapFloorSwitcher({ floors, active, onChange }: Props) {
  // Индексы этажей сверху вниз (выше уровень → выше в стеке) — для шага ▲/▼.
  const order = useMemo(() => orderFloorsByLevel(floors), [floors]);
  const pos = order.indexOf(active);
  const level = floorLevel(floors[active] ?? floors[0], active);
  const go = (dir: -1 | 1): void => {
    const next = pos + dir;
    if (next >= 0 && next < order.length) onChange(order[next]);
  };

  return (
    <div className="group absolute top-1/2 left-3 z-[500] flex -translate-y-1/2 flex-col overflow-hidden rounded-sm border border-lines-hover bg-(--color-base)/80 backdrop-blur-md">
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={pos <= 0}
        title="Этаж выше"
        aria-label="Этаж выше"
        className="border-b border-lines-hover p-2 text-text-secondary transition-colors hover:bg-card-menu hover:text-(--primary) disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <div
        title={floors[active]?.name}
        className="flex h-8 w-8 items-center justify-center border-b border-lines-hover font-blender-medium text-sm tabular-nums text-(--primary)"
      >
        {level}
      </div>

      <button
        type="button"
        onClick={() => go(1)}
        disabled={pos >= order.length - 1}
        title="Этаж ниже"
        aria-label="Этаж ниже"
        className="p-2 text-text-secondary transition-colors hover:bg-card-menu hover:text-(--primary) disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Онбординг-тултип */}
      <div className="pointer-events-none absolute top-1/2 left-full ml-2 w-max max-w-60 -translate-y-1/2 rounded-sm border border-lines-hover bg-card-menu px-2.5 py-1.5 font-blender-book text-xs leading-snug text-text-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        Используй ALT + Scroll, чтобы переключать этажи.
      </div>
    </div>
  );
}
