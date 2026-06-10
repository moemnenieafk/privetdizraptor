import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Снаряжения
const GEAR_HUB_CARDS = [
  {
    id: 'headphones',
    title: 'Наушники',
    description: 'Активные гарнитуры для улучшения слуха и подавления громких выстрелов.',
    href: '/eft/items/gear/headphones',
    iconPath: '/icons/eft/03-items/gear/cat-headphones.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'helmets',
    title: 'Шлемы',
    description: 'Защита головы различных классов бронирования от легких касок до тяжелых шлемов.',
    href: '/eft/items/gear/helmets',
    iconPath: '/icons/eft/03-items/gear/cat-helmets.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'masks',
    title: 'Маски',
    description: 'Лицевые маски, балаклавы, противогазы и банданы для скрытности.',
    href: '/eft/items/gear/masks',
    iconPath: '/icons/eft/03-items/gear/cat-masks.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'visors',
    title: 'Очки и Визоры',
    description: 'Тактические очки и пулестойкие забрала для защиты глаз и лица.',
    href: '/eft/items/gear/visors',
    iconPath: '/icons/eft/03-items/gear/cat-visors.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'armor',
    title: 'Бронежилеты',
    description: 'Нательные бронежилеты с возможностью установки и замены бронеплит.',
    href: '/eft/items/gear/armor',
    iconPath: '/icons/eft/03-items/gear/cat-armor.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'rigs',
    title: 'Разгрузки',
    description: 'Разгрузочные жилеты, в том числе тяжело бронированные (плитники).',
    href: '/eft/items/gear/rigs',
    iconPath: '/icons/eft/03-items/gear/cat-tactical-rigs.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'backpacks',
    title: 'Рюкзаки',
    description: 'Рюкзаки и сумки различной вместимости для переноски снаряжения и найденного лута.',
    href: '/eft/items/gear/backpacks',
    iconPath: '/icons/eft/03-items/gear/cat-backpacks.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'components',
    title: 'Компоненты',
    description: 'Сменные бронеплиты, защита шеи, паха и плеч для модификации бронежилетов.',
    href: '/eft/items/gear/components',
    iconPath: '/icons/eft/03-items/gear/cat-gearcomps.svg',
    variant: 'rectangle' as const,
  }
];

export default function GearHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard (по 3 в ряд на больших экранах, по 2 на средних) */}
        <div className="tactical-grid">
          {GEAR_HUB_CARDS.map((card, index) => (
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