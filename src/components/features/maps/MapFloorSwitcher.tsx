'use client';

import { useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { floorLevel, orderFloorsByLevel, type MapFloor } from '@/data/eft-map-config';

interface Props {
  floors: MapFloor[];
  active: number;
  onChange: (i: number) => void;
}

/**
 * Переключатель этажей — компактный степпер С ИМЕНЕМ, низ-лево (GRILL-2; заменяет «левый
 * вертикальный список» §8). Раскладка: [уровень-бейдж] [▲/▼] [имя этажа]. Клавиатура/Alt+Scroll
 * переключают тоже (MapFrame) — тут только визуальный контрол.
 */
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
    <div className="group absolute bottom-3 left-3 z-[500] flex items-center gap-1.5 rounded-sm border border-lines-hover bg-(--color-base)/80 px-1.5 py-1.5 backdrop-blur-md">
      {/* Уровень текущего этажа — амбер-бейдж */}
      <span className="flex h-7 min-w-7 items-center justify-center rounded-xs bg-(--primary)/15 px-1 font-blender-medium text-sm tabular-nums text-(--primary)">
        {level}
      </span>

      {/* Шаг вверх/вниз по визуальному стеку этажей */}
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={pos <= 0}
          title="Этаж выше"
          aria-label="Этаж выше"
          className="text-text-secondary transition-colors hover:text-(--primary) disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={pos >= order.length - 1}
          title="Этаж ниже"
          aria-label="Этаж ниже"
          className="text-text-secondary transition-colors hover:text-(--primary) disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Имя текущего этажа */}
      <span className="pr-1 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary">
        {floors[active]?.name ?? ''}
      </span>

      {/* Онбординг-тултип (над контролом) */}
      <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-max max-w-60 rounded-sm border border-lines-hover bg-card-menu px-2.5 py-1.5 font-blender-book text-xs leading-snug text-text-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
      Используй ALT + Scroll, чтобы переключать этажи.
      </div>
    </div>
  );
}
