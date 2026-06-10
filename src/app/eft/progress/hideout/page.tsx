import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Убежище ЧВК"
const HIDEOUT_HUB_CARDS = [
  {
    id: 'hideout-modules',
    title: 'Модули убежища',
    description: 'Обзор всех модулей, их уровней, требований для постройки и получаемых бонусов.',
    href: '/eft/progress/hideout/modules',
    iconPath: '/icons/eft/04-progression/hideout-modules.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'craft-profit',
    title: 'Прибыль убежища',
    description: 'Калькулятор прибыльности крафтов в убежище с учетом текущих цен на барахолке.',
    href: '/eft/progress/hideout/craft-profit',
    iconPath: '/icons/eft/04-progression/craft-profit.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'bitcoin-profit',
    title: 'Прибыль Bitcoin',
    description: 'Анализ доходности биткоин-фермы в зависимости от количества видеокарт и цен.',
    href: '/eft/progress/hideout/bitcoin-profit',
    iconPath: '/icons/eft/04-progression/bitcoin-profit.svg',
    variant: 'rectangle' as const,
  },
];

export default function HideoutHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        <PageHeader pageId="eft-progress-hideout" />
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {HIDEOUT_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}