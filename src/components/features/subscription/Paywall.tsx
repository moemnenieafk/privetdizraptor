'use client';

import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { requiredTier, TIERS, type GatedFeature, type TierId } from '@/data/subscription-tiers';

interface PaywallProps {
  feature: GatedFeature;
  children: ReactNode;
  /** Своя заглушка вместо апселл-карточки (напр. в плотных списках). */
  fallback?: ReactNode;
}

/**
 * Гейт по подписке. Пока грузится — скелетон (не спиннер). Есть доступ — контент,
 * иначе — апселл-карточка нужного тира (или переданный fallback).
 */
export function Paywall({ feature, children, fallback }: PaywallProps) {
  const { has, loading } = useSubscription();

  if (loading) {
    return <div className="h-24 w-full animate-pulse rounded-md bg-card-menu" aria-hidden="true" />;
  }
  if (has(feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  return <PaywallLock need={requiredTier(feature)} />;
}

function PaywallLock({ need }: { need: TierId }) {
  const tier = TIERS[need];
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-(--primary)/40">
        <Lock className="h-5 w-5 text-(--primary)" />
      </div>
      <h3 className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)">
        Тир «{tier.name}»
      </h3>
      <p className="max-w-xs text-sm text-text-secondary font-blender-book">
        Функция доступна по подписке «{tier.name}»
        {tier.price > 0 ? ` — ${tier.price} ₽/мес` : ''}. Ядро сайта остаётся бесплатным.
      </p>
    </div>
  );
}
