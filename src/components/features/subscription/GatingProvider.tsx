'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { GateMap, TierSnapshot } from '@/lib/gating/resolve';

/**
 * Снимок гейтинга, положенный из RSC в контекст: карта гейтов + тиры + эффективный тир
 * пользователя и его ранг. Клиент (<Paywall>, useSubscription) читает его отсюда, без
 * сетевого запроса на каждый замок. Собирается serverEntitlementsSnapshot() в RSC.
 */
export interface GatingSnapshot {
  tier: string;
  rank: number;
  tiers: TierSnapshot[];
  gates: GateMap;
  /** Витрина цен опубликована — иначе клиент не печатает ни одной цифры цены. */
  pricingPublished: boolean;
  /** Админ смотрит от лица тира (плашка-индикатор). null — обычный просмотр. */
  previewTier: string | null;
}

const GatingContext = createContext<GatingSnapshot | null>(null);

interface GatingProviderProps extends GatingSnapshot {
  children: ReactNode;
}

/**
 * Кладёт снимок прав в React-контекст. Монтируется высоко в дереве из RSC:
 *   const snap = await serverEntitlementsSnapshot();
 *   <GatingProvider {...snap}>{children}</GatingProvider>
 * Отсутствие провайдера НЕ ломает клиент — потребители деградируют на дефолты.
 */
export function GatingProvider({
  children,
  tier,
  rank,
  tiers,
  gates,
  pricingPublished,
  previewTier,
}: GatingProviderProps) {
  return (
    <GatingContext.Provider
      value={{ tier, rank, tiers, gates, pricingPublished, previewTier }}
    >
      {children}
    </GatingContext.Provider>
  );
}

/** Снимок прав из контекста; null — провайдер не смонтирован (fail-safe у потребителя). */
export function useEntitlements(): GatingSnapshot | null {
  return useContext(GatingContext);
}
