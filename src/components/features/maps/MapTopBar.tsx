'use client';

import { Layers, MapPin, Maximize, Minimize, Ruler, SquarePen, Trash2, Users } from 'lucide-react';
import { MapNavDropdown, type NavMapItem } from './MapNavDropdown';
import { useMapUiStore } from '@/store/useMapUiStore';
import { useSquadStore } from '@/store/useSquadStore';
import type { MapView } from './map-types';

interface Props {
  data: MapView;
  navMaps: NavMapItem[];
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** admin/editor — показывать инструменты правки маркеров (постановка/оверрайд/удаление). */
  canEditMarkers?: boolean;
}

/** Кнопка-тоггл бара — 36×36 (h-9 w-9), иконка 22px, фон #242426 (card-menu), обводка #313135. */
const toggleCls = (active: boolean): string =>
  `pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-card-menu transition-colors ${
    active
      ? 'border-(--primary) text-(--primary)'
      : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

/**
 * Верхний бар карты, раскладка 1:1 с Figma: поиск (лево, 36×36) · ЦЕНТР-группа
 * [линейка · плашка-выпадашка 536×56 · фуллскрин] с гэпами 14px · слои (право, 36×36).
 * flex-1 по краям центрируют группу; поиск липнет к левому краю, слои — к правому.
 */
export function MapTopBar({ data, navMaps, isFullscreen, onToggleFullscreen, canEditMarkers }: Props) {
  const layersOpen = useMapUiStore((s) => s.layersOpen);
  const toggleLayers = useMapUiStore((s) => s.toggleLayers);
  const searchOpen = useMapUiStore((s) => s.searchOpen);
  const toggleSearch = useMapUiStore((s) => s.toggleSearch);
  const rulerActive = useMapUiStore((s) => s.rulerActive);
  const toggleRuler = useMapUiStore((s) => s.toggleRuler);
  // Инструменты правки/отряда — стейт в сторах, тумблеры здесь (кнопки уехали из угла карты).
  const addMode = useMapUiStore((s) => s.addMode);
  const toggleAddMode = useMapUiStore((s) => s.toggleAddMode);
  const overrideMode = useMapUiStore((s) => s.overrideMode);
  const toggleOverrideMode = useMapUiStore((s) => s.toggleOverrideMode);
  const deleteOpen = useMapUiStore((s) => s.deleteOpen);
  const toggleDelete = useMapUiStore((s) => s.toggleDelete);
  const deleteCount = useMapUiStore((s) => s.deleteMarks.length);
  const squadOpen = useMapUiStore((s) => s.squadOpen);
  const toggleSquad = useMapUiStore((s) => s.toggleSquad);
  const squadCount = useSquadStore((s) => s.members.length);
  const squadRoom = useSquadStore((s) => s.roomCode);

  const hasLayers = !data.config.staticMap;
  const canEdit = !!canEditMarkers && hasLayers;
  const hasSquad = !!data.config.transform; // отряд только на картах с проекцией координат

  return (
    <div className="relative flex h-14 items-center px-3.5 border-t border-lines-hover shrink-0 overflow-x-auto scrollbar-hidden">
      {/* Слева — поиск 36×36 (открывает левый drawer «ПОИСК НА ЛОКАЦИИ») */}
      <div className="flex flex-1 items-center">
        {!data.config.staticMap && (
          <button type="button" onClick={toggleSearch} title="Поиск (Ctrl+F)" aria-label="Поиск" className={toggleCls(searchOpen)}>
            <span className="icon-mask icon-eft-search-icon h-5.5 w-5.5" />
          </button>
        )}
      </div>

      {/* Центр-группа: [линейка · постановка] · плашка · [оверрайд · удаление · отряд · фуллскрин] */}
      <div className="flex shrink-0 items-center gap-3.5">
        {hasLayers && (
          <button type="button" onClick={toggleRuler} title="Линейка — замер расстояния (ЛКМ точки, ПКМ сброс)" aria-label="Линейка" className={toggleCls(rulerActive)}>
            <Ruler className="h-5.5 w-5.5" />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={toggleAddMode}
            aria-pressed={addMode}
            title={addMode ? 'Отмена постановки — кликните по карте, чтобы поставить маркер' : 'Поставить маркер на карте'}
            aria-label="Поставить маркер"
            className={toggleCls(addMode)}
          >
            <MapPin className="h-5.5 w-5.5" />
          </button>
        )}
        {hasSquad && (
          <button
            type="button"
            onClick={toggleSquad}
            aria-pressed={squadOpen}
            title="Отряд — позиции тиммейтов"
            aria-label="Отряд"
            className={`${toggleCls(squadOpen || !!squadRoom)} relative`}
          >
            <Users className="h-5.5 w-5.5" />
            {squadRoom && squadCount > 1 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-nvg-green px-1 font-blender-medium text-[9px] text-(--color-base) tabular-nums">
                {squadCount}
              </span>
            )}
          </button>
        )}

        <MapNavDropdown
          maps={navMaps}
          activeSlug={data.slug}
          activeName={data.name}
          activePlayers={data.players}
          activeRaidDuration={data.raidDuration}
        />

        {canEdit && (
          <button
            type="button"
            onClick={toggleOverrideMode}
            aria-pressed={overrideMode}
            title={overrideMode ? 'Выключить правку синканных (клик по маркеру = ссылка)' : 'Править синканные маркеры: клик → карточка-оверрайд'}
            aria-label="Править синканные маркеры"
            className={toggleCls(overrideMode)}
          >
            <SquarePen className="h-5.5 w-5.5" />
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={toggleDelete}
            aria-pressed={deleteOpen}
            title="Удаление маркеров (помеченные на удаление)"
            aria-label="Удаление маркеров"
            className={`pointer-events-auto relative flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-card-menu transition-colors ${
              deleteOpen ? 'border-danger text-danger' : 'border-lines-hover text-(--color-text-secondary) hover:border-danger/40 hover:text-danger'
            }`}
          >
            <Trash2 className="h-5.5 w-5.5" />
            {deleteCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 font-blender-medium text-[9px] text-(--color-base) tabular-nums">
                {deleteCount}
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим'}
          aria-label="Полноэкранный режим"
          className={toggleCls(false)}
        >
          {isFullscreen ? <Minimize className="h-5.5 w-5.5" /> : <Maximize className="h-5.5 w-5.5" />}
        </button>
      </div>

      {/* Справа — слои 36×36 у правого края */}
      <div className="flex flex-1 items-center justify-end">
        {hasLayers && (
          <button type="button" onClick={toggleLayers} title="Слои и фильтры" aria-label="Слои и фильтры" className={toggleCls(layersOpen)}>
            <Layers className="h-5.5 w-5.5" />
          </button>
        )}
      </div>
    </div>
  );
}
