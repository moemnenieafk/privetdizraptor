import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { BreadcrumbsSetter } from '@/components/features/items/BreadcrumbsSetter';
import type {
  ItemProperties,
  VendorOffer,
  BarterOffer,
  CraftRecipe,
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
  usedInTasks?: UsedInTask[];
  receivedFromTasks?: RewardTask[];
}

// === GQL ===

async function getItemData(slug: string): Promise<TarkovItem | null> {
  const query = `
    query {
      item(normalizedName: "${slug}", lang: ru) {
        id
        normalizedName
        name
        shortName
        description
        types
        width
        height
        basePrice
        backgroundColor
        bsgCategoryId
        image512pxLink
        weight
        sellFor {
          price
          priceRUB
          vendor { name normalizedName }
        }
        buyFor {
          price
          priceRUB
          vendor {
            name
            normalizedName
            ... on TraderOffer { minTraderLevel }
          }
        }
        usedInTasks {
          id
          name
          taskImageLink
          kappaRequired
          minPlayerLevel
          trader { name normalizedName }
          objectives {
            ... on TaskObjectiveItem { item { id shortName image512pxLink } count }
          }
        }
        receivedFromTasks {
          id
          name
          taskImageLink
          kappaRequired
          minPlayerLevel
          trader { name normalizedName }
          finishRewards {
            items { item { id } count }
          }
        }
        barters: bartersFor {
          id
          trader { name normalizedName }
          level
          requiredItems {
            item { id name shortName image512pxLink basePrice backgroundColor }
            count
          }
        }
        crafts: craftsFor {
          id
          station { name normalizedName }
          level
          duration
          requiredItems {
            item { id name shortName image512pxLink backgroundColor }
            count
          }
        }
        properties {
          ... on ItemPropertiesWeapon {
            caliber
            fireRate
            ergonomics
            recoilVertical
            recoilHorizontal
          }
          ... on ItemPropertiesArmor {
            class
            durability
            speedPenalty
            turnPenalty
            ergoPenalty
            material { name }
          }
          ... on ItemPropertiesMedKit {
            hitpoints
            useTime
            maxHealPerUse
            cures
          }
          ... on ItemPropertiesMedicalItem {
            uses
            useTime
            cures
          }
          ... on ItemPropertiesContainer {
            grids { width height }
          }
          ... on ItemPropertiesAmmo {
            caliber
            damage
            penetrationPower
            armorDamage
            fragmentationChance
            initialSpeed
          }
          ... on ItemPropertiesGrenade {
            type
            fuse
            minExplosionDistance
            maxExplosionDistance
            fragments
          }
          ... on ItemPropertiesHeadphone {
            distanceModifier
            ambientVolume
          }
          ... on ItemPropertiesHelmet {
            class
            durability
            deafening
            headZones
            material { name }
            blocksHeadset
            speedPenalty
            turnPenalty
            ergoPenalty
          }
          ... on ItemPropertiesBackpack {
            grids { width height }
            speedPenalty
            turnPenalty
            ergoPenalty
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query }),
    next: { revalidate: 3600 },
  });

  const json = await res.json() as { data?: { item: TarkovItem } };
  return json.data?.item ?? null;
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

const SIM_PROPS_GQL = `
  __typename
  ... on ItemPropertiesArmor { class durability }
  ... on ItemPropertiesHelmet { class durability }
  ... on ItemPropertiesChestRig { class durability capacity }
  ... on ItemPropertiesGlasses { class durability }
  ... on ItemPropertiesBackpack { capacity }
  ... on ItemPropertiesContainer { capacity }
  ... on ItemPropertiesWeapon { ergonomics }
  ... on ItemPropertiesWeaponMod { ergonomics recoilModifier }
  ... on ItemPropertiesAmmo { damage penetrationPower }
  ... on ItemPropertiesMedKit { hitpoints }
  ... on ItemPropertiesMedicalItem { uses }
  ... on ItemPropertiesHeadphone { ambientVolume distanceModifier }
`;

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

async function getSimilarItems(bsgCategoryId: string, excludeId: string): Promise<EftItemData[]> {
  const query = `
    query {
      items(bsgCategoryId: "${bsgCategoryId}", lang: ru) {
        id
        normalizedName
        name
        shortName
        width
        height
        weight
        basePrice
        backgroundColor
        image512pxLink
        types
        properties { ${SIM_PROPS_GQL} }
        sellFor { price priceRUB currency vendor { name normalizedName } }
        buyFor  { price priceRUB currency vendor { name normalizedName } }
      }
    }
  `;

  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });

    const json = await res.json() as { data?: { items: SimItemRaw[] }; errors?: unknown };
    if (json.errors) return [];

    return (json.data?.items ?? [])
      .filter((it) => it.id !== excludeId)
      .sort((a, b) => (b.basePrice ?? 0) - (a.basePrice ?? 0))
      .slice(0, 8)
      .map(toSimilarEftItem);
  } catch {
    return [];
  }
}

// === ТРЕБУЕМЫЙ УРОВЕНЬ ИГРОКА (loyalty → requiredPlayerLevel) ===

type TraderLevelMap = Record<string, Record<number, number>>;

async function getTraderLevels(): Promise<TraderLevelMap> {
  const query = `query { traders(lang: ru) { normalizedName levels { level requiredPlayerLevel } } }`;
  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 },
    });
    const json = await res.json() as {
      data?: { traders: { normalizedName: string; levels: { level: number; requiredPlayerLevel: number }[] }[] };
    };
    const map: TraderLevelMap = {};
    for (const t of json.data?.traders ?? []) {
      map[t.normalizedName] = {};
      for (const lvl of t.levels) map[t.normalizedName][lvl.level] = lvl.requiredPlayerLevel;
    }
    return map;
  } catch {
    return {};
  }
}

// === СТРАНИЦА ===

export default async function ItemDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getItemData(slug);

  if (!item) notFound();

  const [similar, traderLevels] = await Promise.all([
    item.bsgCategoryId ? getSimilarItems(item.bsgCategoryId, item.id) : Promise.resolve([] as EftItemData[]),
    getTraderLevels(),
  ]);

  // Требуемый уровень ЧВК для лучшей покупки у торговца (гексагон на ячейке покупки)
  const traderBuys = (item.buyFor ?? []).filter((b) => b.vendor.normalizedName !== 'flea-market');
  const bestTraderBuy = traderBuys.length
    ? traderBuys.reduce((min, c) => ((c.priceRUB ?? c.price) < (min.priceRUB ?? min.price) ? c : min))
    : null;
  const buyLevelRequired =
    bestTraderBuy?.vendor.minTraderLevel != null
      ? traderLevels[bestTraderBuy.vendor.normalizedName]?.[bestTraderBuy.vendor.minTraderLevel] ?? null
      : null;

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in-up_0.5s_ease-out_both]">
      <BreadcrumbsSetter name={item.name} types={item.types} />
      <div className="w-full max-w-275 px-4 mx-auto xl:px-0">

        <div className="mb-6">
          <Link
            href="/eft/items"
            className="inline-flex items-center text-xs uppercase tracking-widest font-blender-medium text-text-muted hover:text-(--primary) transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> База предметов
          </Link>
        </div>

        <ItemDetailLayout item={item} similar={similar} buyLevelRequired={buyLevelRequired} />

      </div>
    </main>
  );
}
