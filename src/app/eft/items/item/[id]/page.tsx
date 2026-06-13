import { notFound } from 'next/navigation';
import { Info, Banknote, ArrowLeft } from 'lucide-react';
import { Badge, MetricCard, SectionPanel } from '@/components/ui/kit';
import {
  WeaponModule,
  ArmorModule,
  MedicalModule,
  ContainerModule,
  TraderModule,
  BarterModule,
  CraftModule,
  type ItemProperties,
  type VendorOffer,
  type BarterOffer,
  type CraftRecipe,
} from './ItemModules';
import Link from 'next/link';
import { formatCompactNumber } from '@/lib/formatters';
import { Tooltip } from '@/components/ui/Tooltip';

// === ТИПИЗАЦИЯ ДАННЫХ TARKOV.DEV ===

interface TarkovItem {
  id: string;
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

// === СЕРВЕРНЫЙ ЗАПРОС К GRAPHQL (BFF PATTERN) ===

async function getItemData(id: string): Promise<TarkovItem | null> {
  const query = `
    query GetItem($id: ID!) {
      item(id: $id) {
        id
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
          vendor { name normalizedName }
        }
        buyFor {
          price
          vendor { name normalizedName }
        }
        barters {
          id
          trader { name normalizedName }
          level
          requiredItems {
            item { id name shortName iconLink basePrice }
            count
          }
        }
        crafts {
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
            material { name }
          }
          ... on ItemPropertiesMedical {
            useTime
            uses
            hpCost
          }
          ... on ItemPropertiesContainer {
            grids { width height }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables: { id } }),
    next: { revalidate: 3600 },
  });

  const json = await res.json() as { data?: { item: TarkovItem | null } };
  return json.data?.item ?? null;
}

// === СТРАНИЦА ПРЕДМЕТА ===

export default async function ItemDetailsPage({ params }: { params: { id: string } }) {
  const item = await getItemData(params.id);

  if (!item) notFound();

  const slots = item.width * item.height;
  const bestSell = item.sellFor?.length
    ? item.sellFor.reduce((max, curr) => (curr.price > max.price ? curr : max))
    : { price: 0, vendor: { name: 'Неизвестно', normalizedName: 'unknown' } };
  const vps = slots > 0 ? Math.floor(bestSell.price / slots) : 0;

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in-up_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 mx-auto xl:px-0">

        {/* Кнопка "Назад" */}
        <div className="mb-6">
          <Link
            href="/eft/items"
            className="inline-flex items-center text-xs uppercase tracking-widest font-blender-medium text-text-muted hover:text-(--primary) transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> База предметов
          </Link>
        </div>

        {/* Хедер предмета */}
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

        {/* Основной Grid (Tactical Layout) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

          {/* Левая колонка: Визуал + специфичные модули (4/12) */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="relative flex min-h-75 items-center justify-center overflow-hidden rounded border border-lines-hover bg-card-menu p-4 group">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,var(--color-text-muted)_1px,transparent_1px)] bg-size-[20px_20px]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/items/eft/${item.id}.webp`}
                alt={item.name}
                className="z-10 w-64 h-64 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  if (!e.currentTarget.dataset.triedApi) {
                    e.currentTarget.dataset.triedApi = 'true';
                    e.currentTarget.src = item.image512pxLink || '/images/placeholder.webp';
                  } else if (!e.currentTarget.dataset.triedPlaceholder) {
                    e.currentTarget.dataset.triedPlaceholder = 'true';
                    e.currentTarget.src = '/images/placeholder.webp';
                  }
                }}
              />
            </div>

            <WeaponModule properties={item.properties} />
            <ArmorModule properties={item.properties} />
            <MedicalModule properties={item.properties} />
            <ContainerModule properties={item.properties} itemWidth={item.width} itemHeight={item.height} />
          </div>

          {/* Правая колонка: Экономика + торговля + бартер + крафт (8/12) */}
          <div className="flex flex-col gap-6 lg:col-span-8">

            {/* Экономический блок */}
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

            {/* Торговля */}
            <TraderModule buyFor={item.buyFor} sellFor={item.sellFor} />

            {/* Бартер */}
            <BarterModule barters={item.barters} />

            {/* Крафт */}
            <CraftModule crafts={item.crafts} />

            {/* Описание */}
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
