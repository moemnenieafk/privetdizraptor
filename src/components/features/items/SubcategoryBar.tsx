'use client';

import { X } from 'lucide-react';

const MASK_BASE = {
  WebkitMaskSize: 'contain' as const,
  WebkitMaskPosition: 'center' as const,
  WebkitMaskRepeat: 'no-repeat' as const,
  maskSize: 'contain' as const,
  maskPosition: 'center' as const,
  maskRepeat: 'no-repeat' as const,
};

interface SubcategoryBarProps {
  label: string;
  options: { id: string; label: string; iconUrl: string; preserveIconColor?: boolean }[];
  /** выбранные id; пустой набор = показаны все */
  active: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  counts?: Record<string, number>;
}

/** Мульти-выбор подкатегории иконками (BSG). Пустой выбор = «Все». */
export function SubcategoryBar({ label, options, active, onToggle, onClear, counts }: SubcategoryBarProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Микро-заголовок + линия (+ сброс, когда есть выбор) */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          {label}
        </span>
        <div className="h-px flex-1 bg-lines-hover" />
        {active.size > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex shrink-0 items-center gap-1 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
          >
            <X className="h-3 w-3" />
            Сброс
          </button>
        )}
      </div>

      {/* Иконочные плитки */}
      <div className="flex flex-wrap gap-2">
        {options.map(({ id, label: name, iconUrl, preserveIconColor }) => {
          const isActive = active.has(id);
          const count = counts?.[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              title={count !== undefined ? `${name} (${count})` : name}
              aria-pressed={isActive}
              className={`flex h-9 w-9 items-center justify-center rounded border transition-[background-color,border-color] duration-200 ${
                isActive
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_20%,transparent)]'
                  : 'border-lines-hover bg-card-menu hover:border-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
              }`}
            >
              {preserveIconColor ? (
                <img
                  src={iconUrl}
                  alt=""
                  className={`h-5.5 w-5.5 object-contain transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-60'}`}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className={`h-5.5 w-5.5 transition-[background-color,opacity] duration-200 ${isActive ? 'bg-(--primary) opacity-100' : 'bg-text-primary opacity-60'}`}
                  style={{ WebkitMaskImage: `url(${iconUrl})`, maskImage: `url(${iconUrl})`, ...MASK_BASE }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
