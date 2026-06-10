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

  // --- ФУНКЦИОНАЛЬНЫЕ ---
  {
    id: 'auxiliary',
    title: 'Вспом. части',
    description: 'Дополнительные функциональные компоненты: наглазники, крышки прицелов и переходники.',
    href: '/eft/items/guns/mods/functional/auxiliary',
    iconPath: '/icons/eft/03-items/guns/gun-modes/auxiliary-parts.svg',
    variant: 'rectangle' as const,
    badgeText: 'Функциональные',
  },
  {
    id: 'muzzle',
    title: 'Дульные устройства',
    description: 'Глушители, пламегасители и дульные тормоза-компенсаторы для снижения отдачи и шума.',
    href: '/eft/items/guns/mods/functional/muzzle',
    iconPath: '/icons/eft/03-items/guns/gun-modes/muzzle-devices.svg',
    variant: 'rectangle' as const,
    badgeText: 'Функциональные',
  },
  {
    id: 'sights',
    title: 'Прицелы',
    description: 'Оптические, коллиматорные, тепловизионные и механические прицельные приспособления.',
    href: '/eft/items/guns/mods/functional/sights',
    iconPath: '/icons/eft/03-items/guns/gun-modes/sights.svg',
    variant: 'rectangle' as const,
    badgeText: 'Функциональные',
  },
  {
    id: 'laser',
    title: 'Фонарики и ЛЦУ',
    description: 'Тактические фонари и лазерные целеуказатели для стрельбы навскидку и ослепления врага.',
    href: '/eft/items/guns/mods/functional/laser',
    iconPath: '/icons/eft/03-items/guns/gun-modes/light-laser-device.svg',
    variant: 'rectangle' as const,
    badgeText: 'Функциональные',
  },
  {
    id: 'bipods',
    title: 'Сошки',
    description: 'Складные сошки для максимальной стабилизации оружия при стрельбе лежа.',
    href: '/eft/items/guns/mods/functional/bipods',
    iconPath: '/icons/eft/03-items/guns/gun-modes/bipods.svg',
    variant: 'rectangle' as const,
    badgeText: 'Функциональные',
  },
  {
    id: 'foregrips',
    title: 'Такт. рукоятки',
    description: 'Передние тактические рукоятки для существенного снижения вертикальной и горизонтальной отдачи.',
    href: '/eft/items/guns/mods/functional/foregrips',
    iconPath: '/icons/eft/03-items/guns/gun-modes/foregrips.svg',
    variant: 'rectangle' as const,
    badgeText: 'Функциональные',
  },

  // --- Элемент снаряженияЫ ---
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
