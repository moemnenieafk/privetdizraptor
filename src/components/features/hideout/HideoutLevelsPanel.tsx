'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';

export interface HideoutStationInfo {
  normalizedName: string;
  name: string;
  maxLevel: number;
}

/** Сворачиваемый сеттер «Моё убежище» — выставить текущий уровень станций (persisted). */
export function HideoutLevelsPanel({ stations }: { stations: HideoutStationInfo[] }) {
  const [open, setOpen] = useState(false);
  const levels = useHideoutStore((s) => s.levels);
  const setLevel = useHideoutStore((s) => s.setLevel);
  const reset = useHideoutStore((s) => s.reset);

  const lvlOf = (s: HideoutStationInfo) => Math.min(levels[s.normalizedName] ?? 0, s.maxLevel);
  const builtModules = stations.reduce((n, s) => n + (lvlOf(s) > 0 ? 1 : 0), 0);
  const curLevels = stations.reduce((sum, s) => sum + lvlOf(s), 0);
  const totalLevels = stations.reduce((sum, s) => sum + s.maxLevel, 0);

  return (
    <div className="rounded-md border border-lines-hover bg-card-menu">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">
          Моё убежище
          <span className="ml-2 text-type-caption text-text-muted">
            {builtModules}/{stations.length} модулей · {curLevels}/{totalLevels} ур.
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" /> : <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />}
      </button>

      {open && (
        <div className="border-t border-lines-hover p-3">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((s) => {
              const lvl = lvlOf(s);
              return (
                <div key={s.normalizedName} className="flex items-center gap-2 rounded border border-lines-hover/60 bg-(--color-base) px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary font-blender-book" title={s.name}>{s.name}</span>
                  <button
                    type="button"
                    onClick={() => setLevel(s.normalizedName, Math.max(0, lvl - 1))}
                    disabled={lvl <= 0}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30 disabled:hover:border-lines-hover disabled:hover:text-text-secondary"
                  >−</button>
                  <span className="w-9 shrink-0 text-center text-sm font-blender-medium tabular-nums text-text-primary">{lvl}/{s.maxLevel}</span>
                  <button
                    type="button"
                    onClick={() => setLevel(s.normalizedName, Math.min(s.maxLevel, lvl + 1))}
                    disabled={lvl >= s.maxLevel}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30 disabled:hover:border-lines-hover disabled:hover:text-text-secondary"
                  >+</button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-3 flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-red-400"
          >
            <RotateCcw className="h-3 w-3" /> Сбросить
          </button>
        </div>
      )}
    </div>
  );
}
