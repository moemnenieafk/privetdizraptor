import { notFound } from 'next/navigation';
import { SectionPlaceholder } from '@/components/ui/SectionPlaceholder';
import { getSectionPlaceholder } from '@/lib/section-nav';
import { getEftMapData, getEftInteractiveMapsWithNames } from '@/db/maps';
import { getEftPriceIndex } from '@/db/prices';
import { getEftCatalog } from '@/lib/eft-catalog';
import { bossIconUrl, bossPortraitKey, GOONS_FILES } from '@/data/map-marker-icons';
import { getMapConfig, getStaticMaps } from '@/data/eft-map-config';
import { getManualMarkers } from '@/data/map-markers';
import { classifyLoot15 } from '@/data/map-markers/loot-15';
import { mapImageUrl } from '@/lib/map-image';
import { MapFrame } from '@/components/features/maps/MapFrame';
import { getEditorialMarkers } from '@/db/editorial-markers';
import { getCmsUser } from '@/lib/auth/admin';
import { EFT_QUESTS } from '@/data/quests';
import { STORY_WALKTHROUGHS } from '@/data/story-walkthroughs';
import { questsForMap, questTasksForMap } from '@/lib/map-quests';
import type { EditorialMarkerData } from '@/components/features/maps/EditorialMarkerCard';
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

