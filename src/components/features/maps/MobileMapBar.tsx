'use client';

import { Search, Crosshair, Layers } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { TrackerControls } from './PlayerTracker';

interface MobileMapBarProps {
  activeMapIconClass: string | null | undefined;
  activeMapName: string;
  tracker: TrackerControls;
  hasLayers: boolean;
  layersOpen: boolean;
  onLayersToggle: () => void;
}

/**
 * Верхняя панель карты (mobile-only) в стиле нижнего бара. Раскладка на 3 зоны:
 * слева — поиск, по центру — карта, справа — позиция + слои.
 * Кнопки как FullscreenToggleButton (rounded border border-lines-hover), 56×56 под тач.
 */
export function MobileMapBar({
  activeMapIconClass,
  activeMapName,
  tracker,
  hasLayers,
  layersOpen,
  onLayersToggle,
}: MobileMapBarProps) {
  const openSheet = useMapUiStore((s) => s.openSheet);
  const activeSheet = useMapUiStore((s) => s.activeSheet);

  const cell = (active: boolean) =>
    `flex size-14 shrink-0 items-center justify-center rounded border transition-colors ${
      active
        ? 'border-(--primary) text-(--primary)'
        : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
    }`;

  return (
    <div className="absolute inset-x-0 top-0 z-[560] flex h-14 items-center bg-card-menu px-3.5 lg:hidden">
      {/* Слева — поиск */}
      <div className="flex flex-1 justify-start">
        <button aria-label="Поиск" onClick={() => openSheet('search')} className={cell(activeSheet === 'search')}>
          <Search className="size-6" strokeWidth={2} />
        </button>
      </div>

      {/* По центру — карта */}
      <div className="flex flex-1 justify-center">
        <button aria-label={`Карта: ${activeMapName}`} onClick={() => openSheet('maps')} className={cell(activeSheet === 'maps')}>
          {activeMapIconClass ? (
            <span className={`icon-mask ${activeMapIconClass} size-7`} />
          ) : (