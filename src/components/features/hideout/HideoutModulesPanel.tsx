'use client';

// Плотная сетка модулей убежища (для объединённого трекера «Важные предметы»).
// Плитка = иконка (28px) + уровень «0N» (22px) + имя; горизонтальная заливка level/maxLevel.
// ИНДИКАТОР уровней (read-only) + ССЫЛКА на постройку: клик → /modules?module=<nn>.
// Уровни ставятся на странице модулей; здесь только показ (учитывая editionFloor). Свёрнута по умолчанию.
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { editionFloor } from '@/lib/hideout-edition';
import type { HideoutStationInfo } from './HideoutLevelsPanel';

const ICON_BASE = '/icons/eft/04-progression/hideout-modules';
// Имена иконок — underscore; часть станций расходится со slug (нормализованным именем).
const ICON_OVERRIDE: Record<string, string> = {
  medstation: 'med_station',
  illumination: 'illumitation',
  'intelligence-center': 'intelligence_centre',
  'intelligence-centre': 'intelligence_centre',
  'weapon-rack': 'weapon_rack',
  'gear-rack': 'gear_rack',
};
export const moduleIcon = (nn: string) => `${ICON_BASE}/${ICON_OVERRIDE[nn] ?? nn.replace(/-/g, '_')}.svg`;

function ModuleTile({ station, edition }: { station: HideoutStationInfo; edition?: string }) {
  const raw = useHideoutStore((s) => s.levels[station.normalizedName] ?? 0);
  const level = Math.max(raw, editionFloor(station.normalizedName, edition)); // индикатор с учётом издания
  const max = station.maxLevel;
  const pct = max > 0 ? Math.round((level / max) * 100) : 0;
  const done = level >= max;
  const active = level > 0;

  return (
    <Link
      href={`/eft/progress/hideout/modules?module=${station.normalizedName}`}
      title={`${station.name} — ур. ${level}/${max} · открыть постройку`}
      className="group relative flex select-none flex-col items-center gap-1 overflow-hidden rounded-xs border border-lines-hover bg-(--color-base) p-2 transition-[filter] hover:brightness-110"
    >
      {/* Горизонтальная заливка level/maxLevel */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 transition-[width] duration-300 ${done ? 'bg-success/25' : 'bg-(--primary)/20'}`}
        style={{ width: `${pct}%` }}
      />
      {/* Иконка модуля 28px + уровень «0N» 22px — в один ряд (компактнее) */}
      <span className="relative flex items-center gap-2">
        <span
          aria-hidden
          className={`h-7 w-7 shrink-0 mask-contain mask-center mask-no-repeat transition-colors ${
            done ? 'bg-success' : active ? 'bg-(--primary)' : 'bg-text-muted group-hover:bg-text-secondary'
          }`}
          style={{ maskImage: `url(${moduleIcon(station.normalizedName)})`, WebkitMaskImage: `url(${moduleIcon(station.normalizedName)})` }}
        />
        <span
          className={`font-blender-medium text-[22px] leading-none tabular-nums ${
            done ? 'text-success' : active ? 'text-(--primary)' : 'text-text-muted'
          }`}
        >
          {String(level).padStart(2, '0')}
        </span>
      </span>
      {/* Имя модуля (под иконкой+уровнем) */}
      <span className="relative line-clamp-1 w-full text-center font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary">
        {station.name}
      </span>
    </Link>
  );
}

export function HideoutModulesPanel({ stations }: { stations: HideoutStationInfo[] }) {
  const reset = useHideoutStore((s) => s.reset);
  const edition = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.edition);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-sm bg-(--color-darkbase)">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="shrink-0 font-blender-medium text-sm uppercase tracking-widest text-text-primary">Убежище ЧВК</span>
          <span className="hidden min-w-0 flex-1 truncate font-blender-book text-type-caption text-text-muted md:block">
            Индикатор уровней. Клик по модулю — <span className="text-(--primary)">открыть его постройку</span>.
          </span>
        </button>
        <button
          type="button"
          onClick={reset}
          title="Сбросить все уровни"
          className="flex h-7 shrink-0 items-center gap-1 rounded-xs border border-lines-hover px-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:border-danger hover:text-danger"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Сброс
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Свернуть' : 'Развернуть'}
          className="shrink-0"
        >
          <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>

      {open && (
        <div className="p-3 pt-0">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {stations.map((s) => (
              <ModuleTile key={s.normalizedName} station={s} edition={edition} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
