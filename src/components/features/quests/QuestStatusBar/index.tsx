'use client';

import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';

const getLevelGroup = (level: number) => {
  if (level < 5) return 1;
  return Math.min(16, Math.floor(level / 5) + 1);
};

interface Props {
  totalQuests:        number;
  completedCount:     number;
  kappaTotal:         number;
  kappaCompleted:     number;
  lkTotal:            number;
  lkCompleted:        number;
  filterKappa:        boolean;
  filterLK:           boolean;
  isFullscreen:       boolean;
  onKappa:            () => void;
  onLK:               () => void;
  onToggleFullscreen: () => void;
  onExport:           () => void;
  onImport:           (file: File) => void;
}

export function QuestStatusBar({
  totalQuests, completedCount,
  kappaTotal, kappaCompleted,
  lkTotal, lkCompleted,
  filterKappa, filterLK,
  isFullscreen, onToggleFullscreen,
  onKappa, onLK,
  onExport, onImport,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profiles       = usePlayerStore(s => s.profiles);
  const activeProfileId = usePlayerStore(s => s.activeProfileId);
  const activeProfile  = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  const levelGroup     = getLevelGroup(Number(activeProfile?.level) || 1);

  const pct      = totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;
  const kappaPct = kappaTotal  > 0 ? Math.round((kappaCompleted / kappaTotal)  * 100) : 0;
  const lkPct    = lkTotal     > 0 ? Math.round((lkCompleted    / lkTotal)     * 100) : 0;

  const btnCls = 'w-7 h-7 flex items-center justify-center rounded border border-lines-hover text-(--color-text-secondary) hover:border-(--primary)/40 hover:text-(--primary) transition-colors';

  return (
    <div className="flex items-center gap-3 px-3 h-14 bg-card-menu shrink-0">

      {/* Total progress — left edge */}
      <div className="flex items-center gap-1.5 font-blender-medium text-sm uppercase tracking-widest shrink-0">
        <span className="text-success/25">Выполнено:</span>
        <span className="text-success">{completedCount}</span>
        <span className="text-text-secondary">/ {totalQuests} - {pct}%</span>
      </div>

      {/* Center: LK + Kappa toggles + PlayerTelemetry */}
      <div className="flex flex-1 items-center justify-center gap-2">

        {/* Lightkeeper toggle */}
        <button
          onClick={onLK}
          title="Фильтр: только квесты для Смотрителя"
          className="flex items-center gap-1.5 px-2 h-7 rounded border transition-colors shrink-0"
          style={filterLK
            ? { borderColor: 'var(--color-lightkeeper)', backgroundColor: 'var(--color-lightkeeper)', color: 'var(--color-darkbase)' }
            : { borderColor: 'var(--color-lightkeeper)', color: 'var(--color-lightkeeper)' }
          }
        >
          <span className="icon-mask icon-eft-profile-lightkeeper w-5.5 h-5.5" style={filterLK ? { backgroundColor: 'var(--color-darkbase)' } : undefined} />
          <span className="font-blender-medium text-[11px]">
            {lkCompleted} / {lkTotal} - {lkPct}%
          </span>
        </button>

        {/* Kappa toggle */}
        <button
          onClick={onKappa}
          title="Фильтр: только квесты для Каппы"
          className="flex items-center gap-1.5 px-2 h-7 rounded border transition-colors shrink-0"
          style={filterKappa
            ? { borderColor: 'var(--color-kappa)', backgroundColor: 'var(--color-kappa)', color: 'var(--color-darkbase)' }
            : { borderColor: 'var(--color-kappa)', color: 'var(--color-kappa)' }
          }
        >
          <span className="icon-mask icon-eft-profile-kappa w-5.5 h-5.5" style={filterKappa ? { backgroundColor: 'var(--color-darkbase)' } : undefined} />
          <span className="font-blender-medium text-[11px]">
            {kappaCompleted} / {kappaTotal} - {kappaPct}%
          </span>
        </button>

        {/* Profile mini-block: level icon + level + faction — single row */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative w-7 h-7 shrink-0">
            {!activeProfile?.prestige || activeProfile.prestige === '0' ? (
              <img src={`/icons/eft/lvl-icons/player-level-group-${levelGroup}.webp`} alt="Level" className="w-full h-full object-contain" />
            ) : (
              <img src={`/icons/eft/prestige/prestige-${activeProfile.prestige}.webp`} alt="Prestige" className="w-full h-full object-contain" />
            )}
          </div>
          <span className="text-text-secondary text-sm font-blender-medium leading-none">
            {activeProfile?.level || '1'}
          </span>
          <div className="flex h-3 items-center justify-center rounded-[3px] border border-text-secondary px-1">
            <span className="text-text-secondary text-[8px] uppercase tracking-wide leading-none">
              {activeProfile?.faction}
            </span>
          </div>
        </div>

      </div>

      {/* Right actions */}
      <div className="flex items-center shrink-0">

        <button
          onClick={() => fileInputRef.current?.click()}
          title="Импорт прогресса"
          className={btnCls}
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => {
            const f = e.currentTarget.files?.[0];
            if (f) { onImport(f); e.currentTarget.value = ''; }
          }}
        />

        <button onClick={onExport} title="Экспорт прогресса" className={`${btnCls} ml-2`}>
          <Download className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-7 bg-lines-hover mx-3.5" />

        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим'}
          className={btnCls}
        >
          {isFullscreen
            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 1v3H1M8 1v3h3M11 8H8v3M1 8h3v3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4V1h3M8 1h3v3M11 8v3H8M4 11H1V8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          }
        </button>

      </div>
    </div>
  );
}
