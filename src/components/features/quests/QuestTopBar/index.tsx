'use client';

import { useRef } from 'react';
import type { TaskRaw } from '@/types/quest';
import { QuestSearch } from '@/components/features/quests/QuestSearch';
import { QuestTraderDropdown, type TraderOpt } from '@/components/features/quests/QuestTraderDropdown';

interface Props {
  tasks:              TaskRaw[];
  searchOpen:         boolean;
  onSearchOpen:       () => void;
  onFocus:            (task: TaskRaw) => void;
  // Пути (Каппа / Смотритель) — пилюли-прогресс + тоглы фильтра.
  kappaTotal:         number;
  kappaCompleted:     number;
  lkTotal:            number;
  lkCompleted:        number;
  filterKappa:        boolean;
  filterLK:           boolean;
  onKappa:            () => void;
  onLK:               () => void;
  // Трейдер-пилюля + дропдаун.
  traders:            TraderOpt[];
  traderLevels:       Record<string, number>;
  selectedTrader:     string | null;
  onSelectTrader:     (name: string | null) => void;
  // Фуллскрин.
  isFullscreen:       boolean;
  onToggleFullscreen: () => void;
}

const iconBtn = (active: boolean) =>
  `flex h-7 w-7 shrink-0 items-center justify-center rounded border transition-colors ${
    active
      ? 'border-(--primary)/40 bg-(--primary)/20 text-(--primary)'
      : 'border-lines-hover text-text-secondary hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

/**
 * Верхняя панель карты заданий (десктоп) по паттерну MapTopBar: поиск слева · пути-пилюли
 * (Смотритель/Каппа) + трейдер-пилюля/дропдаун по центру · фуллскрин справа. Заменяет ряд из
 * 11 портретов (старый QuestFilterBar). УЛ-тоглы плавают отдельной полосой ПОД баром (см.
 * QuestMapClient). Мобилка — отдельным проходом (`hidden lg:flex`).
 */
export function QuestTopBar({
  tasks, searchOpen, onSearchOpen, onFocus,
  kappaTotal, kappaCompleted, lkTotal, lkCompleted, filterKappa, filterLK, onKappa, onLK,
  traders, traderLevels, selectedTrader, onSelectTrader,
  isFullscreen, onToggleFullscreen,
}: Props) {
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const kappaPct = kappaTotal > 0 ? Math.round((kappaCompleted / kappaTotal) * 100) : 0;
  const lkPct    = lkTotal    > 0 ? Math.round((lkCompleted    / lkTotal)    * 100) : 0;

  return (
    <div className="relative hidden h-14 shrink-0 items-center gap-3.5 border-b border-lines-hover bg-card-menu px-3.5 lg:flex">

      {/* Поиск (слева) */}
      <div ref={searchAnchorRef} className="relative shrink-0">
        <button onClick={onSearchOpen} title="Поиск по заданию (Ctrl+F)" className={iconBtn(searchOpen)}>
          <span className="icon-mask icon-eft-search-icon h-3.5 w-3.5" />
        </button>
        {searchOpen && <QuestSearch tasks={tasks} onFocus={onFocus} anchorRef={searchAnchorRef} />}
      </div>

      {/* Центр: пилюля Смотрителя · трейдер-пилюля · пилюля Каппы */}
      <div className="flex flex-1 items-center justify-center gap-3">

        <button
          onClick={onLK}
          title="Путь Смотрителя маяка"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded border px-2.5 transition-colors"
          style={filterLK
            ? { borderColor: 'var(--color-lightkeeper)', backgroundColor: 'var(--color-lightkeeper)', color: 'var(--color-darkbase)' }
            : { borderColor: 'var(--color-lightkeeper)', color: 'var(--color-lightkeeper)' }}
        >
          <span className="icon-mask icon-eft-profile-lightkeeper h-5.5 w-5.5" style={filterLK ? { backgroundColor: 'var(--color-darkbase)' } : undefined} />
          <span className="font-blender-medium text-type-caption">{lkCompleted} / {lkTotal} - {lkPct}%</span>
        </button>

        <QuestTraderDropdown traders={traders} traderLevels={traderLevels} selected={selectedTrader} onSelect={onSelectTrader} />

        <button
          onClick={onKappa}
          title="Путь Каппы"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded border px-2.5 transition-colors"
          style={filterKappa
            ? { borderColor: 'var(--color-kappa)', backgroundColor: 'var(--color-kappa)', color: 'var(--color-darkbase)' }
            : { borderColor: 'var(--color-kappa)', color: 'var(--color-kappa)' }}
        >
          <span className="icon-mask icon-eft-profile-kappa h-5.5 w-5.5" style={filterKappa ? { backgroundColor: 'var(--color-darkbase)' } : undefined} />
          <span className="font-blender-medium text-type-caption">{kappaCompleted} / {kappaTotal} - {kappaPct}%</span>
        </button>

      </div>

      {/* Фуллскрин (справа) */}
      <button onClick={onToggleFullscreen} title={isFullscreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим'} className={iconBtn(false)}>
        {isFullscreen
          ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 1v3H1M8 1v3h3M11 8H8v3M1 8h3v3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>

    </div>
  );
}
