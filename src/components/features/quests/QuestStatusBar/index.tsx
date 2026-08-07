'use client';

import { useState } from 'react';
import { Maximize, Minimize, Save, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuestMapUiStore } from '@/store/useQuestMapUiStore';
import { QuestCheckpointsSheet } from '@/components/features/quests/QuestCheckpointsSheet';

interface Props {
  isFullscreen:       boolean;
  onToggleFullscreen: () => void;
  /** Активен ли фильтр по картам — подсветка центральной иконки карт. */
  mapsFilterActive:   boolean;
  /** Проброс в шит чекпоинтов: офлайн-бэкап файлом + сброс. */
  onExport:           () => void;
  onImport:           (file: File) => void;
  onResetProgress:    () => void;
}

/**
 * Нижний плавающий док мобильной карты заданий (Figma Q1, mobile-only): по краям —
 * фуллскрин · дискета (чекпоинты) слева, скрепка (пины) · поиск справа; по центру —
 * подсвеченные карты (шит локаций) с шевроном-вниз, который сворачивает весь док.
 * Каппа/Смотритель и прогресс переехали в верхний ряд-фильтров — тут их нет.
 */
export function QuestStatusBar({
  isFullscreen, onToggleFullscreen, mapsFilterActive,
  onExport, onImport, onResetProgress,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const openSheet   = useQuestMapUiStore((s) => s.openSheet);
  const activeSheet = useQuestMapUiStore((s) => s.activeSheet);

  const cell = (active: boolean) =>
    `flex size-9 shrink-0 items-center justify-center rounded border transition-colors ${
      active
        ? 'border-(--primary) text-(--primary)'
        : 'border-lines-hover text-text-secondary active:text-(--primary)'
    }`;

  if (collapsed) {
    return (
      <>
        <div className="flex shrink-0 justify-center lg:hidden">
          <button
            onClick={() => setCollapsed(false)}
            aria-label="Развернуть панель"
            className="flex h-6 w-20 items-center justify-center rounded-t-md border border-b-0 border-lines-hover text-text-secondary active:text-(--primary)"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
        <QuestCheckpointsSheet onExport={onExport} onImport={onImport} onResetProgress={onResetProgress} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between px-4 lg:hidden">
        {/* Слева — фуллскрин · дискета (чекпоинты) */}
        <div className="flex items-center gap-3">
          <button onClick={onToggleFullscreen} title={isFullscreen ? 'Выйти из полноэкранного' : 'Полноэкранный режим'} className={cell(false)}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <button onClick={() => openSheet('checkpoints')} title="Чекпоинты прогресса" className={cell(activeSheet === 'checkpoints')}>
            <Save className="h-4 w-4" />
          </button>
        </div>

        {/* Центр — карты (шит локаций, подсвечены) + шеврон-сворачивание */}
        <div className="flex flex-col items-center gap-0.5">
          <button onClick={() => openSheet('maps')} title="Локации" className={cell(activeSheet === 'maps' || mapsFilterActive)}>
            <span className="icon-mask icon-eft-maps h-4.5 w-4.5" />
          </button>
          <button onClick={() => setCollapsed(true)} aria-label="Свернуть панель" className="flex h-4 w-9 items-center justify-center text-text-muted active:text-(--primary)">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Справа — скрепка (пины) · поиск */}
        <div className="flex items-center gap-3">
          <button onClick={() => openSheet('pinned')} title="Отслеживание квестов" className={cell(activeSheet === 'pinned')}>
            <Paperclip className="h-4 w-4" />
          </button>
          <button onClick={() => openSheet('search')} title="Поиск по заданию" className={cell(activeSheet === 'search')}>
            <span className="icon-mask icon-eft-search-icon h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <QuestCheckpointsSheet onExport={onExport} onImport={onImport} onResetProgress={onResetProgress} />
    </>
  );
}
