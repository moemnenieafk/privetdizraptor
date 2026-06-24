'use client';

import { Clock, Skull, Users } from 'lucide-react';
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
}

export function MapBottomBar({ data, questIds, bosses, isFullscreen, onToggleFullscreen }: Props) {
  const quest = useMapQuestProgress(questIds);

  return (
    <div className="flex items-center gap-3 px-3.5 h-14 bg-card-menu shrink-0 overflow-x-auto scrollbar-hidden">
      {/* Прогресс по квестам карты */}
      <div className="flex shrink-0 items-center gap-1.5 font-blender-medium text-sm uppercase tracking-widest">
        <span className="text-text-secondary">Задания:</span>
        <span className="text-success">{quest.completed}</span>
        <span className="text-text-secondary">/ {quest.total} — {quest.pct}%</span>
      </div>

      {/* Боссы + шансы спавна */}
      {bosses.length > 0 && (
        <>
          <div className="h-7 w-px shrink-0 bg-lines-hover" />
          <div className="flex min-w-0 shrink items-center gap-2 overflow-x-auto scrollbar-hidden">
            <Skull className="h-3.5 w-3.5 shrink-0 text-(--primary)" />
            {bosses.map((b) => (
              <span
                key={b.id}
                className="flex shrink-0 items-center gap-1 whitespace-nowrap font-blender-medium text-type-caption text-text-secondary"
              >
                {b.name}
                {b.spawnChance != null && (
                  <span className="text-(--primary)">{Math.round(b.spawnChance * 100)}%</span>
                )}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Параметры рейда + fullscreen */}
      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="flex shrink-0 items-center gap-4 font-blender-medium text-type-caption text-text-secondary">
          {data.raidDuration ? (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-(--primary)" />
              {data.raidDuration} мин
            </span>
          ) : null}
          {data.players ? (
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-(--primary)" />
              {data.players}
            </span>
          ) : null}
          {data.minPlayerLevel ? (
            <span>
              ур. {data.minPlayerLevel}
              {data.maxPlayerLevel ? `–${data.maxPlayerLevel}` : '+'}
            </span>
          ) : null}
        </div>
        <FullscreenToggleButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
}
