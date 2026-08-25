import { Lock } from 'lucide-react';
import type { TierSnapshot } from '@/lib/gating/resolve';

/**
 * Серверная апселл-карточка раздела (RSC-safe, без хуков/'use client'). Рендерится в
 * RSC раздела вместо контента, когда серверный requireTier вернул отказ с behavior='lock'
 * (прямой заход премиум-раздела без тира). Визуально сходна с клиентским PaywallLock из
 * Paywall.tsx, но её можно вызывать напрямую из Server Component без монтирования провайдера.
 *
 * `need` — slug требуемого тира; имя/цена берутся из снимка тиров (serverEntitlementsSnapshot),
 * иначе показываем сам slug. NIGHTFALL-токены, без литерального hex.
 */
export function SectionPaywall({
  need,
  needTier,
}: {
  need: string;
  needTier?: Pick<TierSnapshot, 'name' | 'price'>;
}) {
  const name = needTier?.name ?? need;
  const price = needTier?.price ?? 0;
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-14 pb-14">
      <div className="flex w-full max-w-275 flex-col items-center gap-3 rounded-md border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-(--primary)/40">
          <Lock className="h-5 w-5 text-(--primary)" />
        </div>
        <h1 className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)">
          Тир «{name}»
        </h1>
        <p className="max-w-xs text-sm text-text-secondary font-blender-book">
          Раздел доступен по подписке «{name}»
          {price > 0 ? ` — ${price} ₽/мес` : ''}. Ядро сайта остаётся бесплатным.
        </p>
      </div>
    </main>
  );
}
