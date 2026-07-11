'use client';

import { Maximize2, Minimize2, ChevronUp, ChevronDown } from 'lucide-react';
import { useMapUiStore } from '@/store/useMapUiStore';

interface MapFloatingControlsProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

// Плавающий кластер: фуллскрин (режим «второй монитор») + сворачивание верхнего хрома.
// bottom-40 держит его над нижним баром — правь под свои оффсеты.
export function MapFloatingControls({ isFullscreen, onToggleFullscreen }: MapFloatingControlsProps) {
  const collapsed = useMapUiStore((s) => s.chromeCollapsed);
  const toggleChrome = useMapUiStore((s) => s.toggleChrome);

  return (
    <div className="absolute right-2 bottom-40 z-30 flex flex-col gap-2 lg:hidden">
      <button
        aria-label={isFullscreen ? 'Выйти из полноэкранного' : 'Полный экран'}
        onClick={onToggleFullscreen}
        className="flex size-11 items-center justify-center rounded-xs border border-lines-hover bg-(--color-base)/90 text-(--primary) backdrop-blur-sm"
      >
        {isFullscreen ? <Minimize2 className="size-5" strokeWidth={2} /> : <Maximize2 className="size-5" strokeWidth={2} />}
      </button>
      <button
        aria-label={collapsed ? 'Показать панель' : 'Скрыть панель'}
        onClick={toggleChrome}
        className="flex size-11 items-center justify-center rounded-xs border border-lines-hover bg-(--color-base)/90 text-(--color-muted) backdrop-blur-sm"
      >
        {collapsed ? <ChevronDown className="size-5" strokeWidth={2} /> : <ChevronUp className="size-5" strokeWidth={2} />}
      </button>
    </div>
  );
}