'use client';

import dynamic from 'next/dynamic';
import type { MapView } from './map-types';

// Leaflet работает только в браузере (нужен window) → грузим клиент без SSR (правило 6).
const MapViewerClient = dynamic(
  () => import('./MapViewerClient').then((m) => m.MapViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[78vh] min-h-[560px] w-full overflow-hidden rounded-sm border border-lines-hover bg-card-menu">
        <div className="absolute inset-0 animate-pulse bg-linear-to-br from-card-menu to-(--color-base)" />
        <div className="absolute top-4 left-4 h-16 w-56 animate-pulse rounded-sm bg-lines-hover/40" />
        <div className="absolute top-4 right-4 h-40 w-48 animate-pulse rounded-sm bg-lines-hover/40" />
      </div>
    ),
  },
);

export function MapViewerLoader({ data }: { data: MapView }) {
  return <MapViewerClient data={data} />;
}
