import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Провизия"
const PROVISIONS_HUB_CARDS = [
  {
    id: 'food',
    title: 'Еда',
    description: 'Консервы, сухпайки и другие продукты для восстановления энергии и утоления голода.',
    href: '/eft/items/equipment/provisions/food',
    iconPath: '/icons/eft/03-items/equipment/provisions/food.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'drinks',
    title: 'Напитки',
    description: 'Вода, соки и энергетические напитки для восстановления гидратации.',
    href: '/eft/items/equipment/provisions/drinks',
    iconPath: '/icons/eft/03-items/equipment/provisions/drinks.svg',
    variant: 'rectangle' as const,
  }
];

export default function ProvisionsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {PROVISIONS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}
