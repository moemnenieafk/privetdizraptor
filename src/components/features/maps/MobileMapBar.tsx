'use client';

import { Clock, Users } from 'lucide-react';
import { mapIconClass } from '@/data/map-icons';
import { PocketKnifeIcon } from '@/components/ui/PocketKnifeIcon';
import { FullscreenToggleButton } from '@/components/ui/FullscreenToggleButton';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { MapView } from './map-types';

interface MobileMapBarProps {
  data: MapView;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * Верхний бар карты (mobile-only, `lg:hidden`) по макету Figma «UI - Maps - Mobile».
 * Раскладка: слева — [инструменты] · [пилюля карты с именем], справа — [условия рейда] · [фуллскрин].
 * Слои/поиск/этаж переехали в нижний док (MapMobileDock). Рендерится из MapFrame — там живут
 * data + fullscreen; тулзы/карты/рейд открываются шитами через useMapUiStore.
 */
export function MobileMapBar({ data, isFullscreen, onToggleFullscreen }: MobileMapBarProps) {
  const openSheet = useMapUiStore((s) => s.openSheet);
  const activeSheet = useMapUiStore((s) => s.activeSheet);
  const iconClass = mapIconClass(data.slug);

  const cell = (active: boolean) =>
    `flex size-7 shrink-0 items-center justify-center rounded border transition-colors ${
      active
        ? 'border-(--primary) text-(--primary)'
        : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
    }`;

  const hasRaid = !!data.players || data.raidDuration != null;

  return (
    <div className="absolute inset-x-0 top-0 z-[560] flex h-14 items-center gap-2 bg-card-menu px-3.5 lg:hidden">
      {/* Слева — инструменты + пилюля карты (имя локации) */}
      <button aria-label="Инструменты" onClick={() => openSheet('tools')} className={cell(activeSheet === 'tools')}>
        <PocketKnifeIcon className="size-4" />
      </button>

      <button
        aria-label={`Карта: ${data.name}`}
        onClick={() => openSheet('maps')}
        className={`flex h-7 min-w-0 shrink items-center gap-1.5 rounded border px-2 transition-colors ${
          activeSheet === 'maps'
            ? 'border-(--primary) text-(--primary)'
            : 'border-lines-hover text-text-secondary hover:border-(--primary)/40 hover:text-(--primary)'
        }`}
      >
        {iconClass && <span className={`icon-mask ${iconClass} size-4 shrink-0`} />}
        <span className="truncate font-blender-medium text-xs uppercase tracking-widest">{data.name}</span>
      </button>

      {/* Правый край — условия рейда (инлайн, тап → шит) + фуллскрин */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {hasRaid && (
          <button
            aria-label="Условия рейда"
            onClick={() => openSheet('raid')}
            className="flex items-center gap-2 font-blender-medium text-type-caption text-text-secondary transition-colors hover:text-(--primary)"
          >
            {data.players && (
              <span className="flex items-center gap-1">
                <Users className="size-3.5" strokeWidth={2} />
                {data.players}
              </span>
            )}
            {data.raidDuration != null && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" strokeWidth={2} />
                {data.raidDuration} мин
              </span>
            )}
          </button>
        )}
        <FullscreenToggleButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
}
