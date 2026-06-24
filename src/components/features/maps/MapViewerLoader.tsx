'use client';

import dynamic from 'next/dynamic';
import type { MapView } from './map-types';
import type { MapViewerApi } from './map-frame-types';

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
}: {
  data: MapView;
  onReady?: (api: MapViewerApi) => void;
  activeFloor?: number;
}) {
  return <MapViewerClient data={data} onReady={onReady} activeFloor={activeFloor} />;
}
