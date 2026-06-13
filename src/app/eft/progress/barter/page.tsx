import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Прибыль бартера"
const BARTER_HUB_CARDS = [
  {
    id: 'valuables',
    title: 'Ценности',
    description: 'Анализ бартеров за драгоценности, коллекционные предметы и другие ценные находки.',
    href: '/eft/progress/barter/valuables',
    iconPath: '/icons/eft/04-progression/barter-profit/valuables.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'electronics',
    title: 'Электроника',
    description: 'Выгодные обмены на видеокарты, процессоры, флешки и другие электронные компоненты.',
    href: '/eft/progress/barter/electronics',
    iconPath: '/icons/eft/04-progression/barter-profit/electronics.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'tools',
    title: 'Инструменты',
    description: 'Бартеры, требующие наборы инструментов, мультитулы, дрели и прочие технические предметы.',
    href: '/eft/progress/barter/tools',
    iconPath: '/icons/eft/04-progression/barter-profit/tools.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'flammable',
    title: 'Г.С.М.',
    description: 'Обмены на канистры с топливом, зажигалки, спички и другие горюче-смазочные материалы.',
    href: '/eft/progress/barter/flammable-materials',
    iconPath: '/icons/eft/04-progression/barter-profit/flammable-materials.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'building',
    title: 'Стройматериалы',
    description: 'Анализ бартеров за болты, гайки, гвозди, скотч и другие строительные материалы.',
    href: '/eft/progress/barter/building-materials',
    iconPath: '/icons/eft/04-progression/barter-profit/building-materials.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'household',
    title: 'Хозтовары',
    description: 'Выгодные обмены на мыло, туалетную бумагу, щелочь и другие хозяйственные товары.',
    href: '/eft/progress/barter/household-materials',
    iconPath: '/icons/eft/04-progression/barter-profit/household-materials.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'medical',
    title: 'Медматериалы',
    description: 'Бартеры, требующие шприцы, физраствор, и другие медицинские расходники.',
    href: '/eft/progress/barter/medical-supplies',
    iconPath: '/icons/eft/04-progression/barter-profit/medical-supplies.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'energy',
    title: 'Элементы питания',
    description: 'Обмены на аккумуляторы, батарейки и другие источники энергии.',
    href: '/eft/progress/barter/energy-elements',
    iconPath: '/icons/eft/04-progression/barter-profit/energy-elements.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'others',
    title: 'Другие',
    description: 'Прочие категории предметов для бартера, не вошедшие в основные группы.',
    href: '/eft/progress/barter/others',
    iconPath: '/icons/eft/04-progression/barter-profit/others.svg',
    variant: 'rectangle' as const,
  },
];

export default function BarterHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft-progress-barter" />
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {BARTER_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}