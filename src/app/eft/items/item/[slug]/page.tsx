import { notFound } from 'next/navigation';
import { Info, Banknote, ArrowLeft } from 'lucide-react';
import { BreadcrumbsSetter } from '@/components/features/items/BreadcrumbsSetter';
import { Badge, MetricCard, SectionPanel } from '@/components/ui/kit';
import {
  WeaponModule,
  ArmorModule,
  MedKitModule,
  MedicalItemModule,
  ContainerModule,
  AmmoModule,
  GrenadeModule,
  HeadsetModule,
  HelmetModule,
  BackpackModule,
  TraderModule,
  BarterModule,
  CraftModule,
  type ItemProperties,
  type VendorOffer,
  type BarterOffer,
  type CraftRecipe,
} from './ItemModules';
import { ItemImage } from './ItemImage';
import Link from 'next/link';
import { formatCompactNumber } from '@/lib/formatters';
import { Tooltip } from '@/components/ui/Tooltip';

// === ТИПИЗАЦИЯ ===

interface TarkovItem {
  id: string;
  normalizedName: string;
  name: string;
  shortName: string;
  description: string;
  types: string[];
  width: number;
  height: number;
  basePrice: number;
  image512pxLink: string;
  properties: ItemProperties;
  sellFor: VendorOffer[];
  buyFor?: VendorOffer[];
  barters: BarterOffer[];
  crafts: CraftRecipe[];
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
        image512pxLink
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

// === СТРАНИЦА ===

export default async function ItemDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getItemData(slug);

  if (!item) notFound();

  const slots = item.width * item.height;
  const bestSell = item.sellFor?.length
    ? item.sellFor.reduce((max, curr) => (curr.price > max.price ? curr : max))
    : { price: 0, vendor: { name: 'Неизвестно', normalizedName: 'unknown' } };
  const vps = slots > 0 ? Math.floor(bestSell.price / slots) : 0;

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

        <div className="mb-6 pb-6 border-b border-lines-hover">
          <h1 className="mb-2 text-3xl uppercase leading-none tracking-widest font-blender-medium text-text-primary lg:text-4xl">
            {item.name}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">{item.shortName}</Badge>
            {item.types.map((type) => (
              <Badge key={type} variant="default">{type}</Badge>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="relative flex min-h-75 items-center justify-center overflow-hidden rounded border border-lines-hover bg-card-menu p-4 group">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,var(--color-text-muted)_1px,transparent_1px)] bg-size-[20px_20px]" />
              <ItemImage
                id={item.id}
                image512pxLink={item.image512pxLink}
                name={item.name}
                className="z-10 w-64 h-64 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            <WeaponModule properties={item.properties} />
            <ArmorModule properties={item.properties} />
            <MedKitModule properties={item.properties} />
            <MedicalItemModule properties={item.properties} />
            <ContainerModule properties={item.properties} itemWidth={item.width} itemHeight={item.height} />
            <AmmoModule properties={item.properties} />
            <GrenadeModule properties={item.properties} />
            <HeadsetModule properties={item.properties} />
            <HelmetModule properties={item.properties} />
            <BackpackModule properties={item.properties} itemWidth={item.width} itemHeight={item.height} />
          </div>

          <div className="flex flex-col gap-6 lg:col-span-8">

            <SectionPanel title="Тактическая Экономика" icon={<Banknote className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Tooltip content={`${item.basePrice.toLocaleString('ru-RU')} ₽`} className="block w-full cursor-help">
                  <MetricCard label="Базовая цена" value={`${formatCompactNumber(item.basePrice)} ₽`} />
                </Tooltip>
                <Tooltip content={`${bestSell.price.toLocaleString('ru-RU')} ₽`} className="block w-full cursor-help">
                  <MetricCard
                    label="Лучшая продажа"
                    value={`${formatCompactNumber(bestSell.price)} ₽`}
                    subtext={bestSell.vendor.name}
                    accent="primary"
                  />
                </Tooltip>
                <MetricCard
                  label="Размер (Слоты)"
                  value={`${item.width}x${item.height}`}
                  subtext={`${slots} ячеек`}
                  accent="default"
                />
                <Tooltip content={`${vps.toLocaleString('ru-RU')} ₽`} className="block w-full cursor-help">
                  <MetricCard
                    label="Выгода за слот (VPS)"
                    value={`${formatCompactNumber(vps)} ₽`}
                    accent={vps > 10000 ? 'success' : vps > 5000 ? 'warning' : 'default'}
                  />
                </Tooltip>
              </div>
            </SectionPanel>

            <TraderModule buyFor={item.buyFor} sellFor={item.sellFor} />
            <BarterModule barters={item.barters} />
            <CraftModule crafts={item.crafts} />

            <SectionPanel title="Описание" icon={<Info className="w-4 h-4" />}>
              <p className="text-sm leading-relaxed font-blender-book text-text-secondary">
                {item.description || 'Описание отсутствует в базе данных.'}
              </p>
            </SectionPanel>

          </div>
        </div>

      </div>
    </main>
  );
}
