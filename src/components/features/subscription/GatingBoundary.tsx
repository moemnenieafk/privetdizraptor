import type { ReactNode } from 'react';
import { serverEntitlementsSnapshot } from '@/lib/gating/resolve';
import { GatingProvider } from './GatingProvider';
import { TierPreviewBadge } from './TierPreviewBadge';

/**
 * Серверная обёртка: собирает снимок прав текущего юзера (serverEntitlementsSnapshot,
 * fail-safe в free) и кладёт его в клиентский <GatingProvider>. Монтируется в root
 * layout вокруг children (в Suspense) — так весь клиент читает гейтинг из контекста
 * без сети на каждый <Paywall>. Игра по умолчанию 'eft' (эталон портала).
 */
export async function GatingBoundary({ children }: { children: ReactNode }) {
  const snap = await serverEntitlementsSnapshot();
  return (
    <GatingProvider {...snap}>
      {children}
      {/* Ничего не рисует, пока админ не включил «просмотр от лица тира». */}
      <TierPreviewBadge />
    </GatingProvider>
  );
}
