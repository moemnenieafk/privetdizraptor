import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Модов
const MODS_HUB_CARDS = [
  // --- КРИТИЧЕСКИЕ ---
  {
    id: 'gasblocks',
    title: 'Газовые трубки',
    description: 'Направляющие газовые трубки и блоки для установки дополнительных модулей и цевий.',
    href: '/eft/items/guns/mods/vitalparts/gasblocks',
    iconPath: '/icons/eft/03-items/guns/gun-modes/gas-blocks.svg',
    variant: 'rectangle' as const,
    badgeText: 'Критические',
  },
  {
    id: 'receivers',
    title: 'Крышки и ресиверы',
    description: 'Ствольные коробки и пылезащитные крышки, основа любого огнестрельного оружия.',
    href: '/eft/items/guns/mods/vitalparts/receivers',
    iconPath: '/icons/eft/03-items/guns/gun-modes/receivers-slides.svg',
    variant: 'rectangle' as const,
    badgeText: 'Критические',
  },
  {
    id: 'pistol-grips',
    title: 'Рукоятки',
    description: 'Пистолетные рукоятки для улучшения эргономики и контроля оружия.',
    href: '/eft/items/guns/mods/vitalparts/pistol-grips',
    iconPath: '/icons/eft/03-items/guns/gun-modes/pistol-grips.svg',
    variant: 'rectangle' as const,
    badgeText: 'Критические',
  },
  {
    id: 'barrels',
    title: 'Стволы',
    description: 'Запасные стволы различной длины, влияющие на точность, отдачу и начальную скорость пули.',
    href: '/eft/items/guns/mods/vitalparts/barrels',
    iconPath: '/icons/eft/03-items/guns/gun-modes/barrels.svg',
    variant: 'rectangle' as const,
    badgeText: 'Критические',
  },
  {
    id: 'handguards',
    title: 'Цевья',
    description: 'Цевья и накладки, обеспечивающие удобный хват и возможность установки тактических модулей.',
    href: '/eft/items/guns/mods/vitalparts/handguards',
    iconPath: '/icons/eft/03-items/guns/gun-modes/handguards.svg',
    variant: 'rectangle' as const,
    badgeText: 'Критические',
  },
  
];

export default function ModsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">

        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {MODS_HUB_CARDS.map((card, index) => (
            <HubCard
              key={card.id}
              gameId="eft"
              id={card.id}
              title={card.title}
              description={card.description}
              href={card.href}
              iconPath={card.iconPath}
              variant={card.variant}
              badgeText={card.badgeText}
              index={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
