'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { ROLE_LABELS } from '@/lib/role-inference';
import { ROLE_HUBS, orderCardsByRole } from '@/data/role-hubs';
import { HubCard } from '@/components/ui/HubCard';

// Адаптивная секция главной EFT (R05): архетип задаёт изначальную расстановку
// блоков И карточек. Порядок диктуют данные (ROLE_HUBS + orderCardsByRole), не JSX (§4.7).
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

  // До регидрации порядок каталога ещё не известен → рендерим исходный (rookie-эквивалент
  // по данным), плюс скелетон-надстройку сверху. Форма контента, не спиннер (§8).
  if (!hydrated) {
    return (
      <>
        <section className="mb-10 flex flex-col gap-4">
          <div className="h-5 w-64 animate-pulse rounded-xs bg-lines-hover" />
          <div className="tactical-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-[348/160] w-full animate-pulse rounded-lg bg-lines-hover md:col-span-2" />
            ))}
          </div>
        </section>
        <CatalogGrid cards={orderCardsByRole(catalog, 'rookie')} />
      </>
    );
  }

  const hub = ROLE_HUBS[role];
  const label = ROLE_LABELS[role];
  const orderedCatalog = orderCardsByRole(catalog, role);

  return (
    <>
      {/* Персональный роль-блок — надстройка сверху (курированные ссылки под архетип). */}
      <section className="mb-10 flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Под твой стиль
          </span>
          <span className="text-sm font-blender-medium uppercase tracking-widest text-(--primary)">
            {label.name}
          </span>
        </div>
        <p className="text-sm font-blender-book text-text-secondary">{hub.intro}</p>
        <div className="tactical-grid">
          {hub.links.map((link, index) => (
            <HubCard
              key={link.id}
              gameId="eft"
              id={link.id}
              title={link.title}
              description={link.description}
              href={link.href}
              iconPath={link.iconPath}
              variant="rectangle"
              index={index}
            />
          ))}
        </div>
      </section>

      {/* Полный каталог — те же карточки, переупорядоченные под архетип. */}
      <div className="mb-3 flex items-baseline">
        <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Все разделы
        </span>
      </div>
      <CatalogGrid cards={orderedCatalog} />
    </>
  );
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
