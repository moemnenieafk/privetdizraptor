import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Медикаменты"
const MEDS_HUB_CARDS = [
  {
    id: 'medkits',
    title: 'Аптечки',
    description: 'Индивидуальные аптечки для восстановления здоровья и устранения легких ранений.',
    href: '/eft/items/equipment/meds/medkits',
    iconPath: '/icons/eft/03-items/equipment/meds/medkits.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'injectors',
    title: 'Инъекторы',
    description: 'Стимуляторы для временного усиления характеристик, обезболивания и снятия негативных эффектов.',
    href: '/eft/items/equipment/meds/injectors',
    iconPath: '/icons/eft/03-items/equipment/meds/injectors.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'injury',
    title: 'Обработка ранений',
    description: 'Бинты, жгуты и хирургические наборы для остановки кровотечений и лечения тяжелых травм.',
    href: '/eft/items/equipment/meds/injury',
    iconPath: '/icons/eft/03-items/equipment/meds/injury-treatment.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'pills',
    title: 'Таблетки',
    description: 'Обезболивающие и другие препараты в таблетированной форме для длительного действия.',
    href: '/eft/items/equipment/meds/pills',
    iconPath: '/icons/eft/03-items/equipment/meds/pills.svg',
    variant: 'rectangle' as const,
  }
];

export default function MedsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {MEDS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}