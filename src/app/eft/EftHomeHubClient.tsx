'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { ROLE_LABELS } from '@/lib/role-inference';
import { ROLE_HUBS } from '@/data/role-hubs';
import { HubCard } from '@/components/ui/HubCard';

// Адаптивная секция главной EFT (R05): архетип задаёт ИЗНАЧАЛЬНУЮ расстановку.
// Порядок/набор карточек диктует ROLE_HUBS[effectiveRole] (данные, не JSX — §4.7).
// Server-обёртка /eft/page.tsx рендерит полный каталог EFT_HUB_CARDS ниже.
// Роль живёт в localStorage → регидрация skipHydration-стора как у AdaptiveHubClient.

export function EftHomeHubClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  // Дефолт rookie зашит в effectiveRoleFor: аноним/нет данных → осмысленный блок новичка, не пусто.
  const role = useRoleStore((s) => effectiveRoleFor(s, activeId));

  // Скелетон показывает форму будущего блока (§8): заголовок + сетка карточек.
  if (!hydrated) {
    return (
      <section className="mb-10 flex flex-col gap-4">
        <div className="h-5 w-64 animate-pulse rounded-xs bg-lines-hover" />
        <div className="tactical-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[348/160] w-full animate-pulse rounded-lg bg-lines-hover md:col-span-2" />
          ))}
        </div>
      </section>
    );
  }

  const hub = ROLE_HUBS[role];
  const label = ROLE_LABELS[role];

  return (
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
  );
}