// Порог прореживания: макс. обычных PMC/Scav-спавнов на зону (боссы/свита/снайпер/rogue не режутся).
const SPAWN_CAP_PER_ZONE = 2;

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
    // Прайс-индекс нужен только если есть маркеры с привязкой к предмету (иконка-плитка + линк).
    const priceIndex = manual.some((m) => m.linkedItemId) ? await getEftPriceIndex() : null;
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
      bossKey: m.bossKey ?? null,
      linkedItemId: m.linkedItemId ?? null,
      itemBg: m.linkedItemId ? (priceIndex?.get(m.linkedItemId)?.backgroundColor ?? null) : null,
      itemSlug: m.linkedItemId ? (priceIndex?.get(m.linkedItemId)?.normalizedName ?? null) : null,
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
      <main className="w-full">
        <MapFrame data={view} navMaps={navMaps} quests={[]} questTasks={[]} bosses={[]} questZones={questZones} focusQuestId={focusQuestId} />
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

      // Зона спавна (zoneName == spawn.label) → фракция по владельцу-боссу: rogue (Маяк),
      // black-division (Терминал) рисуются своей иконкой спавна вместо generic boss-add.
      const BOSS_SPAWN_FACTION: Record<string, 'rogue' | 'black-division'> = {
        rogue: 'rogue',
        'black-div': 'black-division',
      };
      const zoneFaction = new Map<string, 'rogue' | 'black-division'>();
      // Зона → basename портрета «настоящего» босса (не rogue/black-division фракции).
      const zoneBoss = new Map<string, string>();
      for (const m of data.markers) {
        if (m.type !== 'boss') continue;
        const bm = m.meta as { bossNormalizedName?: string; spawnLocations?: { spawnKey?: string }[] } | null;
        const nn = bm?.bossNormalizedName ?? undefined;
        const fac = nn ? BOSS_SPAWN_FACTION[nn] : undefined;
        if (fac) {
          for (const loc of bm?.spawnLocations ?? []) if (loc.spawnKey) zoneFaction.set(loc.spawnKey, fac);
          continue;
        }
        const key = bossPortraitKey(nn);
        if (!key) continue;
        for (const loc of bm?.spawnLocations ?? []) if (loc.spawnKey) zoneBoss.set(loc.spawnKey, key);
      }

      // Один портрет-маркер на зону (первый boss-спавн зоны) → webp; прочие boss-точки = свита (boss-add).
      // Скопления Диких/ЧВК режем до SPAWN_CAP_PER_ZONE на зону (боссы/свита/снайпер/rogue не режем).
      const bossPortraitOf = new Map<string, string>();
      const portraitZoneUsed = new Set<string>();
      const dropSpawn = new Set<string>();
      const spawnCount = new Map<string, number>();
      for (const m of data.markers) {
        if (m.type !== 'spawn' || !m.position) continue;
        const zone = m.label ?? '';
        const cats = m.categories ?? [];
        if (cats.includes('boss')) {
          const key = zoneBoss.get(zone);
          if (key && !portraitZoneUsed.has(zone)) {
            bossPortraitOf.set(m.id, key);
            portraitZoneUsed.add(zone);
          }
          continue;
        }
        if (cats.includes('sniper') || zoneFaction.has(zone)) continue;
        const side = (m.sides ?? [])[0]?.toLowerCase();
        const kind = side === 'pmc' || side === 'botpmc' ? 'pmc' : 'scav';
        const n = (spawnCount.get(`${kind}|${zone}`) ?? 0) + 1;
        spawnCount.set(`${kind}|${zone}`, n);
        if (n > SPAWN_CAP_PER_ZONE) dropSpawn.add(m.id);
      }

      const goonsKeys = new Set<string>(GOONS_FILES);
      const markers: MapViewMarker[] = data.markers
        .filter((m) => RENDER_TYPES.has(m.type) && m.position && !dropSpawn.has(m.id))
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
          spawnFaction: m.type === 'spawn' && m.label ? (zoneFaction.get(m.label) ?? null) : null,
          bossKey: bossPortraitOf.get(m.id) ?? null,
          category: goonsKeys.has(bossPortraitOf.get(m.id) ?? '') ? 'goons' : null,
          itemBg: m.type === 'loot_loose' && m.linkedItemId ? (priceIndex.get(m.linkedItemId)?.backgroundColor ?? null) : null,
          itemSlug: m.type === 'loot_loose' && m.linkedItemId ? (priceIndex.get(m.linkedItemId)?.normalizedName ?? null) : null,
          lootCat:
            m.type === 'loot_loose' && m.linkedItemId
              ? classifyLoot15(lootCatById.get(m.linkedItemId), priceIndex.get(m.linkedItemId)?.bsgCategoryId)
              : null,
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
      const questTasks = questTasksForMap(slug);

      // Редакторские маркеры (editorial_markers) + разрешение привязки к квесту для карточки.
      // canEditMarkers — admin/editor (сервер): показывает кнопку правки; запись защищает API.
      const cms = await getCmsUser();
      const canEditMarkers = cms !== null;
      // Лёгкий индекс квестов для автокомплита привязки — ТОЛЬКО редакторам (не грузим всем).
      const questIndex = canEditMarkers
        ? EFT_QUESTS.map((t) => ({ id: t.id, name: t.name, trader: t.trader.normalizedName }))
        : undefined;
      const storyIndex = canEditMarkers
        ? Object.values(STORY_WALKTHROUGHS).map((s) => ({ slug: s.slug, title: s.title }))
        : undefined;
      const editorialRows = await getEditorialMarkers(data.asset.mapId);
      const questById = new Map(EFT_QUESTS.map((t) => [t.id, t]));
      // Название истории — для индикатора привязки в карточке (всем, не только редакторам).
      const storyTitle = new Map(Object.values(STORY_WALKTHROUGHS).map((s) => [s.slug, s.title]));
      const editorialMarkers: EditorialMarkerData[] = editorialRows.map((r) => {
        const q = r.linkKind === 'quest' && r.linkId ? questById.get(r.linkId) : undefined;
        return {
          id: r.id,
          mapId: r.mapId,
          x: r.x,
          z: r.z,
          y: r.y,
          floor: r.floor,
          type: r.type,
          category: r.category,
          title: r.title,
          description: r.description,
          screenshots: r.screenshots ?? [],
          linkKind: r.linkKind,
          linkId: r.linkId,
          linkStep: r.linkStep,
          linkedQuest: q
            ? {
                name: q.name,
                traderNn: q.trader.normalizedName,
                minPlayerLevel: q.minPlayerLevel,
                kappaRequired: q.kappaRequired,
                lightkeeperRequired: q.lightkeeperRequired,
              }
            : null,
          linkedStory: r.linkKind === 'story' && r.linkId ? { title: storyTitle.get(r.linkId) ?? r.linkId } : null,
        };
      });

      return (
        <main className="w-full">
          <MapFrame
            data={view}
            navMaps={navMaps}
            quests={quests}
            questTasks={questTasks}
            bosses={bosses}
            questZones={questZones}
            editorialMarkers={editorialMarkers}
            canEditMarkers={canEditMarkers}
            mapId={data.asset.mapId}
            questIndex={questIndex}
            storyIndex={storyIndex}
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
