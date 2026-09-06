import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTierShowcase, isPricingPublished } from '@/lib/gating/showcase';
import { resolveEntitlements } from '@/lib/gating/resolve';
import { getMe } from '@/lib/auth/me';
import { TierCard, TierCtaPending } from '@/components/features/subscription/TierCard';

export const metadata: Metadata = {
  title: 'Тарифы — ЦТА',
  description: 'Уровни доступа ЦТА: что входит в бесплатное ядро и что открывает подписка.',
};

// Читаем БД в рантайме: на сборке порт 5432 закрыт (§4.13). Без этого падает деплой.
export const dynamic = 'force-dynamic';

/**
 * Публичная витрина тарифов. Доступна анониму (RLS-политика tiers_read открыта для anon
 * ровно под этот случай), но только при включённом тумблере sys:pricing-published —
 * иначе 404. Тумблер живёт в /admin/billing и включается без деплоя.
 *
 * Состав тарифов НЕ захардкожен: считается из матрицы гейтов (lib/gating/showcase.ts),
 * поэтому страница всегда совпадает с тем, что реально закрывает пейвол.
 */
export default async function PricingPage() {
  const published = await isPricingPublished();
  if (!published) notFound();

  const me = await getMe();
  const [showcase, entitlements] = await Promise.all([
    getTierShowcase(),
    resolveEntitlements(me?.id ?? null),
  ]);

  return (
    <main className="flex w-full flex-col items-center pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-5xl px-4">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          На главную
        </Link>

        <h1 className="font-blender-medium text-type-h2 uppercase tracking-widest text-text-primary">
          Тарифы
        </h1>
        <p className="mt-2 max-w-2xl font-blender-book text-type-body text-text-secondary">
          Ядро портала — карты, задания, предметы, кодекс, видео и связь — остаётся
          бесплатным. Подписка открывает удобства: облачную синхронизацию, безлимит сборок
          и аналитику.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {showcase.map((tier) => (
            <TierCard
              key={tier.slug}
              tier={tier}
              pricingPublished
              isCurrent={tier.slug === entitlements.tier}
              action={
                tier.rank > 0 && tier.slug !== entitlements.tier ? (
                  <TierCtaPending tierName={tier.name} />
                ) : undefined
              }
            />
          ))}
        </div>

        <p className="mt-8 font-blender-book text-type-caption text-text-muted">
          Условия платных услуг — в{' '}
          <Link href="/legal/offer" className="underline underline-offset-4 hover:text-(--primary)">
            публичной оферте
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
