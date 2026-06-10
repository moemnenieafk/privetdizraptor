import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для 6 главных карточек навигации
const EFT_HUB_CARDS = [
  {
    id: 'maps',
    title: 'Карты',
    description: 'Интерактивные тактические карты всех локаций Норвинской области с маркерами выходов, спавнов лута, боссов и важных ключей.',
    href: '/eft/maps',
    iconPath: '/icons/eft/maps-icon.svg',
  },
  {
    id: 'quests',
    title: 'Задания',
    description: 'Подробные гайды по прохождению сюжетных и побочных квестов от всех торговцев Таркова с оптимальными маршрутами.',
    href: '/eft/quests',
    iconPath: '/icons/eft/quests-icon.svg',
  },
  {
    id: 'items',
    title: 'Предметы',
    description: 'Полная база данных снаряжения, оружия, модулей и ключей с актуальными ценами барахолки и подробными характеристиками.',
    href: '/eft/items',
    iconPath: '/icons/eft/03-items/loot-tier.svg',
  },
  {
    id: 'progress',
    title: 'Прогресс',
    description: 'Трекер ваших достижений, конструктор сборок оружия, расчет прибыли модулей убежища и эффективности бартерных обменов.',
    href: '/eft/progress',
    iconPath: '/icons/eft/progress-icon.svg',
  },
  {
    id: 'gamesetting',
    title: 'Кодекс',
    description: 'Глубокое погружение в историю мира, фракции, биографии боссов, торговцев и корпораций вселенной Escape from Tarkov.',
    href: '/eft/gamesetting',
    iconPath: '/icons/eft/codex-icon.svg',
  },
  {
    id: 'videos',
    title: 'Видео',
    description: 'Актуальные видеогайды, аналитика патчей, новостные сводки, советы для новичков и записи лучших прямых эфиров.',
    href: '/eft/videos',
    iconPath: '/icons/eft/06-videos/videos-icon.svg',
  },
];

export default function EftHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[60px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка карточек (3 колонки на десктопе) */}
        <div className="tactical-grid">
          {EFT_HUB_CARDS.map((card, index) => (
            <HubCard
              key={card.id}
              gameId="eft"
              id={card.id}
              title={card.title}
              description={card.description}
              href={card.href}
              iconPath={card.iconPath}
              variant="square" // Все карточки будут большими (348x348px)
              index={index}
            />
          ))}
        </div>
        
      </div>
    </main>
  );
}
