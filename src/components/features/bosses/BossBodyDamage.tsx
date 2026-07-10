'use client';

import { useMemo, useState } from 'react';
import type { BossHealthPart } from '@/types/boss';
import { BodyMannequin } from '@/components/ui/BodyMannequin';
import { MANNEQUIN_ORDER, type BodyPartLabel } from './body-mannequin.config';

/** Хитмап HP: манекен + бары, ховер синхронизирован в обе стороны. */
export function BossBodyDamage({ health }: { health: BossHealthPart[] }) {
  const [active, setActive] = useState<BodyPartLabel | null>(null);

  const { values, max } = useMemo(() => {
    const map = new Map<string, number>(health.map((h) => [h.part, h.hp]));
    const entries = MANNEQUIN_ORDER.map((label) => [label, map.get(label) ?? 0] as const);
    return {
      values: Object.fromEntries(entries) as Record<BodyPartLabel, number>,
      max: Math.max(0, ...health.map((h) => h.hp)),
    };
  }, [health]);

  return (
    <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:gap-10">
      <div className="w-40 shrink-0 sm:w-48">
        <BodyMannequin
          values={values}
          max={max}
          active={active}
          onEnter={setActive}
          onLeave={() => setActive(null)}
          className="h-auto w-full"
        />
      </div>

      <ul className="flex w-full flex-col gap-3.5">
        {MANNEQUIN_ORDER.map((label) => {
          const hp = values[label];
          const isActive = active === label;
          const isDimmed = active !== null && !isActive;
          return (
            <li
              key={label}
              className="flex items-center gap-3 transition-opacity duration-150"
              style={{ opacity: isDimmed ? 0.4 : 1 }}
              onMouseEnter={() => setActive(label)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="w-28 shrink-0 text-sm text-text-secondary font-blender-book">{label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-lines-hover">
                <div
                  className="h-full bg-(--primary) transition-[width] duration-300"
                  style={{ width: `${max > 0 ? (hp / max) * 100 : 0}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-blender-medium text-text-primary">{hp}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
