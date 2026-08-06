'use client';

import { useRef } from 'react';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { MAP_ICON_CSS as MAP_CSS, MAP_ORDER } from '@/data/map-icons';

const getLevelGroup = (level: number) => (level < 5 ? 1 : Math.min(16, Math.floor(level / 5) + 1));

interface MapEntry {
  id: string;
  name: string;
  normalizedName: string;
}

interface Props {
  totalQuests:     number;
  completedCount:  number;
  maps:            MapEntry[];
  selectedMaps:    Set<string>;
  onMap:           (id: string) => void;
  onExport:        () => void;
  onImport:        (file: File) => void;
  onResetProgress: () => void;
}

const STATIC_MAPS: MapEntry[] = [{ id: 'terminal', name: 'Терминал', normalizedName: 'terminal' }];
const btnCls = 'flex h-7 w-7 items-center justify-center rounded border border-lines-hover text-text-secondary transition-colors hover:border-(--primary)/40 hover:text-(--primary)';

/**
 * Нижняя панель карты заданий (десктоп): прогресс + уровень слева · иконки карт по центру
 * (переезд из старого QuestFilterBar) · импорт/экспорт/сброс справа. Мобилка использует
 * прежний QuestStatusBar (`hidden lg:flex` здесь).
 */
export function QuestBottomBar({
  totalQuests, completedCount, maps, selectedMaps, onMap, onExport, onImport, onResetProgress,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profiles = usePlayerStore(s => s.profiles);
  const activeProfileId = usePlayerStore(s => s.activeProfileId);
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  const levelGroup = getLevelGroup(Number(activeProfile?.level) || 1);
  const pct = totalQuests > 0 ? Math.round((completedCount / totalQuests) * 100) : 0;

  const dynamicIds = new Set(maps.map(m => m.normalizedName));
  const allMaps = [...maps, ...STATIC_MAPS.filter(s => !dynamicIds.has(s.normalizedName))]
    .filter(m => !m.normalizedName.includes('night') && !m.name.includes('21+'))
    .sort((a, b) => {
      const ai = MAP_ORDER.indexOf(a.normalizedName);
      const bi = MAP_ORDER.indexOf(b.normalizedName);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  const pickFile = () => fileInputRef.current?.click();

  return (
    <div className="hidden h-14 shrink-0 items-center gap-3.5 border-t border-lines-hover bg-card-menu px-3.5 lg:flex">

      {/* Прогресс + уровень (слева) */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1.5 font-blender-medium text-sm uppercase tracking-widest">
          <span className="text-success/25">Выполнено:</span>
          <span className="text-success">{completedCount}</span>
          <span className="text-text-secondary">/ {totalQuests} - {pct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative h-7 w-7 shrink-0">
            {!activeProfile?.prestige || activeProfile.prestige === '0'
              ? <img src={`/icons/eft/lvl-icons/player-level-group-${levelGroup}.webp`} alt="Level" className="h-full w-full object-contain" />
              : <img src={`/icons/eft/prestige/prestige-${activeProfile.prestige}.webp`} alt="Prestige" className="h-full w-full object-contain" />}
          </div>
          <span className="text-sm font-blender-medium leading-none text-text-secondary">{activeProfile?.level || '1'}</span>
          <div className="flex h-3 items-center justify-center rounded-[3px] border border-text-secondary px-1">
            <span className="text-type-caption uppercase leading-none tracking-wide text-text-secondary">{activeProfile?.faction}</span>
          </div>
        </div>
      </div>

      {/* Иконки карт (центр) */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-x-auto">
        {allMaps.map(map => {
          const isActive = selectedMaps.has(map.id);
          const iconCls = MAP_CSS[map.normalizedName];
          return (
            <button
              key={map.id}
              onClick={() => onMap(map.id)}
              title={map.name}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-all ${isActive ? 'text-(--primary)' : 'text-text-secondary'}`}
              style={{ opacity: selectedMaps.size > 0 && !isActive ? 0.35 : 1 }}
            >
              {iconCls
                ? <span className={`icon-mask ${iconCls} h-7 w-7`} />
                : <span className="text-type-caption font-blender-medium uppercase leading-none">{map.name.slice(0, 3)}</span>}
            </button>
          );
        })}
        <button
          onClick={() => onMap('end-of-line')}
          title="Конец пути"
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-all ${selectedMaps.has('end-of-line') ? 'text-(--primary)' : 'text-text-secondary'}`}
          style={{ opacity: selectedMaps.size > 0 && !selectedMaps.has('end-of-line') ? 0.35 : 1 }}
        >
          <span className="icon-mask icon-eft-end-of-line-map-icon h-7 w-7" />
        </button>
      </div>

      {/* Импорт / экспорт / сброс (справа) */}
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={pickFile} title="Импорт прогресса" className={btnCls}><Upload className="h-3.5 w-3.5" /></button>
        <button onClick={onExport} title="Экспорт прогресса" className={btnCls}><Download className="h-3.5 w-3.5" /></button>
        <button
          onClick={onResetProgress}
          title="Сбросить прогресс заданий"
          className="flex h-7 w-7 items-center justify-center rounded border border-danger/60 text-danger/60 transition-colors hover:border-danger hover:bg-danger/10 hover:text-danger"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => { const f = e.currentTarget.files?.[0]; if (f) { onImport(f); e.currentTarget.value = ''; } }}
        />
      </div>

    </div>
  );
}
