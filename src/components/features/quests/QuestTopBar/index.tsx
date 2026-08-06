'use client';

import { Maximize, Minimize } from 'lucide-react';
import { QuestTraderDropdown, type TraderOpt } from '@/components/features/quests/QuestTraderDropdown';

interface Props {
  searchOpen:         boolean;
  onSearchOpen:       () => void;
  // Пути (Каппа / Смотритель) — пилюли-прогресс + тоглы фильтра.
  kappaTotal:         number;
  kappaCompleted:     number;
  lkTotal:            number;
  lkCompleted:        number;
  filterKappa:        boolean;
  filterLK:           boolean;
  onKappa:            () => void;
  onLK:               () => void;
  // Трейдер-плашка + дропдаун (центр-переключатель, паттерн MapNavDropdown).
  traders:            TraderOpt[];
  traderLevels:       Record<string, number>;
  selectedTrader:     string | null;
  onSelectTrader:     (name: string | null) => void;
  // Фуллскрин.
  isFullscreen:       boolean;
  onToggleFullscreen: () => void;
}

// Кнопка-тоггл бара 36×36 — как MapTopBar.toggleCls: pointer-events-auto + фон card-menu
// (бар прозрачный/плавающий, сквозь него виден канвас; интерактив ловят только кнопки).
const toggleCls = (active: boolean): string =>
  `pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded border bg-card-menu transition-colors ${
    active
      ? 'border-(--primary) text-(--primary)'
      : 'border-lines-hover text-text-secondary hover:border-(--primary)/40 hover:text-(--primary)'
  }`;

/**
 * Верхний бар карты заданий — раскладка 1:1 с MapTopBar карт локаций: прозрачный плавающий оверлей
 * (border-t, без фона), поиск слева (36×36) · ЦЕНТР [пилюля Смотрителя · трейдер-плашка/дропдаун ·
 * пилюля Каппы] · фуллскрин справа. flex-1 по краям центрируют группу. Позиционирует QuestMapClient
 * (`pointer-events-none absolute inset-x-0 top-0`). Мобилка — MobileQuestBar (отдельный проход).
 */
export function QuestTopBar({
  searchOpen, onSearchOpen,
  kappaTotal, kappaCompleted, lkTotal, lkCompleted, filterKappa, filterLK, onKappa, onLK,
  traders, traderLevels, selectedTrader, onSelectTrader,
  isFullscreen, onToggleFullscreen,
}: Props) {
  const kappaPct = kappaTotal > 0 ? Math.round((kappaCompleted / kappaTotal) * 100) : 0;
  const lkPct    = lkTotal    > 0 ? Math.round((lkCompleted    / lkTotal)    * 100) : 0;

  return (
    <div className="relative flex h-14 items-center overflow-x-auto scrollbar-hidden border-t border-lines-hover px-3.5">

      {/* Слева — поиск 36×36 (тоггл левого дровера «Поиск по заданию») */}
      <div className="flex flex-1 items-center">
        <button onClick={onSearchOpen} title="Поиск по заданию (Ctrl+F)" className={toggleCls(searchOpen)}>
          <span className="icon-mask icon-eft-search-icon h-5.5 w-5.5" />
        </button>
      </div>

      {/* Центр: пилюля Смотрителя · трейдер-плашка · пилюля Каппы */}
      <div className="flex shrink-0 items-center gap-3.5">
        <button
          onClick={onLK}
          title="Путь Смотрителя маяка"
          className="pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded border px-2.5 transition-colors"
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
          className="pointer-events-auto flex h-9 shrink-0 items-center gap-1.5 rounded border px-2.5 transition-colors"
          style={filterKappa
            ? { borderColor: 'var(--color-kappa)', backgroundColor: 'var(--color-kappa)', color: 'var(--color-darkbase)' }
            : { borderColor: 'var(--color-kappa)', color: 'var(--color-kappa)' }}
        >
          <span className="icon-mask icon-eft-profile-kappa h-5.5 w-5.5" style={filterKappa ? { backgroundColor: 'var(--color-darkbase)' } : undefined} />
          <span className="font-blender-medium text-type-caption">{kappaCompleted} / {kappaTotal} - {kappaPct}%</span>
        </button>
      </div>

      {/* Справа — фуллскрин 36×36 */}
      <div className="flex flex-1 items-center justify-end">
        <button onClick={onToggleFullscreen} title={isFullscreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим'} className={toggleCls(false)}>
          {isFullscreen ? <Minimize className="h-5.5 w-5.5" /> : <Maximize className="h-5.5 w-5.5" />}
        </button>
      </div>

    </div>
  );
}
