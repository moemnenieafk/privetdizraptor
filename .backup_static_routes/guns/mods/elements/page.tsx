import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// --- Элемент снаряженияЫ ---
// Данные для карточек навигации раздела "Элементы"
const ELEMENTS_CARDS = [
  {
    id: 'mounts',
    title: 'Крепления',
    description: 'Кронштейны, кольца, переходники и направляющие для установки модификаций.',
    href: '/eft/items/guns/mods/elements/mounts',
    iconPath: '/icons/eft/03-items/guns/gun-modes/mounts.svg',
    variant: 'rectangle' as const,
    badgeText: 'Элемент снаряжения',
  },
  {
    id: 'magazines',
    title: 'Магазины',
    description: 'Коробчатые и барабанные магазины различной вместимости.',
    href: '/eft/items/guns/mods/elements/magazines',
    iconPath: '/icons/eft/03-items/guns/gun-modes/magazines.svg',
    variant: 'rectangle' as const,
    badgeText: 'Элемент снаряжения',
  },
  {
    id: 'stocks',
    title: 'Приклады и Ложе',
    description: 'Приклады и ложа для кардинального улучшения эргономики и снижения отдачи.',
    href: '/eft/items/guns/mods/elements/stocks',
    iconPath: '/icons/eft/03-items/guns/gun-modes/stocks-chassis.svg',
    variant: 'rectangle' as const,
    badgeText: 'Элемент снаряжения',
  },
  {
    id: 'charging-handles',
    title: 'Рукоятки заряжания',
    description: 'Кастомные рукоятки заряжания для повышения эргономики оружия.',
    href: '/eft/items/guns/mods/elements/charging-handles',
    iconPath: '/icons/eft/03-items/guns/gun-modes/charging-handles.svg',
    variant: 'rectangle' as const,
    badgeText: 'Элемент снаряжения',
  }
];

export default function ElementsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
            {ELEMENTS_CARDS.map((card, index) => (
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
