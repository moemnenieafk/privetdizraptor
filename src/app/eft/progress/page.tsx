import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Прогресс"
const PROGRESS_HUB_CARDS = [
  {
    id: 'achievements',
    title: 'Достижения',
    description: 'Отслеживайте свои внутриигровые достижения, от сюжетных вех до уникальных испытаний.',
    href: '/eft/progress/achievements',
    iconPath: '/icons/eft/04-progression/achievments.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'prestige',
    title: 'Престиж',
    description: 'Продемонстрируйте свой опыт и получите уникальные награды после достижения максимального уровня.',
    href: '/eft/progress/prestige',
    iconPath: '/icons/eft/04-progression/prestige.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'hideout',
    title: 'Убежище ЧВК',
    description: 'Развивайте свою базу, создавайте предметы и получайте пассивные бонусы для вашего персонажа.',
    href: '/eft/progress/hideout',
    iconPath: '/icons/eft/04-progression/hideout-modules.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'barter',
    title: 'Прибыль бартера',
    description: 'Анализируйте выгодные обмены у торговцев, чтобы максимизировать свою прибыль.',
    href: '/eft/progress/barter',
    iconPath: '/icons/eft/04-progression/barter-profit.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'loadouts',
    title: 'Сборки оружия',
    description: 'Создавайте, сохраняйте и делитесь своими лучшими сборками оружия с сообществом.',
    href: '/eft/progress/loadouts',
    iconPath: '/icons/eft/04-progression/gun-loadouts.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'tracker',
    title: 'Трекер предметов',
    description: 'Отмечайте найденные предметы для квестов, убежища и бартеров в удобном чек-листе.',
    href: '/eft/progress/tracker',
    iconPath: '/icons/eft/04-progression/items-tracker.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'needed',
    title: 'Нужные предметы',
    description: 'Полный список всех предметов, необходимых для выполнения заданий и постройки убежища.',
    href: '/eft/progress/needed',
    iconPath: '/icons/eft/04-progression/items-needed.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'questmap',
    title: 'Карта заданий',
    description: 'Визуальная карта прогресса по квестам, показывающая зависимости и следующие шаги.',
    href: '/eft/questmap',
    iconPath: '/icons/eft/04-progression/quest-map.svg',
    variant: 'rectangle' as const,
  },
];

export default function ProgressHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-progress" />
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {PROGRESS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}