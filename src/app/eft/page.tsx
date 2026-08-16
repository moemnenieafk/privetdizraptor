import { PageHeader } from '@/components/ui/PageHeader';
import React from 'react';
import { EftHomeHubClient, type HubCatalogCard } from '@/app/eft/EftHomeHubClient';

// Данные для карточек навигации хаба EFT (серверный литерал; клиент переупорядочивает под роль).
const EFT_HUB_CARDS: HubCatalogCard[] = [
  {
    id: 'maps',
    title: 'Карты локаций',
    description: 'Интерактивные топографические данные',
    href: '/eft/maps',
    iconPath: '/icons/eft/maps-icon.svg',
    variant: 'square' as const,
  },
  {
    id: 'questmap',
    title: 'Карта заданий',
    description: 'Интерактивный прогресс выполнения заданий',
    href: '/eft/questmap',
    iconPath: '/icons/eft/04-progression/quest-map.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'events',
    title: 'События',
    description: 'Уникальные внутриигровые события',
    href: '/eft/quests/events',
    iconPath: '/icons/eft/02-quests/ingame-events.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'tracker',
    title: 'Трекер предметов',
    description: 'Интерактивное отслеживание предметов',
    href: '/eft/progress/tracker',
    iconPath: '/icons/eft/04-progression/items-tracker.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'needed',
    title: 'Важные предметы',
    description: 'Предметы необходимые в заданиях',
    href: '/eft/progress/needed',
    iconPath: '/icons/eft/04-progression/items-needed.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'barter',
    title: 'Прибыль бартера',
    description: 'Расчёт прибыли бартера',
    href: '/eft/progress/barter',
    iconPath: '/icons/eft/04-progression/barter-profit.svg',
    variant: 'rectangle' as const,
  },
  {
    id: 'gamesetting',
    title: 'Кодекс Таркова',
    description: 'Информация о мире Таркова',
    href: '/eft/gamesetting',
    iconPath: '/icons/eft/codex-icon.svg',
    variant: 'rectangle' as const,
  },
];

export default function EftHubPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <PageHeader pageId="eft" />

        {/* Адаптивная сетка (R05): единый каталог, переупорядоченный под архетип.
            Данные каталога — серверные; переупорядочивание клиентское (роль в localStorage). */}
        <EftHomeHubClient catalog={EFT_HUB_CARDS} />

      </div>
    </main>
  );
}
