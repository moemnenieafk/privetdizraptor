'use client';

import { useMemo } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useQuestStore } from '@/store/useQuestStore';
import type { TaskRaw } from '@/types/quest';

const TRADER_SLUG: Record<string, string> = {
  'btr-driver': 'btrdriver',
};
const traderImg = (n: string) => `/images/traders/eft/${TRADER_SLUG[n] ?? n}.webp`;

interface Props {
  tasks: TaskRaw[];
  completedQuests: string[];
  filterKappa: boolean;
  filterLK: boolean;
  selectedTraders: Set<string>;
  onKappa: () => void;
  onLK: () => void;
  onTrader: (normalizedName: string) => void;
  onReset: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  searchOpen: boolean;
  onSearchOpen: () => void;
}

export function QuestFilterBar({
  tasks,
  completedQuests,
  filterKappa,
  filterLK,
  selectedTraders,
  onKappa,
  onLK,
  onTrader,
  onReset,
  isFullscreen,
  onToggleFullscreen,
  searchOpen,
  onSearchOpen,
}: Props) {
  const resetProgress = useQuestStore((s) => s.resetProgress);

  const completedSet = useMemo(() => new Set(completedQuests), [completedQuests]);

  const { statLabel, statValue } = useMemo(() => {
    if (filterKappa) {
      const total = tasks.filter((t) => t.kappaRequired).length;
      const done  = tasks.filter((t) => t.kappaRequired && completedSet.has(t.id)).length;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
      return { statLabel: 'Каппа', statValue: `${done} / ${total} (${pct}%)` };
    }
    if (filterLK) {
      const total = tasks.filter((t) => t.lightkeeperRequired).length;
      const done  = tasks.filter((t) => t.lightkeeperRequired && completedSet.has(t.id)).length;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
      return { statLabel: 'Смотритель', statValue: `${done} / ${total} (${pct}%)` };
    }
    const total = tasks.length;
    const done  = tasks.filter((t) => completedSet.has(t.id)).length;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
    return { statLabel: 'Выполнено', statValue: `${done} / ${total} (${pct}%)` };
  }, [tasks, completedSet, filterKappa, filterLK]);

  const traders = useMemo(() => {
    const seen = new Set<string>();
    return tasks
      .filter((t) => {
        if (seen.has(t.trader.normalizedName)) return false;
        seen.add(t.trader.normalizedName);
        return true;
      })
      .map((t) => t.trader);
  }, [tasks]);

  const toggleCls = (active: boolean) =>
    active
      ? 'bg-(--primary)/15 text-(--primary) border border-(--primary)/40'
      : 'bg-(--color-darkbase) text-text-muted border border-lines-hover hover:text-(--color-text-primary) hover:border-(--color-lines-active)';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-(--color-lines-hover) bg-card-menu flex-wrap shrink-0">
      {/* Progress stat */}
      <span className="text-[11px] font-blender-medium uppercase tracking-widest text-(--color-text-muted) shrink-0">
        {statLabel}:{' '}
        <span className="text-(--color-text-primary)">{statValue}</span>
      </span>

      <div className="w-px h-4 bg-(--color-lines-hover) shrink-0" />

      {/* Kappa toggle */}
      <button
        onClick={onKappa}
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded-xs text-[10px] font-blender-medium uppercase tracking-widest transition-colors duration-150 ${toggleCls(filterKappa)}`}
      >
        <span className="icon-bg icon-eft-profile-kappa w-3.5 h-3.5 shrink-0" />
        Путь к Каппе
      </button>

      {/* Lightkeeper toggle */}
      <button
        onClick={onLK}
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded-xs text-[10px] font-blender-medium uppercase tracking-widest transition-colors duration-150 ${toggleCls(filterLK)}`}
      >
        <span className="icon-bg icon-eft-profile-lightkeeper w-3.5 h-3.5 shrink-0" />
        Смотритель Маяка
      </button>

      <div className="w-px h-4 bg-(--color-lines-hover) shrink-0" />

      {/* Trader chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {traders.map((trader) => (
          <button
            key={trader.normalizedName}
            onClick={() => onTrader(trader.normalizedName)}
            className={`flex items-center gap-1 px-2 h-6 rounded-xs text-[10px] font-blender-medium uppercase tracking-widest transition-colors duration-150 ${toggleCls(selectedTraders.has(trader.normalizedName))}`}
          >
            <img
              src={traderImg(trader.normalizedName)}
              alt={trader.name}
              width={16}
              height={16}
              className="rounded-xs shrink-0"
            />
            {trader.name}
          </button>
        ))}
      </div>

      {/* Search button */}
      <div className="w-px h-4 bg-lines-hover shrink-0" />
      <button
        onClick={onSearchOpen}
        title="Поиск квеста (Ctrl+F)"
        className={`flex items-center gap-1.5 px-2.5 h-7 rounded-xs text-[10px] font-blender-medium uppercase tracking-widest transition-colors duration-150 ${toggleCls(searchOpen)}`}
      >
        <span className="icon-bg icon-eft-search w-3.5 h-3.5 shrink-0" />
        Поиск
      </button>

      {/* Right controls */}
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={() => { resetProgress(); onReset(); }}
          className="px-3 h-7 rounded-xs text-[10px] font-blender-medium uppercase tracking-widest text-(--color-danger)/70 border border-(--color-danger)/20 hover:bg-(--color-danger)/10 hover:text-(--color-danger) transition-colors duration-150"
        >
          Сбросить прогресс
        </button>

        <div className="w-px h-4 bg-lines-hover" />

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Выйти из полноэкранного режима (Esc)' : 'На весь экран'}
          className="flex items-center justify-center w-7 h-7 rounded-xs border border-lines-hover text-text-muted hover:text-(--primary) hover:border-(--primary)/50 transition-colors duration-150"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
