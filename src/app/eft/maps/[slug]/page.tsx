import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getEftMapData, getEftInteractiveMapsWithNames } from '@/db/maps';
import { getEftPriceIndex } from '@/db/prices';
import { getEftCatalog } from '@/lib/eft-catalog';
import { bossIconUrl } from '@/data/map-marker-icons';
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

// Рендерим все позиционированные типы маркеров (слои включаются в drawer'е «Слои»).
// boss — position=null (спавн по зоне) → не на холст, отдельным блоком статистики.
const RENDER_TYPES = new Set([
  'extract',
  'spawn',
  'transit',
  'hazard',
  'lock',
  'switch',
  'loot_container',
  'loot_loose',
  'stationary_weapon',
  'quest_zone',
]);

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
    const manual = getManualMarkers(slug);
    const markers: MapViewMarker[] = manual.map((m) => ({
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
      questId: m.questId ?? null,
      objectiveId: m.objectiveId ?? null,
    }));
    // Quest-маркеры → зоны для deep-link ?quest= (перелёт к цели квеста на карте).
    const questZones: MapQuestZone[] = manual
      .filter((m) => m.type === 'quest' && m.questId)
      .map((m) => ({ questId: m.questId as string, position: { x: m.x, z: m.z }, outline: [] }));
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
        <MapFrame data={view} navMaps={navMaps} quests={[]} bosses={[]} questZones={questZones} focusQuestId={focusQuestId} />
      </main>
    );
  }

  if (config?.svgFile && config.transform) {
    const data = await getEftMapData(slug);
    if (data?.asset.imageKey) {
      // Прайс-индекс — тарковский цвет фона слота предмета (для плиток loose loot);
      // каталог — slug категории предмета (для под-слоёв «Случайной добычи»).
      const [priceIndex, catalog] = await Promise.all([getEftPriceIndex(), getEftCatalog()]);
      const lootCatById = new Map(catalog.map((i) => [i.id, i.category]));
      const markers: MapViewMarker[] = data.markers
        .filter((m) => RENDER_TYPES.has(m.type) && m.position)
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
          linkedItemId: m.linkedItemId ?? null,
          itemBg: m.type === 'loot_loose' && m.linkedItemId ? (priceIndex.get(m.linkedItemId)?.backgroundColor ?? null) : null,
          lootCat: m.type === 'loot_loose' && m.linkedItemId ? (lootCatById.get(m.linkedItemId) ?? 'other') : null,
          transferItemName:
            m.type === 'extract'
              ? ((m.meta as { transferItem?: { name?: string } } | null)?.transferItem?.name ?? null)
              : null,
          meta: m.meta ?? null,
        }));

      // Боссы — отдельным блоком статистики (position=null, на холсте не рисуются).
      // Зоны спавнов: zoneName (label спавн-маркера) → точки. Босс.spawnLocations[].spawnKey
      // совпадает с zoneName → резолвим возможные спавны босса для подлёта по клику.
      const spawnZonePos = new Map<string, { x: number; z: number }[]>();
      for (const m of data.markers) {
        if (m.type !== 'spawn' || !m.position || !m.label) continue;
        const arr = spawnZonePos.get(m.label) ?? [];
        arr.push({ x: m.position.x, z: m.position.z });
        spawnZonePos.set(m.label, arr);
      }

      const bosses: MapBossStat[] = data.markers
        .filter((m) => m.type === 'boss')
        .map((m) => {
          const meta = m.meta as
            | { spawnChance?: number; bossNormalizedName?: string; spawnLocations?: { spawnKey?: string }[] }
            | null;
          const spawns = (meta?.spawnLocations ?? []).flatMap((loc) =>
            loc.spawnKey ? (spawnZonePos.get(loc.spawnKey) ?? []) : [],
          );
          return {
            id: m.id,
            name: m.label ?? '—',
            spawnChance: typeof meta?.spawnChance === 'number' ? meta.spawnChance : null,
            icon: bossIconUrl(meta?.bossNormalizedName),
            spawns,
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
