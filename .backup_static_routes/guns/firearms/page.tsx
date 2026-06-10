import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела Огнестрельного оружия
const FIREARMS_HUB_CARDS = [
  {
    id: 'ar',
    title: 'Штурмовые винтовки',
    description: 'Универсальное автоматическое оружие, эффективное в большинстве боевых ситуаций на средних и ближних дистанциях.',
    href: '/eft/items/guns/firearms/ar',
    iconPath: '/icons/eft/03-items/guns/gun-types/ar-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'smg',
    title: 'Пистолеты-Пулеметы',
    description: 'Компактное автоматическое оружие под пистолетный патрон с колоссальной скорострельностью для ближнего боя.',
    href: '/eft/items/guns/firearms/smg',
    iconPath: '/icons/eft/03-items/guns/gun-types/smg_usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'dmr',
    title: 'Пехотные винтовки',
    description: 'Полуавтоматические марксманские винтовки, идеально сочетающие высокую точность и урон на дальних дистанциях.',
    href: '/eft/items/guns/firearms/dmr',
    iconPath: '/icons/eft/03-items/guns/gun-types/dmr-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'bolt',
    title: 'Болтовые винтовки',
    description: 'Высокоточное снайперское оружие с продольно-скользящим затвором для максимального урона одним выстрелом.',
    href: '/eft/items/guns/firearms/bolt',
    iconPath: '/icons/eft/03-items/guns/gun-types/bolt-action-riffle-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'carbine',
    title: 'Карабины',
    description: 'Гражданские и укороченные версии винтовок, часто стреляющие одиночными, под различные типы боеприпасов.',
    href: '/eft/items/guns/firearms/carbine',
    iconPath: '/icons/eft/03-items/guns/gun-types/carbine-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'shotgun',
    title: 'Дробовики',
    description: 'Гладкоствольные ружья, невероятно смертоносные в ближнем бою при использовании картечи или бронебойной пули.',
    href: '/eft/items/guns/firearms/shotgun',
    iconPath: '/icons/eft/03-items/guns/gun-types/shotgun-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'sidearm',
    title: 'Пистолеты',
    description: 'Личное короткоствольное оружие, незаменимое в качестве запасного (sidearm) в критических ситуациях.',
    href: '/eft/items/guns/firearms/sidearm',
    iconPath: '/icons/eft/03-items/guns/gun-types/sidearm-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'lmg',
    title: 'Пулеметы',
    description: 'Тяжелое автоматическое оружие для непрерывной огневой поддержки и подавления отрядов противника.',
    href: '/eft/items/guns/firearms/lmg',
    iconPath: '/icons/eft/03-items/guns/gun-types/lmg-usec.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'gl',
    title: 'Гранатометы',
    description: 'Подствольные и ручные гранатометы для уничтожения групп противника и укрепленных позиций взрывным уроном.',
    href: '/eft/items/guns/firearms/gl',
    iconPath: '/icons/eft/03-items/guns/gun-types/gl-usec.svg',
    variant: 'rectangle' as const,
  }
];

export default function FirearmsHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {FIREARMS_HUB_CARDS.map((card, index) => (
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