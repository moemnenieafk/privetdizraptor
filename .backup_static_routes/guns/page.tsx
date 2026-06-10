import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Оружия
const GUNS_HUB_CARDS = [
  {
    id: 'ammo',
    title: 'Боеприпасы',
    description: 'Полная база данных патронов с характеристиками пробития и урона.',
    href: '/eft/items/guns/ammo',
    iconPath: '/icons/eft/03-items/guns/cat-ammo.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'grenades',
    title: 'Гранаты',
    description: 'Осколочные, дымовые, светошумовые гранаты и ВОГ.',
    href: '/eft/items/guns/grenades',
    iconPath: '/icons/eft/03-items/guns/cat-grenades.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'firearms',
    title: 'Огнестрельное',
    description: 'Штурмовые и снайперские винтовки, пистолеты-пулеметы, дробовики и пистолеты.',
    href: '/eft/items/guns/firearms',
    iconPath: '/icons/eft/03-items/guns.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'mods',
    title: 'Моды',
    description: 'Оружейные модификации: прицелы, цевья, глушители, приклады и магазины.',
    href: '/eft/items/guns/mods',
    iconPath: '/icons/eft/03-items/guns/cat-gunmods.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'melee',
    title: 'Холодное',
    description: 'Ножи, топоры, мачете и другое оружие ближнего боя.',
    href: '/eft/items/guns/melee',
    iconPath: '/icons/eft/03-items/guns/cat-knifes.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'special',
    title: 'Специальное',
    description: 'Гранатометы, сигнальные пистолеты и уникальное вооружение.',
    href: '/eft/items/guns/special',
    iconPath: '/icons/eft/03-items/guns/cat-special-weapon.svg',
    variant: 'rectangle' as const,
  }
];

export default function GunsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {GUNS_HUB_CARDS.map((card, index) => (
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