'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useEntitlements } from '@/components/features/subscription/GatingProvider';
import { TIERS, type GatedFeature } from '@/data/subscription-tiers';
import { defaultGate, type GateBehavior } from '@/data/gate-registry';

interface PaywallProps {
  /** Новый путь: любой ключ гейта (feature-slug или sec:<game>:<path>). */
  gate?: string;
  /** Обратная совместимость: 10 существующих <Paywall feature="…">. Алиас gate. */
  feature?: GatedFeature;
  children: ReactNode;
  /** Своя заглушка вместо апселл-карточки (напр. в плотных списках / для teaser). */
  fallback?: ReactNode;
}

/**
 * Гейт по подписке. Ключ — `gate` (новый) или `feature` (алиас, обратная совместимость).
 * Порог/behavior берутся из снимка <GatingProvider> (через useSubscription/useEntitlements),
 * без сети на каждый замок; нет провайдера — деградация на дефолт реестра (не падаем).
 *
 * Behavior: lock → апселл-карточка PaywallLock; hide → null (спрятать); teaser → fallback
 * (если передан) иначе PaywallLock. Пока грузится — скелетон (animate-pulse), не спиннер.
 */
export function Paywall({ gate, feature, children, fallback }: PaywallProps) {
  const key = gate ?? feature;
  const { has, loading } = useSubscription();
  const snapshot = useEntitlements();

  // Нет ключа — считаем открытым (защитно; типы требуют хотя бы один в вызовах).
  if (!key) return <>{children}</>;

  if (loading) {
    return <div className="h-24 w-full animate-pulse rounded-md bg-card-menu" aria-hidden="true" />;
  }
  if (has(key)) return <>{children}</>;

  // Порог и behavior: из снимка карты, иначе дефолт реестра (fail-safe).
  const resolved = snapshot?.gates[key] ?? defaultGate(key);
  const behavior: GateBehavior = resolved.behavior;
  const need = resolved.minTier;

  if (behavior === 'hide') return null;
  // fallback учитывается ТОЛЬКО для teaser; lock всегда рисует апселл-карточку.
  if (behavior === 'teaser' && fallback !== undefined) return <>{fallback}</>;

  return (
    <PaywallLock
      need={need}
      needTier={snapshot?.tiers.find((t) => t.slug === need)}
      pricingPublished={snapshot?.pricingPublished ?? false}
    />
  );
}

/**
 * Апселл-карточка нужного тира. need — slug; имя/цена берём из снимка карты тиров
 * (если провайдер смонтирован), иначе из дефолтного каталога TIERS, иначе — сам slug.
 *
 * Цена печатается ТОЛЬКО при опубликованной витрине: до включения тумблера ни одна цифра
 * не показывается нигде на портале (публичная оферта ещё черновик). Тон — сухая
 * констатация без продающего нажима, решение V4DYA 06.09.
 */
function PaywallLock({
  need,
  needTier,
  pricingPublished,
}: {
  need: string;
  needTier?: { name: string; price: number };
  pricingPublished: boolean;
}) {
  const known = need in TIERS ? TIERS[need as keyof typeof TIERS] : null;
  const name = needTier?.name ?? known?.name ?? need;
  const price = needTier?.price ?? known?.price ?? 0;
  const showPrice = pricingPublished && price > 0;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-(--primary)/40">
        <Lock className="h-5 w-5 text-(--primary)" />
      </div>
      <h3 className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)">
        Тир «{name}»
      </h3>
      <p className="max-w-xs text-sm text-text-secondary font-blender-book">
        Доступ по подписке «{name}»{showPrice ? ` — ${price} ₽/мес` : ''}. Ядро сайта
        остаётся бесплатным.
      </p>
      {pricingPublished ? (
        <Link
          href="/pricing"
          className="font-blender-medium text-type-micro uppercase tracking-widest text-(--primary) underline-offset-4 hover:underline"
        >
          Сравнить тарифы
        </Link>
      ) : null}
    </div>
  );
}
