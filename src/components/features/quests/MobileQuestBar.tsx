'use client';

import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';

interface Props {
  /** Активен ли фильтр по картам — для подсветки иконки. */
  mapsFilterActive: boolean;
}

/**
 * Верхняя панель карты квестов (mobile-only), в стиле баров карт локаций:
 * слева — поиск, по центру — торговцы (перелёт к портрету), справа — карты (фильтр).
 * Кнопки 28×28 как FullscreenToggleButton.
 */
export function MobileQuestBar({ mapsFilterActive }: Props) {
  const openSheet = useQuestMapUiStore((s) => s.openSheet);
  const activeSheet = useQuestMapUiStore((s) => s.activeSheet);

  const cell = (active: boolean) =>
    `flex size-7 shrink-0 items-center justify-center rounded border transition-colors ${
      active
        ? 'border-(--primary) text-(--primary)'
        : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
    }`;

  return (
    <div className="flex h-14 shrink-0 items-center bg-card-menu px-3.5 lg:hidden">
      {/* Слева — поиск */}
      <div className="flex flex-1 justify-start">
        <button aria-label="Поиск квеста" onClick={() => openSheet('search')} className={cell(activeSheet === 'search')}>
          <span className="icon-mask icon-eft-search-icon h-4 w-4" />
        </button>
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