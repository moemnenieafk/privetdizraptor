import React from 'react';
import { HubCard } from '@/components/ui/HubCard';

// Данные для карточек навигации раздела "Ключи"
const KEYS_HUB_CARDS = [
  {
    id: 'keycards',
    title: 'Ключ-карты',
    description: 'Электронные карты доступа для лаборатории TerraGroup и других высокотехнологичных зон.',
    href: '/eft/items/equipment/keys/keycards',
    iconPath: '/icons/eft/03-items/equipment/keys/key-cards.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'marked-keys',
    title: 'Меченые ключи',
    description: 'Ключи от особых комнат с повышенным шансом нахождения ценных предметов.',
    href: '/eft/items/equipment/keys/mechanical/marked',
    iconPath: '/icons/eft/03-items/equipment/keys/mechanical-keys/marked-keys.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'quest-keys',
    title: 'Ключи для заданий',
    description: 'Ключи, необходимые для выполнения определенных квестов торговцев.',
    href: '/eft/items/equipment/keys/mechanical/quest',
    iconPath: '/icons/eft/03-items/equipment/keys/mechanical-keys/quest-keys.svg',
    variant: 'rectangle' as const,
  }
];

export default function KeysHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-[40px] pb-[100px] animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-[1100px] px-4 xl:px-0">
        
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {KEYS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}