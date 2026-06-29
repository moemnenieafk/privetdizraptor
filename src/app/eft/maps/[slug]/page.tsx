import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getEftMapData, getEftInteractiveMapsWithNames } from '@/db/maps';
import { getMapConfig, getStaticMaps } from '@/data/eft-map-config';
import { getManualMarkers } from '@/data/map-markers';
import { mapImageUrl } from '@/lib/map-image';
import { MapFrame } from '@/components/features/maps/MapFrame';
import { questsForMap } from '@/lib/map-quests';
import type { MapView, MapViewMarker } from '@/components/features/maps/map-types';
import type { MapBossStat, MapQuestZone } from '@/components/features/maps/map-frame-types';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ quest?: string }>;
}

// v1 интерактива: выходы / спавны / переходы / опасности (остальное — за галочкой, v2).
const V1_TYPES = new Set(['extract', 'spawn', 'transit', 'hazard']);

// Детальная карта локации. Есть интерактивные данные + конфиг проекции → Leaflet-фрейм,
// иначе — умная заглушка (карты без SVG-подложки / не интерактивные).
export default async function MapPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { quest: focusQuestId } = await searchParams;
  const config = getMapConfig(slug);

  // Статичная карта (наш собственный арт в /public): подложка с зумом/паном, БЕЗ маркеров,
  // слоёв и поиска. Не ходит в БД и не зависит от tarkov.dev-геометрии.
  if (config?.staticMap && config.svgFile) {
    // Ручные маркеры (редактор ?edit=1) — наши кураторские данные, не из tarkov.dev.
    const markers: MapViewMarker[] = getManualMarkers(slug).map((m) => ({
      id: m.id,
      type: m.type,
      position: { x: m.x, y: 0, z: m.z },
      outline: null,
      top: null,
      bottom: null,
      label: m.label ?? null,
      faction: m.faction ?? null,
      sides: null,
      categories: null,
      meta: null,
      floor: m.floor,
      category: m.category ?? null,
    }));
    const view: MapView = {
      slug,
      name: config.displayName ?? slug,
      imageUrl: `/images/maps/eft/${slug}.svg`,
      author: config.author,
      authorLink: config.authorLink,
      raidDuration: config.raid?.duration ?? null,
      players: config.raid?.players ?? null,
      minPlayerLevel: null,
      maxPlayerLevel: null,
      entryCost: config.raid?.entryCost ?? null,
      exitCost: config.raid?.exitCost ?? null,
      spawns: config.raid?.spawns ?? null,
      config,
      markers,
    };
    const navMaps = [...(await getEftInteractiveMapsWithNames()), ...getStaticMaps()];
    return (
      <main className="w-full px-4 pt-4 pb-8 xl:px-8">
        <MapFrame data={view} navMaps={navMaps} quests={[]} bosses={[]} questZones={[]} />
      </main>
    );
  }

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
          top: m.top ?? null,
          bottom: m.bottom ?? null,
          label: m.label ?? null,
          faction: m.faction ?? null,
          sides: m.sides ?? null,
          categories: m.categories ?? null,
          meta: m.meta ?? null,
        }));

      // Боссы — отдельным блоком статистики (position=null, на холсте не рисуются).
      const bosses: MapBossStat[] = data.markers
        .filter((m) => m.type === 'boss')
        .map((m) => {
          const meta = m.meta as { spawnChance?: number } | null;
          return {
            id: m.id,
            name: m.label ?? '—',
            spawnChance: typeof meta?.spawnChance === 'number' ? meta.spawnChance : null,
          };
        });

      // Зоны квестов (linkedQuestId) — для перелёта/подсветки по ?quest=id.
      const questZones: MapQuestZone[] = data.markers
        .filter((m) => m.type === 'quest_zone' && m.linkedQuestId)
        .map((m) => ({
          questId: m.linkedQuestId as string,
          position: m.position ? { x: m.position.x, z: m.position.z } : null,
          outline: (m.outline ?? []).map((p) => ({ x: p.x, z: p.z })),
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

      const navMaps = [...(await getEftInteractiveMapsWithNames()), ...getStaticMaps()];
      const quests = questsForMap(slug);

      return (
        <main className="w-full px-4 pt-4 pb-8 xl:px-8">
          <MapFrame
            data={view}
            navMaps={navMaps}
            quests={quests}
            bosses={bosses}
            questZones={questZones}
            focusQuestId={focusQuestId}
          />
        </main>
      );
    }
  }

  const placeholder = getSectionPlaceholder(`/eft/maps/${slug}`);
  if (!placeholder) notFound();
  return <SectionPlaceholder {...placeholder} />;
}
