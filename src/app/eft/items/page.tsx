import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Предметов
const ITEMS_HUB_CARDS = [
  {
    id: 'loot-rate',
    title: 'Рейтинг предметов',
    description: 'Актуальные данные о ценности и редкости предметов на барахолке.',
    href: '/eft/items/loot-rate',
    iconPath: '/icons/eft/03-items/loot-tier.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'gear',
    title: 'Снаряжение',
    description: 'Бронежилеты, разгрузки, шлемы, рюкзаки и другие элементы экипировки.',
    href: '/eft/items/gear',
    iconPath: '/icons/eft/03-items/gear.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'guns',
    title: 'Оружие',
    description: 'Полная база данных огнестрельного, холодного оружия и модификаций.',
    href: '/eft/items/guns',
    iconPath: '/icons/eft/03-items/guns.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'equipment',
    title: 'Оборудование',
    description: 'Медикаменты, ключи, контейнеры, провизия и специальное снаряжение.',
    href: '/eft/items/equipment',
    iconPath: '/icons/eft/03-items/equipment.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'price-slot',
    title: 'Цена за слот',
    description: 'Расчет эффективности использования пространства в схроне и инвентаре.',
    href: '/eft/items/price-slot',
    iconPath: '/icons/eft/03-items/price-per-slot.svg',
    variant: 'rectangle' as const,
  },
];

export default function ItemsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        <PageHeader pageId="eft-items" />
        
        {/* Сетка HubCard (по 3 в ряд) */}
        <div className="tactical-grid">
          {ITEMS_HUB_CARDS.map((card, index) => (
            <HubCard
              key={card.id}
              gameId="eft"
              id={card.id}
              title={card.title}
              description={card.description}
              href={card.href}
              iconPath={card.iconPath}
              variant={card.variant}
              index={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}