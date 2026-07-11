'use client';

import { type ReactNode } from 'react';
import { ChevronDown, Search, Target, Layers } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';

interface MobileMapToolbarProps {
  activeMapName: string;
  activeMapIcon: ReactNode;
  questProgress?: { done: number; total: number };
}

export function MobileMapToolbar({
  activeMapName,
  activeMapIcon,
  questProgress,
}: MobileMapToolbarProps) {
  const activeSheet = useMapUiStore((s) => s.activeSheet);
  const collapsed = useMapUiStore((s) => s.chromeCollapsed);
  const toggleSheet = useMapUiStore((s) => s.toggleSheet);

  const iconBtn = (active: boolean) =>
    `relative flex size-11 items-center justify-center rounded-xs ${active ? 'bg-(--surface-raised) text-(--primary)' : 'text-(--text-muted)'}`;

  const pending = questProgress ? questProgress.total - questProgress.done : 0;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] transition-transform duration-300 lg:hidden ${collapsed ? '-translate-y-full' : 'translate-y-0'}`}
    >
      {/* Дропдаун карт (заменяет ленту иконок) */}
      <button
        onClick={() => toggleSheet('maps')}
        className="pointer-events-auto flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xs border border-(--border) bg-(--surface)/90 px-3 backdrop-blur-sm"
      >
        <span className="flex size-6 shrink-0 items-center justify-center text-(--primary)">
          {activeMapIcon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left font-blender-medium text-sm uppercase tracking-widest text-(--text)">
          {activeMapName}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-(--text-muted) transition-transform ${activeSheet === 'maps' ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {/* Кластер иконок: поиск / квесты / слои */}
      <div className="pointer-events-auto flex items-center gap-1 rounded-xs border border-(--border) bg-(--surface)/90 px-1 backdrop-blur-sm">
        <button aria-label="Поиск" onClick={() => toggleSheet('search')} className={iconBtn(activeSheet === 'search')}>
          <Search className="size-5" strokeWidth={2} />
        </button>
        <button aria-label="Задания" onClick={() => toggleSheet('quests')} className={iconBtn(activeSheet === 'quests')}>
          <Target className="size-5" strokeWidth={2} />
          {pending > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--primary) px-1 font-blender-medium text-[10px] text-(--surface)">
              {pending}
            </span>
          )}
        </button>
        <button aria-label="Слои" onClick={() => toggleSheet('layers')} className={iconBtn(activeSheet === 'layers')}>
          <Layers className="size-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
