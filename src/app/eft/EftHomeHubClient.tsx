'use client';

import { useEffect } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { FEATURE_BY_ID, ARCHETYPE_FEATURES } from '@/data/feature-catalog';
import { HubCard } from '@/components/ui/HubCard';

// Главная EFT (R05): рендерит ИЗБРАННЫЙ НАБОР активного архетипа как HubCard'ы.
// Набор и его порядок — данные (ARCHETYPE_FEATURES + FEATURE_CATALOG), не JSX (§4.7).
// Карты (maps) идут первыми крупной плиткой (feature.big → variant 'square'), прочие — 'rectangle'.
// Роль живёт в localStorage → регидрация skipHydration-стора как у AdaptiveHubClient.

export function EftHomeHubClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  // Дефолт rookie зашит в effectiveRoleFor: аноним/нет данных → осмысленный набор новичка, не пусто.
  const role = useRoleStore((s) => effectiveRoleFor(s, activeId));

  // Набор активного архетипа: id → фича каталога (порядок значим, Карты первыми).
  const features = ARCHETYPE_FEATURES[role]
    .map((id) => FEATURE_BY_ID[id])
    .filter((f) => f !== undefined);

  // До регидрации роль ещё не известна → скелетон формы будущей сетки (§8: форма контента,
  // animate-pulse, не спиннер). Число и форма ячеек = набору активного архетипа
  // (big-square для maps, rectangle для прочих).
  if (!hydrated) {
    return (
      <div className="tactical-grid">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={
              feature.big
                ? 'aspect-square w-full animate-pulse rounded-lg bg-lines-hover md:col-span-2 md:row-span-2'
                : 'aspect-[348/160] w-full animate-pulse rounded-lg bg-lines-hover md:col-span-2'
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="tactical-grid">
      {features.map((feature, index) => (
        <HubCard
          key={feature.id}
          gameId="eft"
          id={feature.id}
          title={feature.name}
          description={feature.description}
          href={feature.href}
          iconPath={feature.iconPath}
          variant={feature.big ? 'square' : 'rectangle'}
          index={index}
        />
      ))}
    </div>
  );
}
