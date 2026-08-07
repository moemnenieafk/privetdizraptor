'use client';

import { Paperclip } from 'lucide-react';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';

interface Props {
  /** Активен ли фильтр по картам — для подсветки иконки. */
  mapsFilterActive: boolean;
  /** Число закреплённых квестов — триггер трекера показываем только когда есть что отслеживать. */
  pinnedCount: number;
}

/**
 * Верхняя панель карты квестов (mobile-only), в стиле баров карт локаций:
 * слева — поиск + трекер закреплённых, по центру — торговцы (перелёт к портрету),
 * справа — карты (фильтр). Кнопки 28×28 как FullscreenToggleButton.
 */
export function MobileQuestBar({ mapsFilterActive, pinnedCount }: Props) {
  const openSheet = useQuestMapUiStore((s) => s.openSheet);
  const activeSheet = useQuestMapUiStore((s) => s.activeSheet);

  const cell = (active: boolean) =>
    `flex size-7 shrink-0 items-center justify-center rounded transition-colors ${
      active
        ? 'border border-(--primary) text-(--primary)'
        : 'text-(--color-text-secondary) hover:text-(--primary)'
    }`;

  return (
    <div className="flex h-14 shrink-0 items-center bg-card-menu px-3.5 lg:hidden">
      {/* Слева — поиск + трекер закреплённых */}
      <div className="flex flex-1 justify-start gap-2">
        <button aria-label="Поиск квеста" onClick={() => openSheet('search')} className={cell(activeSheet === 'search')}>
          <span className="icon-mask icon-eft-search-icon h-4 w-4" />
        </button>
        {pinnedCount > 0 && (
          <button
            aria-label="Отслеживание прогресса"
            onClick={() => openSheet('pinned')}
            className={`relative ${cell(activeSheet === 'pinned')}`}
          >
            <Paperclip className="h-4 w-4" />
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--primary) px-1 font-blender-medium text-[10px] leading-none text-(--color-base)">
              {pinnedCount}
            </span>
          </button>
        )}
      </div>

      {/* По центру — торговцы */}
      <div className="flex flex-1 justify-center">
        <button aria-label="Торговцы" onClick={() => openSheet('traders')} className={cell(activeSheet === 'traders')}>
          <span className="icon-mask icon-eft-lore-traders h-4 w-4" />
        </button>
      </div>

      {/* Справа — карты (фильтр) */}
      <div className="flex flex-1 justify-end">
        <button
          aria-label="Фильтр по картам"
          onClick={() => openSheet('maps')}
          className={cell(activeSheet === 'maps' || mapsFilterActive)}
        >
          <span className="icon-mask icon-eft-maps h-4 w-4" />
        </button>
      </div>
    </div>
  );
}