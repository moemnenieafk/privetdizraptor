'use client';

import { EYEWEAR_SUBTYPE_LABELS, type EyewearSubtype } from '@/lib/eyewear-filter-config';

interface EyewearSubtypeBarProps {
  active: EyewearSubtype | 'all';
  onChange: (subtype: EyewearSubtype | 'all') => void;
  counts?: Partial<Record<EyewearSubtype | 'all', number>>;
}

const SUBTYPE_ORDER: (EyewearSubtype | 'all')[] = ['all', 'glasses', 'nvg', 'visor'];

export function EyewearSubtypeBar({ active, onChange, counts }: EyewearSubtypeBarProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {SUBTYPE_ORDER.map((subtype) => {
        const isActive = active === subtype;
        const count = counts?.[subtype];
        return (
          <button
            key={subtype}
            type="button"
            onClick={() => onChange(subtype)}
            className={`h-8 flex items-center gap-1.5 rounded border px-3 font-blender-medium text-xs uppercase tracking-wider transition-colors duration-200 ${
              isActive
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-(--primary)'
                : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary'
            }`}
          >
            {EYEWEAR_SUBTYPE_LABELS[subtype]}
            {count !== undefined && (
              <span className={`font-blender-medium text-type-caption ${isActive ? 'text-(--primary) opacity-70' : 'text-text-muted opacity-60'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
