'use client';

import { Crosshair, ChevronUp, ChevronDown } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';

interface MapFloatingControlsProps {
  onCenterPlayer: () => void;
}

// Плавающий кластер: «Позиция» + сворачивание хрома.
// bottom-40 держит его над зумом и нижним баром — правь под свои оффсеты.
export function MapFloatingControls({ onCenterPlayer }: MapFloatingControlsProps) {
  const collapsed = useMapUiStore((s) => s.chromeCollapsed);
  const toggleChrome = useMapUiStore((s) => s.toggleChrome);

  return (
    <div className="absolute right-2 bottom-40 z-30 flex flex-col gap-2 lg:hidden">
      <button
        aria-label="Центрировать на игроке"
        onClick={onCenterPlayer}
        className="flex size-11 items-center justify-center rounded-xs border border-(--border) bg-(--surface)/90 text-(--primary) backdrop-blur-sm"
      >
        <Crosshair className="size-5" strokeWidth={2} />
      </button>
      <button
        aria-label={collapsed ? 'Показать панель' : 'Скрыть панель'}
        onClick={toggleChrome}
        className="flex size-11 items-center justify-center rounded-xs border border-(--border) bg-(--surface)/90 text-(--text-muted) backdrop-blur-sm"
      >
        {collapsed ? <ChevronDown className="size-5" strokeWidth={2} /> : <ChevronUp className="size-5" strokeWidth={2} />}
      </button>
    </div>
  );
}
