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
 * Блок этажей — низ-лево, без фона-подложки: [амбер-квадрат текущего этажа] · [▲] · [▼] · [имя].
 * ▲/▼ — две отдельные кнопки 36×36 с gap. Клавиатура/Alt+Scroll переключают тоже (MapFrame).
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

  const btnCls =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:text-(--primary) disabled:pointer-events-none disabled:opacity-30';

  return (
    <div className="group absolute bottom-3.5 left-3.5 z-[500] flex items-center gap-3">
      {/* Кнопки этажа — амбер-текущий + ▲/▼, gap 4px между ними */}
      <div className="flex items-center gap-1">
        {/* Текущий этаж — яркий амбер */}
        <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded bg-(--primary) px-1.5 font-blender-medium text-lg tabular-nums text-(--color-base)">
          {level}
        </span>

        {/* Вверх / вниз — две отдельные кнопки */}
        <button type="button" onClick={() => go(-1)} disabled={pos <= 0} title="Этаж выше" aria-label="Этаж выше" className={btnCls}>
          <ChevronUp className="h-5.5 w-5.5" />
        </button>
        <button type="button" onClick={() => go(1)} disabled={pos >= order.length - 1} title="Этаж ниже" aria-label="Этаж ниже" className={btnCls}>
          <ChevronDown className="h-5.5 w-5.5" />
        </button>
      </div>

      {/* Имя текущего этажа */}
      <span className="shrink-0 font-blender-medium text-sm uppercase tracking-widest text-text-secondary">
        {floors[active]?.name ?? ''}
      </span>

      {/* Онбординг-тултип (над блоком) */}
      <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-max max-w-60 rounded-sm border border-lines-hover bg-card-menu px-2.5 py-1.5 font-blender-book text-xs leading-snug text-text-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        Используй ALT + Scroll, чтобы переключать этажи.
      </div>
    </div>
  );
}
