import { notFound } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { items, itemProperties, prices, barters, crafts } from '@/db/schema';
import { eftGameId } from '@/db/eft';
import { getEftPriceMapFromDb } from '@/db/prices';
import { itemIconUrl } from '@/lib/item-icon';
import { EFT_QUESTS } from '@/data/quests';
import { BreadcrumbsSetter } from '@/components/features/items/BreadcrumbsSetter';
import { CatalogBackLink } from './CatalogBackLink';
import type {
  ItemProperties,
  VendorOffer,
  BarterOffer,
  CraftRecipe,
  UsedInBarter,
  UsedInCraft,
} from './ItemModules';
import { ItemDetailLayout } from './ItemDetailLayout';
import { getDynamicTopIndicator } from '@/lib/item-indicators.util';
import type { EftItemData, EftPriceEntry } from '@/components/features/items/EftItemTile';
import type { EftCurrency } from '@/lib/formatters';

// === ТИПИЗАЦИЯ ===

interface TaskObjectiveRaw {
  __typename?: string;
  item?: { id: string; shortName?: string; image512pxLink?: string };
  count?: number;
}

export interface UsedInTask {
  id: string;
  name: string;
  taskImageLink?: string;
  kappaRequired?: boolean;
  minPlayerLevel?: number;
  trader: { name: string; normalizedName: string };
  objectives: TaskObjectiveRaw[];
}

export interface RewardTask {
  id: string;
  name: string;
  taskImageLink?: string;
  kappaRequired?: boolean;
  minPlayerLevel?: number;
  trader: { name: string; normalizedName: string };
  finishRewards?: { items: { item?: { id: string }; count: number }[] };
}

export interface TarkovItem {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  description: string;
  types: string[];
  width: number;
  height: number;
  weight?: number;
  basePrice: number;
  backgroundColor?: string;
  bsgCategoryId?: string;
  image512pxLink: string;
  properties: ItemProperties;
  sellFor: VendorOffer[];
  buyFor?: VendorOffer[];
  barters: BarterOffer[];
  crafts: CraftRecipe[];
  usedInBarters?: UsedInBarter[];
  usedInCrafts?: UsedInCraft[];
  usedInTasks?: UsedInTask[];
  receivedFromTasks?: RewardTask[];
}

// === Маппинг сырых свойств (properties_raw, tarkov.dev-форма) → форма ItemModules ===
// Строим по __typename → точная форма (type-guard'ы ItemModules различают по полям).
function mapDetailProperties(raw: Record<string, unknown> | null | undefined): ItemProperties {
  if (!raw) return null;
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const s = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
  const b = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
  const sa = (v: unknown): string[] | null =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  const mat = (v: unknown): { name: string } | null =>
    v && typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string'
      ? { name: (v as { name: string }).name }
      : null;
  const grids = (v: unknown): { width: number; height: number }[] =>
    Array.isArray(v)
      ? v.map((g) => ({ width: Number((g as { width?: unknown })?.width) || 0, height: Number((g as { height?: unknown })?.height) || 0 }))
      : [];

  switch (raw.__typename) {
    case 'ItemPropertiesWeapon':
      return { caliber: s(raw.caliber), fireRate: n(raw.fireRate), ergonomics: n(raw.ergonomics), recoilVertical: n(raw.recoilVertical), recoilHorizontal: n(raw.recoilHorizontal) };
    case 'ItemPropertiesArmor':
    case 'ItemPropertiesChestRig':
    case 'ItemPropertiesArmorAttachment':
      return { class: n(raw.class) ?? 0, durability: n(raw.durability) ?? 0, speedPenalty: n(raw.speedPenalty), turnPenalty: n(raw.turnPenalty), ergoPenalty: n(raw.ergoPenalty), material: mat(raw.material) };
    case 'ItemPropertiesHelmet':
      return { class: n(raw.class) ?? 0, durability: n(raw.durability) ?? 0, deafening: s(raw.deafening), headZones: sa(raw.headZones), material: mat(raw.material), blocksHeadset: b(raw.blocksHeadset), speedPenalty: n(raw.speedPenalty), turnPenalty: n(raw.turnPenalty), ergoPenalty: n(raw.ergoPenalty) };
    case 'ItemPropertiesMedKit':
      return { hitpoints: n(raw.hitpoints) ?? 0, useTime: n(raw.useTime) ?? 0, maxHealPerUse: n(raw.maxHealPerUse), cures: sa(raw.cures) };
    case 'ItemPropertiesMedicalItem':
    case 'ItemPropertiesPainkiller':
    case 'ItemPropertiesStim':
      return { uses: n(raw.uses), useTime: n(raw.useTime) ?? 0, cures: sa(raw.cures) };
    case 'ItemPropertiesContainer':
      return { grids: grids(raw.grids) };
    case 'ItemPropertiesBackpack':
      return { grids: grids(raw.grids), speedPenalty: n(raw.speedPenalty), turnPenalty: n(raw.turnPenalty), ergoPenalty: n(raw.ergoPenalty) };
    case 'ItemPropertiesAmmo':
      return { caliber: s(raw.caliber), damage: n(raw.damage), penetrationPower: n(raw.penetrationPower), armorDamage: n(raw.armorDamage), fragmentationChance: n(raw.fragmentationChance), initialSpeed: n(raw.initialSpeed) };
    case 'ItemPropertiesGrenade':
      return { type: s(raw.type), fuse: n(raw.fuse), minExplosionDistance: n(raw.minExplosionDistance), maxExplosionDistance: n(raw.maxExplosionDistance), fragments: n(raw.fragments) };
    case 'ItemPropertiesHeadphone':
      return { distanceModifier: n(raw.distanceModifier), ambientVolume: n(raw.ambientVolume) };
    default:
      return null;
  }
}

