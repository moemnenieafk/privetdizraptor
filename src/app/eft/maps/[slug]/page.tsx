import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getEftMapData } from '@/db/maps';
import { getMapConfig } from '@/data/eft-map-config';
import { mapImageUrl } from '@/lib/map-image';
import { MapViewerLoader } from '@/components/features/maps/MapViewerLoader';
import type { MapView, MapViewMarker } from '@/components/features/maps/map-types';

interface Props {
  params: Promise<{ slug: string }>;
}

// v1 интерактива: выходы / спавны / переходы / опасности (остальное — за галочкой, v2).
const V1_TYPES = new Set(['extract', 'spawn', 'transit', 'hazard']);

// Детальная карта локации. Есть интерактивные данные + конфиг проекции → Leaflet-вьюер,
// иначе — умная заглушка (карты без SVG-подложки / не интерактивные).
export default async function MapPage({ params }: Props) {
  const { slug } = await params;
  const config = getMapConfig(slug);

  if (config?.svgFile && config.transform) {
    const data = await getEftMapData(slug);
    if (data?.asset.imageKey) {
      const markers: MapViewMarker[] = data.markers
        .filter((m) => V1_TYPES.has(m.type))
        .map((m) => ({
          id: m.id,
          type: m.type,
          position: m.position ?? null,
          outline: m.outline ?? null,
          label: m.label ?? null,
          faction: m.faction ?? null,
          sides: m.sides ?? null,
          categories: m.categories ?? null,
          meta: m.meta ?? null,
        }));

      const view: MapView = {
        slug,
        name: data.name,
        imageUrl: mapImageUrl(slug),
        author: data.asset.author,
        authorLink: data.asset.authorLink,
        raidDuration: data.asset.raidDuration,
        players: data.asset.players,
        minPlayerLevel: data.asset.minPlayerLevel,
        maxPlayerLevel: data.asset.maxPlayerLevel,
        config,
        markers,
      };
      return <MapViewerLoader data={view} />;
    }
  }

  const placeholder = getSectionPlaceholder(`/eft/maps/${slug}`);
  if (!placeholder) notFound();
  return <SectionPlaceholder {...placeholder} />;
}
