import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Оборудования
const EQUIPMENT_HUB_CARDS = [
  {
    id: 'meds',
    title: 'Медикаменты',
    description: 'Аптечки, стимуляторы, бинты и другие медицинские средства для выживания в рейде.',
    href: '/eft/items/equipment/meds',
    iconPath: '/icons/eft/03-items/equipment/meds.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'info',
    title: 'Инфопредметы',
    description: 'Флешки, дневники, карты и другие носители ценной информации.',
    href: '/eft/items/equipment/info',
    iconPath: '/icons/eft/03-items/equipment/infoitems.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'keys',
    title: 'Ключи',
    description: 'Механические ключи и электронные ключ-карты для доступа к запертым зонам.',
    href: '/eft/items/equipment/keys',
    iconPath: '/icons/eft/03-items/equipment/keys.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'containers',
    title: 'Контейнеры',
    description: 'Защищенные контейнеры и кейсы для хранения и переноски предметов.',
    href: '/eft/items/equipment/containers',
    iconPath: '/icons/eft/03-items/equipment/containers.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'provisions',
    title: 'Провизия',
    description: 'Еда и напитки для поддержания уровня гидратации и энергии вашего персонажа.',
    href: '/eft/items/equipment/provisions',
    iconPath: '/icons/eft/03-items/equipment/provisions.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'special',
    title: 'Спецоборудование',
    description: 'Компасы, маркеры, трекеры и другие специализированные устройства.',
    href: '/eft/items/equipment/special',
    iconPath: '/icons/eft/03-items/equipment/special-equipment.svg',
    variant: 'rectangle' as const,
  }
];

export default function EquipmentHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {EQUIPMENT_HUB_CARDS.map((card, index) => (
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