// === ПОХОЖИЕ ПРЕДМЕТЫ (та же BSG-категория) → EftItemData для EftItemTile ===

interface SimVendorRaw {
  price: number;
  priceRUB?: number;
  currency?: string;
  vendor: { name: string; normalizedName: string };
}
interface SimItemRaw {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  width: number;
  height: number;
  weight?: number;
  basePrice: number;
  backgroundColor?: string;
  image512pxLink: string;
  types: string[];
  properties?: {
    __typename?: string;
    class?: number | null;
    durability?: number | null;
    capacity?: number | null;
    ergonomics?: number | null;
    recoilModifier?: number | null;
    damage?: number | null;
    penetrationPower?: number | null;
    hitpoints?: number | null;
    uses?: number | null;
    ambientVolume?: number | null;
    distanceModifier?: number | null;
  };
  sellFor?: SimVendorRaw[];
  buyFor?: SimVendorRaw[];
}

const simRubVal = (o: SimVendorRaw) => o.priceRUB ?? o.price;
const simIsFlea = (v: { name: string; normalizedName?: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

function toSimilarEftItem(it: SimItemRaw): EftItemData {
  const p = it.properties ?? {};
  const buys = (it.buyFor ?? []).filter((b) => simRubVal(b) > 0);
  const sells = it.sellFor ?? [];
  const traderBuys = buys.filter((b) => !simIsFlea(b.vendor));
  const traderBuy = traderBuys.length ? traderBuys.reduce((m, c) => (simRubVal(c) < simRubVal(m) ? c : m)) : undefined;
  const fleaBuy = buys.find((b) => simIsFlea(b.vendor));
  const traderSells = sells.filter((s) => !simIsFlea(s.vendor) && simRubVal(s) > 0);
  const traderSell = traderSells.length ? traderSells.reduce((m, c) => (simRubVal(c) > simRubVal(m) ? c : m)) : undefined;
  const fleaSell = sells.find((s) => simIsFlea(s.vendor));
  const entry = (o?: SimVendorRaw): EftPriceEntry | undefined =>
    o ? { price: o.price, priceRUB: o.priceRUB, currency: o.currency as EftCurrency | undefined, vendor: o.vendor } : undefined;

  const dmg = Number(p.damage ?? 0);
  const pen = Number(p.penetrationPower ?? 0);

  return {
    id: it.id,
    normalizedName: it.normalizedName,
    name: it.name,
    shortName: it.shortName,
    width: it.width,
    height: it.height,
    backgroundColor: it.backgroundColor,
    image512pxLink: it.image512pxLink,
    armorClass: typeof p.class === 'number' ? p.class : undefined,
    ammoOverlay: dmg > 0 || pen > 0 ? { damage: dmg, penetration: pen } : undefined,
    topStat: getDynamicTopIndicator({ types: it.types, name: it.name, weight: it.weight ?? null, properties: p }, ''),
    pricing: {
      traderBuy: entry(traderBuy),
      fleaBuy: entry(fleaBuy),
      traderSell: entry(traderSell),
      fleaSell: entry(fleaSell),
    },
  };
}

// === Сборка карточки предмета ИЗ НАШЕЙ БД (замена tarkov.dev) ===

interface DetailData {
  item: TarkovItem;
  similar: EftItemData[];
}

async function getEftItemDetail(slug: string): Promise<DetailData | null> {
  const gameId = await eftGameId();
  const priceMap = await getEftPriceMapFromDb();

  // slug = normalizedName → inGameId
  let mainId: string | undefined;
  for (const [id, p] of priceMap) {
    if (p.normalizedName === slug) { mainId = id; break; }
  }
  if (!mainId) return null;
  const px = priceMap.get(mainId)!;

  const [base] = await db
    .select({
      name: items.name, shortName: items.shortName, description: items.description,
      weight: items.weight, width: items.gridWidth, height: items.gridHeight,
      basePrice: items.basePrice, propertiesRaw: itemProperties.propertiesRaw,
    })
    .from(items)
    .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
    .where(and(eq(items.gameId, gameId), eq(items.inGameId, mainId)));
  if (!base) return null;

  // Справочник имён/цен/размеров всех предметов (для слотов бартеров/крафтов и похожих)
  const allItems = await db
    .select({ inGameId: items.inGameId, name: items.name, shortName: items.shortName, basePrice: items.basePrice, weight: items.weight, width: items.gridWidth, height: items.gridHeight })
    .from(items)
    .where(eq(items.gameId, gameId));
  const itemInfo = new Map(allItems.map((r) => [r.inGameId, r]));

  // Бартеры/крафты, ПРОИЗВОДЯЩИЕ этот предмет
  const [barterRows, craftRows] = await Promise.all([
    db.select().from(barters).where(eq(barters.gameId, gameId)),
    db.select().from(crafts).where(eq(crafts.gameId, gameId)),
  ]);
  const slotItem = (id: string) => {
    const i = itemInfo.get(id);
    return {
      id, name: i?.name ?? id, shortName: i?.shortName ?? '', image512pxLink: itemIconUrl(id),
      basePrice: i?.basePrice ?? 0, backgroundColor: priceMap.get(id)?.backgroundColor,
      normalizedName: priceMap.get(id)?.normalizedName ?? undefined, // для кросс-линка на карточку
    };
  };
  const barterTaskUnlock = (b: { taskUnlockId: string | null; taskUnlockName: string | null }) =>
    b.taskUnlockId ? { id: b.taskUnlockId, name: b.taskUnlockName ?? undefined } : null;

  // Предметы, которые можно получить по бартеру (для подсказки на ингредиентах крафта).
  const barterableIds = new Set(barterRows.flatMap((b) => b.rewardItems.map((s) => s.itemId)));

  // Бартеры/крафты, ПРОИЗВОДЯЩИЕ предмет (предмет в reward).
  const itemBarters: BarterOffer[] = barterRows
    .filter((b) => b.rewardItems.some((sl) => sl.itemId === mainId))
    .map((b) => ({
      id: b.id,
      trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? '' },
      level: b.level ?? 1,
      taskUnlock: barterTaskUnlock(b),
      requiredItems: b.requiredItems.map((sl) => ({ item: slotItem(sl.itemId), count: sl.count })),
    }));
  const itemCrafts: CraftRecipe[] = craftRows
    .filter((c) => c.rewardItems.some((sl) => sl.itemId === mainId))
    .map((c) => ({
      id: c.id,
      station: { name: c.stationName, normalizedName: c.stationNormalizedName ?? '' },
      level: c.level ?? 1,
      duration: c.duration ?? 0,
      requiredItems: c.requiredItems.map((sl) => ({
        item: { ...slotItem(sl.itemId), hasBarter: barterableIds.has(sl.itemId) },
        count: sl.count,
      })),
    }));

  // ОБРАТНОЕ направление: бартеры/крафты, где предмет — ИНГРЕДИЕНТ (предмет в required).
  const usedInBarters: UsedInBarter[] = barterRows
    .filter((b) => b.requiredItems.some((sl) => sl.itemId === mainId))
    .map((b) => ({
      id: b.id,
      trader: { name: b.traderName, normalizedName: b.traderNormalizedName ?? '' },
      level: b.level ?? 1,
      taskUnlock: barterTaskUnlock(b),
      usedCount: b.requiredItems.find((sl) => sl.itemId === mainId)?.count ?? 1,
      rewardItems: b.rewardItems.map((sl) => ({ item: slotItem(sl.itemId), count: sl.count })),
    }));
  const usedInCrafts: UsedInCraft[] = craftRows
    .filter((c) => c.requiredItems.some((sl) => sl.itemId === mainId))
    .map((c) => ({
      id: c.id,
      station: { name: c.stationName, normalizedName: c.stationNormalizedName ?? '' },
      level: c.level ?? 1,
      duration: c.duration ?? 0,
      usedCount: c.requiredItems.find((sl) => sl.itemId === mainId)?.count ?? 1,
      rewardItems: c.rewardItems.map((sl) => ({ item: slotItem(sl.itemId), count: sl.count })),
    }));

  // Квесты: где предмет требуется / где выдаётся в награду (из статического EFT_QUESTS)
  const usedInTasks: UsedInTask[] = [];
  const receivedFromTasks: RewardTask[] = [];
  for (const t of EFT_QUESTS) {
    const objs = t.objectives.filter((o) => o.__typename === 'TaskObjectiveItem' && o.item?.id === mainId);
    if (objs.length) {
      usedInTasks.push({
        id: t.id, name: t.name, taskImageLink: t.trader.imageLink, kappaRequired: t.kappaRequired, minPlayerLevel: t.minPlayerLevel,
        trader: { name: t.trader.name, normalizedName: t.trader.normalizedName },
        objectives: objs.map((o) => ({ __typename: o.__typename, item: o.item ? { id: o.item.id, shortName: o.item.shortName, image512pxLink: o.item.image512pxLink } : undefined, count: o.count })),
      });
    }
    if (t.finishRewards?.items?.some((r) => r.item?.id === mainId)) {
      receivedFromTasks.push({
        id: t.id, name: t.name, taskImageLink: t.trader.imageLink, kappaRequired: t.kappaRequired, minPlayerLevel: t.minPlayerLevel,
        trader: { name: t.trader.name, normalizedName: t.trader.normalizedName },
        finishRewards: { items: t.finishRewards.items.map((r) => ({ item: { id: r.item.id }, count: r.count })) },
      });
    }
  }

  const toVendor = (o: { price: number; priceRUB?: number; vendor: { name: string; normalizedName?: string } }): VendorOffer => ({
    price: o.price, priceRUB: o.priceRUB, vendor: { name: o.vendor.name, normalizedName: o.vendor.normalizedName ?? '' },
  });

  const item: TarkovItem = {
    id: mainId,
    normalizedName: px.normalizedName || slug,
    name: base.name,
    shortName: base.shortName ?? '',
    description: base.description ?? '',
    types: px.types ?? [],
    width: base.width ?? 1,
    height: base.height ?? 1,
    weight: base.weight ?? undefined,
    basePrice: base.basePrice ?? 0,
    backgroundColor: px.backgroundColor,
    bsgCategoryId: px.bsgCategoryId,
    image512pxLink: itemIconUrl(mainId),
    properties: mapDetailProperties(base.propertiesRaw),
    sellFor: (px.sellFor ?? []).map(toVendor),
    buyFor: (px.buyFor ?? []).map(toVendor),
    barters: itemBarters,
    crafts: itemCrafts,
    usedInBarters,
    usedInCrafts,
    usedInTasks,
    receivedFromTasks,
  };

  // Похожие предметы (та же BSG-категория)
  let similar: EftItemData[] = [];
  if (px.bsgCategoryId) {
    const simIds = [...priceMap.entries()]
      .filter(([id, p]) => p.bsgCategoryId === px.bsgCategoryId && id !== mainId)
      .map(([id]) => id);
    if (simIds.length) {
      const propRows = await db
        .select({ inGameId: items.inGameId, propertiesRaw: itemProperties.propertiesRaw })
        .from(items)
        .leftJoin(itemProperties, eq(itemProperties.itemId, items.id))
        .where(and(eq(items.gameId, gameId), inArray(items.inGameId, simIds)));
      const propsById = new Map(propRows.map((r) => [r.inGameId, r.propertiesRaw]));
      const sims: SimItemRaw[] = simIds
        .map((id) => {
          const p = priceMap.get(id)!;
          const i = itemInfo.get(id);
          return {
            id,
            normalizedName: p.normalizedName,
            name: i?.name ?? id,
            shortName: i?.shortName ?? '',
            width: i?.width ?? 1,
            height: i?.height ?? 1,
            weight: i?.weight ?? undefined,
            basePrice: i?.basePrice ?? 0,
            backgroundColor: p.backgroundColor,
            image512pxLink: itemIconUrl(id),
            types: p.types ?? [],
            properties: (propsById.get(id) ?? undefined) as SimItemRaw['properties'],
            sellFor: p.sellFor as SimVendorRaw[],
            buyFor: p.buyFor as SimVendorRaw[],
          };
        })
        .sort((a, b) => b.basePrice - a.basePrice)
        .slice(0, 8);
      similar = sims.map(toSimilarEftItem);
    }
  }

  return { item, similar };
}

// === СТРАНИЦА ===

export default async function ItemDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getEftItemDetail(slug);
  if (!data) notFound();

  const { item, similar } = data;
  // Требуемый уровень торговца у нас не зеркалится → гексагон уровня не показываем.
  const buyLevelRequired = null;

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in-up_0.5s_ease-out_both]">
      <BreadcrumbsSetter name={item.name} types={item.types} />
      <div className="w-full max-w-275 px-4 mx-auto xl:px-0">

        <div className="mb-6">
          <CatalogBackLink focusId={item.id} />
        </div>

        <ItemDetailLayout item={item} similar={similar} buyLevelRequired={buyLevelRequired} />

      </div>
    </main>
  );
}
