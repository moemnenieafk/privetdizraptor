'use client';

import {
  MANNEQUIN_ORDER,
  MANNEQUIN_VIEWBOX,
  PART_PATHS,
  partOpacity,
  type BodyPartLabel,
} from '@/components/features/bosses/body-mannequin.config';

interface BodyMannequinProps {
  values: Record<BodyPartLabel, number>;
  max: number;
  active?: BodyPartLabel | null;
  onEnter?: (label: BodyPartLabel) => void;
  onLeave?: () => void;
  className?: string;
}

/** Dumb-атом: чистый SVG, всё состояние приходит через props. */
export function BodyMannequin({
  values,
  max,
  active = null,
  onEnter,
  onLeave,
  className,
}: BodyMannequinProps) {
  return (
    <svg viewBox={MANNEQUIN_VIEWBOX} className={className} role="img" aria-label="Распределение HP по частям тела">
      {MANNEQUIN_ORDER.map((label) => {
        const isActive = active === label;
        const isDimmed = active !== null && !isActive;
        return (
          <path
            key={label}
            d={PART_PATHS[label]}
            className="cursor-pointer fill-(--primary) stroke-(--primary) stroke-2 transition-[fill-opacity,stroke-opacity] duration-150 [stroke-linejoin:round]"
            style={{
              fillOpacity: isActive ? 1 : isDimmed ? Math.min(0.22, partOpacity(values[label], max)) : partOpacity(values[label], max),
              strokeOpacity: isActive ? 1 : 0.5,
            }}
            tabIndex={0}
            onMouseEnter={() => onEnter?.(label)}
            onMouseLeave={() => onLeave?.()}
            onFocus={() => onEnter?.(label)}
            onBlur={() => onLeave?.()}
          />
        );
      })}
    </svg>
  );
}
