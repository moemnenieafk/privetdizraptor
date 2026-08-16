'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { orderCardsByRole } from '@/data/role-hubs';
import { HubCard } from '@/components/ui/HubCard';

// Адаптивная сетка главной EFT (R05): архетип задаёт порядок карточек единого каталога —
// релевантные роли идут первыми. Порядок диктуют данные (orderCardsByRole), не JSX (§4.7).
// Server-обёртка /eft/page.tsx владеет литералом каталога и передаёт его сюда пропом.
// Роль живёт в localStorage → регидрация skipHydration-стора как у AdaptiveHubClient.

/** Карточка каталога главной EFT (форма — забота страницы, тип общий с сервером). */
export interface HubCatalogCard {
  id: string;
  title: string;
  description: string;
  href: string;
  iconPath: string;
  variant: 'square' | 'rectangle';
}

export function EftHomeHubClient({ catalog }: { catalog: readonly HubCatalogCard[] }) {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  // Дефолт rookie зашит в effectiveRoleFor: аноним/нет данных → осмысленный порядок новичка, не пусто.
  const role = useRoleStore((s) => effectiveRoleFor(s, activeId));

  // До регидрации порядок каталога ещё не известен → скелетон формы сетки (§8: форма
  // будущего контента, animate-pulse, не спиннер). Число ячеек = размеру каталога.
  if (!hydrated) {
    return (
      <div className="tactical-grid">
        {catalog.map((card) => (
          <div
            key={card.id}
            className={
              card.variant === 'square'
                ? 'aspect-square w-full animate-pulse rounded-lg bg-lines-hover'
                : 'aspect-[348/160] w-full animate-pulse rounded-lg bg-lines-hover md:col-span-2'
            }
          />
        ))}
      </div>
    );
  }

  // Единая сетка каталога, переупорядоченная под архетип (R05): релевантные роли первыми.
  return <CatalogGrid cards={orderCardsByRole(catalog, role)} />;
}

function CatalogGrid({ cards }: { cards: readonly HubCatalogCard[] }) {
  return (
    <div className="tactical-grid">
      {cards.map((card, index) => (
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
  );
}
