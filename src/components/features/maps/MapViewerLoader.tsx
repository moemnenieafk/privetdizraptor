'use client';

import dynamic from 'next/dynamic';
import type { MapView, MapViewMarker } from './map-types';
import type { MapViewerApi } from './map-frame-types';
import type { EditorialMarkerData, QuestIndexItem, StoryIndexItem } from './EditorialMarkerCard';
import type { HeatPoint } from '@/db/loot-heat';

// Leaflet работает только в браузере (нужен window) → грузим клиент без SSR (правило 6).
const MapViewerClient = dynamic(
  () => import('./MapViewerClient').then((m) => m.MapViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 overflow-hidden bg-card-menu">
        <div className="absolute inset-0 animate-pulse bg-linear-to-br from-card-menu to-(--color-base)" />
        <div className="absolute top-4 left-4 h-10 w-44 animate-pulse rounded-sm bg-lines-hover/40" />
        <div className="absolute top-4 right-4 h-40 w-48 animate-pulse rounded-sm bg-lines-hover/40" />
      </div>
    ),
  },
);

export function MapViewerLoader({
  data,
  onReady,
  activeFloor,
  onRequestFloor,
  editorialMarkers,
  editorialBridge,
  heatPoints,
  canEditMarkers,
  mapId,
  questIndex,
  storyIndex,
}: {
  data: MapView;
  onReady?: (api: MapViewerApi) => void;
  activeFloor?: number;
  onRequestFloor?: (idx: number) => void;
  editorialMarkers?: EditorialMarkerData[];
  editorialBridge?: MapViewMarker[];
  heatPoints?: HeatPoint[];
  canEditMarkers?: boolean;
  mapId?: string;
  questIndex?: QuestIndexItem[];
  storyIndex?: StoryIndexItem[];
}) {
  return (
    <MapViewerClient
      data={data}
      onReady={onReady}
      activeFloor={activeFloor}
      onRequestFloor={onRequestFloor}
      editorialMarkers={editorialMarkers}
      editorialBridge={editorialBridge}
      heatPoints={heatPoints}
      canEditMarkers={canEditMarkers}
      mapId={mapId}
      questIndex={questIndex}
      storyIndex={storyIndex}
    />
  );
}
