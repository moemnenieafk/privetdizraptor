import React from 'react';
import { notFound } from 'next/navigation';
import { HubCard } from '@/components/ui/HubCard';
import { requireTier, serverEntitlementsSnapshot } from '@/lib/gating/resolve';
import { SectionPaywall } from '@/components/features/subscription/SectionPaywall';

// Демо серверного энфорса раздела (R09i/R05.1). Section-ключ детерминирован из маршрута.
// Пока раздел free (дефолт) — gate.ok=true, страница как обычно. Админ ставит тир в матрице →
// без деплоя: hide→404 по прямой ссылке, lock→апселл вместо контента.
// Подключить энфорс на ЛЮБОЙ RSC-раздел = эти 3 строки с его path (см. enforceLoadoutsSection).
const SECTION_PATH = '/eft/progress/loadouts';

// Данные для карточек навигации раздела "Сборки оружия"
const LOADOUTS_HUB_CARDS = [
  {
    id: 'my-loadouts',
    title: 'Мои сборки',
    description: 'Просматривайте и редактируйте ваши сохраненные сборки оружия.',
    href: '/eft/progress/loadouts/my',
    iconPath: '/icons/eft/04-progression/gun-loadouts/my-gun-loadouts.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'find-loadout',
    title: 'Найти сборку',
    description: 'Ищите и импортируйте популярные сборки от других игроков сообщества.',
    href: '/eft/progress/loadouts/find',
    iconPath: '/icons/eft/04-progression/gun-loadouts/find-gun-loadout.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'add-loadout',
    title: 'Создать сборку',
    description: 'Воспользуйтесь конструктором для создания новой сборки и поделитесь ей.',
    href: '/eft/progress/loadouts/add',
    iconPath: '/icons/eft/04-progression/gun-loadouts/add-gun-loadout.svg',
    variant: 'rectangle' as const,
  },
];

export default async function LoadoutsHubPage() {
  // Серверный гейт раздела: не обойти прямым запросом (R09i). hide→notFound, lock→апселл.
  const gate = await requireTier(`sec:eft:${SECTION_PATH}`, { game: 'eft' });
  if (!gate.ok) {
    if (gate.behavior === 'hide') notFound();
    const { tiers } = await serverEntitlementsSnapshot('eft');
    return <SectionPaywall need={gate.need} needTier={tiers.find((t) => t.slug === gate.need)} />;
  }

  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        {/* Сетка HubCard */}
        <div className="tactical-grid">
          {LOADOUTS_HUB_CARDS.map((card, index) => (
            <HubCard key={card.id} gameId="eft" {...card} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}