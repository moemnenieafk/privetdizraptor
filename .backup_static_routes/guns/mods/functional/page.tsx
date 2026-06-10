import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Модов
const MODS_HUB_CARDS = [

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
