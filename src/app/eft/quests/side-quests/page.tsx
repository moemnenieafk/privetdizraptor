import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек торговцев
const TRADERS_CARDS = [
  {
    id: 'prapor',
    title: 'Прапор',
    description: 'Прапорщик внутренних войск, заведующий складами снабжения на портовой базе, прикрывавшей эвакуацию промышленных объектов TerraGroup.',
    href: '/eft/quests/prapor',
    iconPath: '/icons/eft/02-quests/prapor_16x16.webp',
  },
  {
    id: 'therapist',
    title: 'Терапевт',
    description: 'Заведующая отделением травматологии центральной городской больницы Таркова. Осталась в городе по личным причинам.',
    href: '/eft/quests/therapist',
    iconPath: '/icons/eft/02-quests/therapist_16x16.webp',
  },
  {
    id: 'fence',
    title: 'Скупщик',
    description: 'Центральная фигура на черном рынке Таркова. Его сеть осведомителей и точек сбыта охватывает весь город и его окрестности.',
    href: '/eft/quests/fence',
    iconPath: '/icons/eft/02-quests/fence_16x16.webp',
  },
  {
    id: 'skier',
    title: 'Лыжник',
    description: 'Работник таможенного терминала порта. Изначально занимался сбытом товаров с терминала, но со временем переключился на оружие.',
    href: '/eft/quests/skier',
    iconPath: '/icons/eft/02-quests/skier_16x16.webp',
  },
  {
    id: 'peacekeeper',
    title: 'Миротворец',
    description: 'Снабженец из контингента ООН. Работает на одном из центральных блокпостов в портовой зоне Таркова, торгуя западным оружием.',
    href: '/eft/quests/peacekeeper',
    iconPath: '/icons/eft/02-quests/peacekeeper_16x16.webp',
  },
  {
    id: 'mechanic',
    title: 'Механик',
    description: 'Химик-заводчанин, с юности увлекался модификацией оружия и сложной техники. Работает в закрытой мастерской в промзоне.',
    href: '/eft/quests/mechanic',
    iconPath: '/icons/eft/02-quests/mechanic_16x16.webp',
  },
  {
    id: 'ragman',
    title: 'Барахольщик',
    description: 'Владелец крупной барахолки на окраине Таркова. Продает все, что связано с одеждой, снаряжением и экипировкой.',
    href: '/eft/quests/ragman',
    iconPath: '/icons/eft/02-quests/ragman_16x16.webp',
  },
  {
    id: 'jaeger',
    title: 'Егерь',
    description: 'Работник лесного охотничьего хозяйства Приозерского заповедника. Профессиональный охотник и специалист по выживанию.',
    href: '/eft/quests/jaeger',
    iconPath: '/icons/eft/02-quests/jaeger_16x16.webp',
  },
  {
    id: 'lightkeeper',
    title: 'Смотритель Маяка',
    description: 'Бывший сотрудник Управления по обеспечению безопасности объектов ФСИН. Контролирует вход в сектор Маяка.',
    href: '/eft/quests/lightkeeper',
    iconPath: '/icons/eft/02-quests/lightkeeper_16x16.webp',
  },
  {
    id: 'ref',
    title: 'Реф',
    description: 'Таинственный торговец, специализирующийся на редком снаряжении и оружии западного образца. Его мотивы и происхождение неизвестны.',
    href: '/eft/quests/ref',
    iconPath: '/icons/eft/02-quests/ref_16x16.webp',
  },
  {
    id: 'btr-driver',
    title: 'Водитель БТР',
    description: 'Водитель БТР-82А, который может перевозить игроков между локациями за определенную плату, а также предоставляет услуги.',
    href: '/eft/quests/btr-driver',
    iconPath: '/icons/eft/02-quests/btrdriver_16x16.webp',
  },
];

export default function SideQuestsPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-[28px] pb-[56px]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        <PageHeader pageId="eft-quests-side-quests" />
        
        {/* Сетка карточек торговцев */}
        <div className="tactical-grid">
          {TRADERS_CARDS.map((card, index) => (
            <HubCard
              key={card.id}
              gameId="eft"
              id={card.id}
              title={card.title}
              description={card.description}
              href={card.href}
              iconPath={card.iconPath}
              variant="rectangle" // Прямоугольные карточки среднего размера
              index={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}