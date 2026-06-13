import React from 'react';
import { notFound } from 'next/navigation';
import { Info, Banknote, Package, ArrowLeft } from 'lucide-react';
import { Badge, MetricCard, ProgressBar, SectionPanel } from '@/components/ui/kit';
import { WeaponModule, ArmorModule, MedicalModule, ContainerModule } from './ItemModules';
import Link from 'next/link';

// 1. Строгая типизация данных из tarkov.dev
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
  properties: any; // В реальном проекте здесь будет сложный Union Type
  sellFor: {
    price: number;
    vendor: { name: string; normalizedName: string };
  }[];
}

// 2. Серверный запрос к GraphQL (BFF Pattern)
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
          vendor {
            name
            normalizedName
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
            grids {
              width
              height
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.tarkov.dev/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables: { id } }),
    next: { revalidate: 3600 }, // ISR: Кэшируем на 1 час
  });

  const json = await res.json();
  return json.data?.item || null;
}

export default async function ItemDetailsPage({ params }: { params: { id: string } }) {
  const item = await getItemData(params.id);

  // Graceful Degradation: Если предмет не найден
  if (!item) {
    notFound();
  }

  // Вычисление тактических метрик
  const slots = item.width * item.height;
  const bestSell = item.sellFor?.reduce((max, curr) => (curr.price > max.price ? curr : max), item.sellFor[0]) || { price: 0, vendor: { name: 'Неизвестно' } };
  const vps = slots > 0 ? Math.floor(bestSell.price / slots) : 0;

  return (
    <main className="flex w-full flex-col items-center justify-start pt-[28px] pb-[56px] animate-[fade-in-up_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0 mx-auto">
        
        {/* Тактическая кнопка "Назад" */}
        <div className="mb-6">
          <Link href="/eft/items" className="inline-flex items-center text-xs font-blender-medium uppercase tracking-widest text-text-muted hover:text-[var(--primary)] transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> База предметов
          </Link>
        </div>

        {/* Хедер предмета */}
        <div className="mb-6 border-b border-lines-hover pb-6">
          <h1 className="text-3xl lg:text-4xl font-blender-medium uppercase tracking-widest text-text-primary mb-2 leading-none">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Левая колонка: Визуал (4/12) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-card-menu border border-lines-hover rounded p-4 flex items-center justify-center relative min-h-[300px] overflow-hidden group">
              {/* Фоновый тактический паттерн */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle,var(--color-text-muted)_1px,transparent_1px)] [background-size:20px_20px]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`/images/items/eft/${item.id}.webp`} 
                alt={item.name} 
                className="w-64 h-64 object-contain z-10 drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
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
            
            {/* ДИНАМИЧЕСКИЕ МОДУЛИ (Render Strategy) */}
            <WeaponModule properties={item.properties} />
            <ArmorModule properties={item.properties} />
            <MedicalModule properties={item.properties} />
            <ContainerModule properties={item.properties} itemWidth={item.width} itemHeight={item.height} />
            
          </div>

          {/* Правая колонка: Данные (8/12) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Экономический блок */}
            <SectionPanel title="Тактическая Экономика" icon={<Banknote className="w-4 h-4" />}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  label="Базовая цена" 
                  value={`${item.basePrice.toLocaleString('ru-RU')} ₽`} 
                />
                <MetricCard 
                  label="Лучшая продажа" 
                  value={`${bestSell.price.toLocaleString('ru-RU')} ₽`} 
                  subtext={bestSell.vendor.name}
                  accent="primary" 
                />
                <MetricCard 
                  label="Размер (Слоты)" 
                  value={`${item.width}x${item.height}`} 
                  subtext={`${slots} ячеек`}
                  accent="default" 
                />
                <MetricCard 
                  label="Выгода за слот (VPS)" 
                  value={`${vps.toLocaleString('ru-RU')} ₽`} 
                  accent={vps > 10000 ? 'success' : vps > 5000 ? 'warning' : 'default'} 
                />
              </div>
            </SectionPanel>

            {/* Описание предмета */}
            <SectionPanel title="Описание" icon={<Info className="w-4 h-4" />}>
              <p className="text-text-secondary text-sm leading-relaxed font-blender-book">
                {item.description || 'Описание отсутствует в базе данных.'}
              </p>
            </SectionPanel>
            
            {/* Место под будущие модули (Прогрессивное раскрытие) */}
            <SectionPanel title="Бартер и Крафт" icon={<Package className="w-4 h-4" />} className="opacity-50 grayscale">
              <div className="flex items-center justify-center py-6">
                <span className="text-text-muted text-xs font-mono uppercase tracking-widest">ДАННЫЕ ЗАСЕКРЕЧЕНЫ (В РАЗРАБОТКЕ)</span>
              </div>
            </SectionPanel>

          </div>
        </div>

      </div>
    </main>
  );
}
