import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Заданий
const QUESTS_HUB_CARDS = [
  {
    id: 'story-quests',
    title: 'Сюжетные',
    description: 'Подробности выполнения сюжетных заданий',
    href: '/eft/quests/lore-quests',
    iconPath: '/icons/eft/02-quests/lore-quests.svg',
    variant: 'square' as const,
  },
  {
    id: 'side-quests',
    title: 'Побочные',
    description: 'Цепочки заданий от торговцев',
    href: '/eft/quests/side-quests',
    iconPath: '/icons/eft/02-quests/side-quests.svg',
    variant: 'square' as const,
  },
  {
    id: 'events',
    title: 'События',
    description: 'Уникальные внутриигровые события',
    href: '/eft/quests/events',
    iconPath: '/icons/eft/02-quests/ingame-events.svg',
    variant: 'square' as const,
  },
];

export default function QuestsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-quests" />
        
        {/* Сетка карточек (3 большие карточки = 1 ровный ряд) */}
        <div className="tactical-grid mt-8">
          {QUESTS_HUB_CARDS.map((card, index) => (
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
