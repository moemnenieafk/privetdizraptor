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
import type { SimilarItem } from './SimilarItems';

// === ТИПИЗАЦИЯ ===

interface TaskObjectiveRaw {
  __typename?: string;
  item?: { id: string };
  count?: number;
}

export interface UsedInTask {
  id: string;
  name: string;
  trader: { name: string; normalizedName: string };
  objectives: TaskObjectiveRaw[];
}

export interface RewardTask {
  id: string;
  name: string;
  trader: { name: string; normalizedName: string };
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
          vendor { name normalizedName }
        }
        usedInTasks {
          id
          name
          trader { name normalizedName }
          objectives {
            ... on TaskObjectiveItem { item { id } count }
          }
        }
        receivedFromTasks {
          id
          name
          trader { name normalizedName }
        }
        barters: bartersFor {
          id
          trader { name normalizedName }
          level
          requiredItems {
            item { id name shortName iconLink basePrice }
            count
          }
        }
        crafts: craftsFor {
          id
          station { name normalizedName }
          level
          duration
          requiredItems {
            item { id name shortName iconLink }
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

// === ПОХОЖИЕ ПРЕДМЕТЫ (та же BSG-категория) ===

interface SimilarItemRaw {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  basePrice: number;
  backgroundColor?: string;
  image512pxLink: string;
  sellFor?: { priceRUB?: number; price: number }[];
}

async function getSimilarItems(bsgCategoryId: string, excludeId: string): Promise<SimilarItem[]> {
  const query = `
    query {
      items(bsgCategoryId: "${bsgCategoryId}", lang: ru) {
        id
        normalizedName
        name
        shortName
        basePrice
        backgroundColor
        image512pxLink
        sellFor { priceRUB price }
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

    const json = await res.json() as { data?: { items: SimilarItemRaw[] }; errors?: unknown };
    if (json.errors) return [];

    return (json.data?.items ?? [])
      .filter((it) => it.id !== excludeId)
      .sort((a, b) => (b.basePrice ?? 0) - (a.basePrice ?? 0))
      .slice(0, 14)
      .map((it) => {
        const bestSell = it.sellFor?.length
          ? it.sellFor.reduce((max, curr) =>
              (curr.priceRUB ?? curr.price) > (max.priceRUB ?? max.price) ? curr : max
            )
          : null;
        return {
          id: it.id,
          normalizedName: it.normalizedName,
          name: it.name,
          shortName: it.shortName,
          image512pxLink: it.image512pxLink,
          backgroundColor: it.backgroundColor,
          bestSellPrice: bestSell ? (bestSell.priceRUB ?? bestSell.price) : 0,
        };
      });
  } catch {
    return [];
  }
}

// === СТРАНИЦА ===

export default async function ItemDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getItemData(slug);

  if (!item) notFound();

  const similar = item.bsgCategoryId
    ? await getSimilarItems(item.bsgCategoryId, item.id)
    : [];

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

        <ItemDetailLayout item={item} similar={similar} />

      </div>
    </main>
  );
}
