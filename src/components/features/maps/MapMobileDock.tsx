'use client';

import { useMemo } from 'react';
import { ChevronDown, ChevronUp, Layers, Search } from 'lucide-react';
import { floorLevel, orderFloorsByLevel, type MapFloor } from '@/data/eft-map-config';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { MapBossStat } from './map-frame-types';

interface Props {
  floors: MapFloor[];
  activeFloor: number;
  onStepFloor: (dir: -1 | 1) => void;
  bosses: MapBossStat[];
  onBossClick?: (boss: MapBossStat) => void;
  /** Интерактивная карта (не статик) — есть слои/поиск. */
  hasLayers: boolean;
}

const DOCK_CELL =
  'flex size-9 shrink-0 items-center justify-center rounded border border-lines-hover bg-card-menu/90 text-text-secondary backdrop-blur transition-colors hover:text-(--primary) disabled:pointer-events-none disabled:opacity-30';

/**
 * Нижний плавающий док карты (mobile-only, `lg:hidden`) по макету Figma «UI - Maps - Mobile».
 * Три зоны: слева — этаж (ПОДВАЛЫ · уровень · ▲▼), по центру — босс + шанс спавна, справа — слои/поиск.
 * Контейнер прозрачный и `pointer-events-none` (карта кликается в зазорах), контролы — `pointer-events-auto`.
 * Прячется, когда открыт любой drawer/шит (иначе налезал бы на bottom-sheet). Сворачивается шевроном.
 */
export function MapMobileDock({ floors, activeFloor, onStepFloor, bosses, onBossClick, hasLayers }: Props) {
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  const toggleLayers = useMapUiStore((s) => s.toggleLayers);
  const searchOpen = useMapUiStore((s) => s.searchOpen);
  const toggleSearch = useMapUiStore((s) => s.toggleSearch);
  const activeSheet = useMapUiStore((s) => s.activeSheet);
  const collapsed = useMapUiStore((s) => s.chromeCollapsed);
  const toggleChrome = useMapUiStore((s) => s.toggleChrome);

  const order = useMemo(() => orderFloorsByLevel(floors), [floors]);
  const pos = order.indexOf(activeFloor);
  const level = floorLevel(floors[activeFloor] ?? floors[0], activeFloor);
  const multiFloor = floors.length > 1;

  const hasContent = multiFloor || bosses.length > 0 || hasLayers;
  // Пока открыт drawer/шит — прячем док (иначе он поверх bottom-sheet, z-560 > z-50/z-540).
  if (!hasContent || layersOpen || searchOpen || activeSheet) return null;

  if (collapsed) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[560] flex justify-center px-3.5 pb-3.5 lg:hidden">
        <button
          type="button"
          onClick={toggleChrome}
          aria-label="Развернуть панель карты"
          className="pointer-events-auto flex h-6 items-center gap-1.5 rounded-t-lg border border-lines-hover bg-card-menu/90 px-4 text-text-muted backdrop-blur transition-colors hover:text-(--primary)"
        >
          <ChevronUp className="size-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[560] grid grid-cols-3 items-end gap-2 px-3.5 pb-3.5 lg:hidden">
      {/* Слева — этаж (только мульти-этаж) */}
      <div className="flex justify-self-start">
        {multiFloor && (
          <div className="pointer-events-auto flex flex-col items-start gap-1">
            <span className="max-w-24 truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              {floors[activeFloor]?.name ?? ''}
            </span>
            <div className="flex items-center gap-1">
              <span className="flex size-9 min-w-9 items-center justify-center rounded bg-(--primary) px-1.5 font-blender-medium text-lg tabular-nums text-(--color-base)">
                {level}
              </span>
              <button type="button" onClick={() => onStepFloor(-1)} disabled={pos <= 0} aria-label="Этаж выше" className={DOCK_CELL}>
                <ChevronUp className="size-5" strokeWidth={2} />
              </button>
              <button type="button" onClick={() => onStepFloor(1)} disabled={pos >= order.length - 1} aria-label="Этаж ниже" className={DOCK_CELL}>
                <ChevronDown className="size-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* По центру — босс + шанс спавна + шеврон сворачивания */}
      <div className="flex flex-col items-center gap-1 justify-self-center">
        {bosses.length > 0 && (
          <div className="pointer-events-auto flex h-9 items-center gap-2 rounded border border-lines-hover bg-card-menu/90 px-2 backdrop-blur">
            {bosses.map((b) => {
              const clickable = b.spawns.length > 0 && !!onBossClick;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onBossClick?.(b)}
                  title={clickable ? `${b.name} — показать спавны` : b.name}
                  className={`flex items-center gap-1 font-blender-medium text-type-caption transition-colors ${
                    clickable ? 'cursor-pointer hover:text-(--primary)' : 'cursor-default'
                  }`}
                >
                  {b.icon && <img src={b.icon} alt="" width={28} height={28} className="size-7 shrink-0 rounded-xs object-contain" />}
                  {b.spawnChance != null && <span className="text-(--primary)">{Math.round(b.spawnChance * 100)}%</span>}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={toggleChrome}
          aria-label="Свернуть панель карты"
          className="pointer-events-auto flex h-5 w-9 items-center justify-center rounded text-text-muted backdrop-blur transition-colors hover:text-(--primary)"
        >
          <ChevronDown className="size-4" strokeWidth={2} />
        </button>
      </div>

      {/* Справа — слои + поиск */}
      <div className="flex items-center justify-end gap-2 justify-self-end">
        {hasLayers && (
          <>
            <button type="button" onClick={toggleLayers} aria-label="Слои карты" className={`${DOCK_CELL} pointer-events-auto`}>
              <Layers className="size-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={toggleSearch} aria-label="Поиск на локации" className={`${DOCK_CELL} pointer-events-auto`}>
              <Search className="size-4" strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
