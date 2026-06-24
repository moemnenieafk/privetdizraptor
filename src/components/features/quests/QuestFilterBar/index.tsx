'use client';

import { useMemo, useRef } from 'react';
import type { TaskRaw } from '@/types/quest';
import { QuestSearch } from '@/components/features/quests/QuestSearch';
import { MAP_ICON_CSS as MAP_CSS, MAP_ORDER } from '@/data/map-icons';

const traderImg = (n: string) => `/images/traders/eft/${n}.webp`;

const TRADER_ORDER = [
  'prapor', 'therapist', 'skier', 'peacekeeper', 'mechanic',
  'jaeger', 'ragman', 'ref', 'fence', 'lightkeeper', 'btrdriver',
];

interface MapEntry {
  id: string;
  name: string;
  normalizedName: string;
}

interface Props {
  tasks:            TaskRaw[];
  completedQuests:  string[];
  filterKappa:      boolean;
  filterLK:         boolean;
  selectedTraders:  Set<string>;
  selectedMaps:     Set<string>;
  searchOpen:       boolean;
  maps:             MapEntry[];
  onKappa:          () => void;
  onLK:             () => void;
  onTrader:         (name: string) => void;
  onMap:            (id: string) => void;
  onReset:          () => void;
  onResetProgress:  () => void;
  onSearchOpen:     () => void;
  onFocus:          (task: TaskRaw) => void;
}

const STATIC_MAPS: MapEntry[] = [
  { id: 'terminal', name: 'Терминал', normalizedName: 'terminal' },
];

export function QuestFilterBar({
  tasks,
  selectedTraders,
  selectedMaps,
  searchOpen,
  maps,
  onTrader,
  onMap,
  onResetProgress,
  onSearchOpen,
  onFocus,
}: Props) {
  const allMaps = useMemo(() => {
    const dynamicIds = new Set(maps.map(m => m.normalizedName));
    return [...maps, ...STATIC_MAPS.filter(s => !dynamicIds.has(s.normalizedName))];
  }, [maps]);

  const traders = useMemo(() => {
    const map = new Map<string, TaskRaw['trader']>();
    for (const t of tasks) {
      if (!map.has(t.trader.normalizedName)) map.set(t.trader.normalizedName, t.trader);
    }
    return TRADER_ORDER
      .filter(n => map.has(n))
      .map(n => map.get(n)!);
  }, [tasks]);

  const filterBtnCls = (active: boolean) =>
    `w-7 h-7 flex items-center justify-center rounded border transition-colors shrink-0 ${
      active
        ? 'bg-(--primary)/20 border-(--primary)/40 text-(--primary)'
        : 'border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary)'
    }`;

  const searchAnchorRef = useRef<HTMLDivElement>(null);

  const divider = <div className="w-px h-7 bg-lines-hover mx-3.5 shrink-0" />;

  return (
    <div className="relative flex items-center px-3.5 h-14 bg-card-menu shrink-0 overflow-x-auto">

      {/* Search toggle + dropdown */}
      <div ref={searchAnchorRef} className="relative shrink-0">
        <button
          onClick={onSearchOpen}
          title="Поиск квеста (Ctrl+F)"
          className={filterBtnCls(searchOpen)}
        >
          <span className="icon-mask icon-eft-search-icon w-3.5 h-3.5" />
        </button>
        {searchOpen && <QuestSearch tasks={tasks} onFocus={onFocus} anchorRef={searchAnchorRef} />}
      </div>

      {divider}

      {/* Center: traders + maps */}
      <div className="flex flex-1 items-center justify-center gap-0 min-w-0">

      {/* Trader portraits 32×32 */}
      <div className="flex items-center gap-2 shrink-0">
        {traders.map(trader => {
          const isSelected = selectedTraders.has(trader.normalizedName);
          return (
            <button
              key={trader.normalizedName}
              onClick={() => onTrader(trader.normalizedName)}
              title={trader.name}
              className={`w-8 h-8 rounded overflow-hidden shrink-0 transition-all ${
                isSelected ? 'ring-1 ring-(--primary)' : ''
              }`}
              style={{ opacity: selectedTraders.size > 0 && !isSelected ? 0.6 : 1 }}
            >
              <img
                src={traderImg(trader.normalizedName)}
                alt={trader.name}
                width={32}
                height={32}
                className="block object-cover object-top"
              />
            </button>
          );
        })}
      </div>

      {divider}

      {/* Map icons 28×28 */}
      {allMaps.length > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          {allMaps
            .filter(m => !m.normalizedName.includes('night') && !m.name.includes('21+'))
            .sort((a, b) => {
              const ai = MAP_ORDER.indexOf(a.normalizedName);
              const bi = MAP_ORDER.indexOf(b.normalizedName);
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            })
            .map(map => {
            const isActive = selectedMaps.has(map.id);
            const iconCls  = MAP_CSS[map.normalizedName];
            return (
              <button
                key={map.id}
                onClick={() => onMap(map.id)}
                title={map.name}
                className={`w-7 h-7 flex items-center justify-center rounded shrink-0 transition-all ${isActive ? 'text-(--primary)' : 'text-text-secondary'}`}
                style={{ opacity: selectedMaps.size > 0 && !isActive ? 0.35 : 1 }}
              >
                {iconCls ? (
                  <span className={`icon-mask ${iconCls} w-7 h-7`} />
                ) : (
                  <span className="text-type-caption font-blender-medium uppercase leading-none">
                    {map.name.slice(0, 3)}
                  </span>
                )}
              </button>
            );
          })}

          {/* Конец пути — static, always last */}
          {(() => {
            const isActive = selectedMaps.has('end-of-line');
            return (
              <button
                onClick={() => onMap('end-of-line')}
                title="Конец пути"
                className={`w-7 h-7 flex items-center justify-center rounded shrink-0 transition-all ${isActive ? 'text-(--primary)' : 'text-text-secondary'}`}
                style={{ opacity: selectedMaps.size > 0 && !isActive ? 0.35 : 1 }}
              >
                <span className="icon-mask icon-eft-end-of-line-map-icon w-7 h-7" />
              </button>
            );
          })()}
        </div>
      )}

      </div>{/* /Center */}

      {divider}

      {/* Reset progress */}
      <button
        onClick={onResetProgress}
        title="Сбросить прогресс заданий"
        className="w-7 h-7 flex items-center justify-center rounded border border-danger/60 text-danger/60 hover:border-danger hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
      >
        <span className="icon-mask icon-eft-profile-reset w-3.5 h-3.5" />
      </button>

    </div>
  );
}
