import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Контейнеры"
const CONTAINERS_HUB_CARDS = [
  {
    id: 'cases',
    title: 'Кейсы',
    description: 'Кейсы для хранения патронов, медикаментов, ключей и других предметов.',
    href: '/eft/items/equipment/containers/cases',
    iconPath: '/icons/eft/03-items/equipment/containers/cases.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'secure',
    title: 'Защищенные',
    description: 'Специальные контейнеры, которые сохраняют предметы после смерти персонажа.',
    href: '/eft/items/equipment/containers/secure',
    iconPath: '/icons/eft/03-items/equipment/containers/secure-containers.svg',
    variant: 'rectangle' as const,
  }
];

export default function ContainersHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {CONTAINERS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}