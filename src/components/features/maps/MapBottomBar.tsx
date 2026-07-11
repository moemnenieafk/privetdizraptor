'use client';

import { useMapUiStore } from '@/store/useMapUiStore';
import { FullscreenToggleButton } from '@/components/ui/FullscreenToggleButton';
import { useMapQuestProgress } from './useMapQuestProgress';
import type { MapView } from './map-types';
import type { MapBossStat } from './map-frame-types';

interface Props {
  data: MapView;
  questIds: string[];
  bosses: MapBossStat[];
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Клик по боссу → подлёт к его возможным спавнам. */
  onBossClick?: (boss: MapBossStat) => void;
}

export function MapBottomBar({ data, questIds, bosses, isFullscreen, onToggleFullscreen, onBossClick }: Props) {
  const quest = useMapQuestProgress(questIds);
  const openSheet = useMapUiStore((s) => s.openSheet);

  return (
    <div className="flex items-center gap-3 px-3.5 h-14 bg-card-menu shrink-0">
      {/* Задания — компактная иконка + счётчик; тап открывает drawer заданий (mobile) */}
      {!data.config.staticMap && (
        <button
          type="button"
          onClick={() => openSheet('quests')}
          aria-label="Задания локации"
          className="flex shrink-0 items-center gap-1.5 rounded border border-lines-hover px-2 h-8 text-text-secondary transition-colors hover:border-(--primary)/40 hover:text-(--primary)"
        >
          <span className="icon-mask icon-eft-quest-maker h-4 w-4 shrink-0" />
          <span className="font-blender-medium text-type-caption">
            <span className="text-success">{quest.completed}</span>
            <span className="text-text-secondary">/{quest.total}</span>
          </span>
        </button>
      )}

      {/* Боссы + шансы спавна — отдаём максимум ширины */}
      {bosses.length > 0 && (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hidden">
          <span className="icon-mask icon-eft-lore-bosses h-4 w-4 shrink-0 text-(--primary)" />
          {bosses.map((b) => {
            const clickable = b.spawns.length > 0 && !!onBossClick;
            return (
              <button
                key={b.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onBossClick?.(b)}
                title={clickable ? `${b.name} — показать спавны` : b.name}
                className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xs font-blender-medium text-type-caption transition-colors ${
                  clickable ? 'cursor-pointer hover:text-(--primary)' : 'cursor-default'
                }`}
              >
                {b.icon && <img src={b.icon} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-xs object-contain" />}
                {b.spawnChance != null && <span className="text-(--primary)">{Math.round(b.spawnChance * 100)}%</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Пустой распорок, если боссов нет — чтобы фуллскрин прижался вправо */}
      {bosses.length === 0 && <div className="flex-1" />}

      {/* Фуллскрин — всегда справа */}
      <FullscreenToggleButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
    </div>
  );
}