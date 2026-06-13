import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Сборки оружия"
const LOADOUTS_HUB_CARDS = [
  {
    id: 'my-loadouts',
    title: 'Мои сборки',
    description: 'Просматривайте и редактируйте ваши сохраненные сборки оружия.',
    href: '/eft/progress/loadouts/my',
    iconPath: '/icons/eft/04-progression/gun-loadouts/my-gun-loadouts.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'find-loadout',
    title: 'Найти сборку',
    description: 'Ищите и импортируйте популярные сборки от других игроков сообщества.',
    href: '/eft/progress/loadouts/find',
    iconPath: '/icons/eft/04-progression/gun-loadouts/find-gun-loadout.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'add-loadout',
    title: 'Создать сборку',
    description: 'Воспользуйтесь конструктором для создания новой сборки и поделитесь ей.',
    href: '/eft/progress/loadouts/add',
    iconPath: '/icons/eft/04-progression/gun-loadouts/add-gun-loadout.svg',
    variant: 'rectangle' as const,
  },
];

export default function LoadoutsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-progress-loadouts" />
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {LOADOUTS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}