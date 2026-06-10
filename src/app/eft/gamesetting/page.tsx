import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Кодекс"
const CODEX_HUB_CARDS = [
  {
    id: 'lore',
    title: 'История мира',
    description: 'Погрузитесь в историю вселенной Russia 2028, предшествующую событиям в Таркове.',
    href: '/eft/gamesetting/lore',
    iconPath: '/icons/eft/05-gamesetting/tarkov-lore.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'timeline',
    title: 'Хронология',
    description: 'Ключевые события, приведшие к конфликту в Норвинской области, в хронологическом порядке.',
    href: '/eft/gamesetting/timeline',
    iconPath: '/icons/eft/05-gamesetting/timeline.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'characters',
    title: 'Персонажи',
    description: 'Досье на ключевых действующих лиц: боссов, торговцев и других важных персонажей.',
    href: '/eft/gamesetting/characters',
    iconPath: '/icons/eft/05-gamesetting/characters.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'factions',
    title: 'Фракции',
    description: 'Информация о противоборствующих сторонах: USEC, BEAR и Диких.',
    href: '/eft/gamesetting/factions',
    iconPath: '/icons/eft/05-gamesetting/fractions.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'corporations',
    title: 'Корпорации',
    description: 'Сведения о TerraGroup, ее деятельности и других корпорациях, замешанных в конфликте.',
    href: '/eft/gamesetting/corporations',
    iconPath: '/icons/eft/05-gamesetting/corporations.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'locations',
    title: 'Локации',
    description: 'История и описание ключевых мест в Таркове и его окрестностях.',
    href: '/eft/gamesetting/locations',
    iconPath: '/icons/eft/05-gamesetting/locations.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'materials',
    title: 'Материалы',
    description: 'Сборник внутриигровых документов, аудиозаписей и записок, раскрывающих сюжет.',
    href: '/eft/gamesetting/materials',
    iconPath: '/icons/eft/05-gamesetting/docs-notes.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'theories',
    title: 'Теории и загадки',
    description: 'Разбор фанатских теорий, неразгаданных тайн и загадок мира Escape from Tarkov.',
    href: '/eft/gamesetting/theories',
    iconPath: '/icons/eft/05-gamesetting/theory-riddles.svg',
    variant: 'rectangle' as const,
  },
];

export default function CodexHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        <PageHeader pageId="eft-gamesetting" />
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {CODEX_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}