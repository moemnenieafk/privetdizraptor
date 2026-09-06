import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe, getAccountStats } from '@/lib/auth/me';
import { getEftAchievements, getEftMaps, getEftTraders } from '@/db/landing';
import { getHideoutNeeds, getHideoutStations } from '@/db/hideout';
import { resolveAchievementHint, type AchievementHint } from '@/lib/achievement-hints';
import { buildQuestsDigest } from '@/lib/tracking-digest';
import { getSubscription, getBillingHistory } from '@/lib/subscription.server';
import { getTierShowcase, isPricingPublished } from '@/lib/gating/showcase';
import { resolveEntitlements } from '@/lib/gating/resolve';
import { hasVerifiedTotp } from '@/lib/auth/mfa';
import { AccountCenter } from './AccountCenter';

export const metadata: Metadata = {
  title: 'Аккаунт Центр — CTA',
  description: 'Управление профилем, безопасностью и подпиской CTA.',
};

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // Server-гард: кабинет только для залогиненных.
  const me = await getMe();
  if (!me) redirect('/login?next=/account');
  const [
    stats,
    sub,
    billingHistory,
    showcase,
    pricingPublished,
    entitlements,
    twoFactorEnabled,
    achievements,
    maps,
    traders,
    hideoutNeeds,
    hideoutStations,
  ] = await Promise.all([
    getAccountStats(me.id),
    getSubscription(me.id),
    getBillingHistory(me.id),
    getTierShowcase(),
    isPricingPublished(),
    resolveEntitlements(me.id),
    hasVerifiedTotp(),
    getEftAchievements(),
    getEftMaps(),
    getEftTraders(),
    getHideoutNeeds(),
    getHideoutStations(),
  ]);
  // Дайджест квестов/предметов для вкладки «Трекинг»: лёгкие агрегаты из EFT_QUESTS
  // (полный статик 520 задач в клиент НЕ уходит).
  const questsDigest = await buildQuestsDigest();

  // SMART-подсказки для вкладки «Трекинг»: резолвим server-side для всех достижений
  // (дёшево — чистый стринг-матчинг), пустые не передаём (экономия payload).
  const hints: Record<string, AchievementHint> = {};
  for (const a of achievements) {
    const h = resolveAchievementHint(
      { id: a.id, name: a.name, description: a.description },
      { maps, traders },
    );
    if (h.links.length > 0 || h.tip) hints[a.id] = h;
  }

  return (
    <AccountCenter
      me={me}
      tier={sub.tier}
      validUntil={sub.validUntil}
      subSource={sub.source}
      autoRenew={sub.autoRenew}
      billingHistory={billingHistory}
      showcase={showcase}
      pricingPublished={pricingPublished}
      currentRank={entitlements.rank}
      effectiveTier={entitlements.tier}
      twoFactorEnabled={twoFactorEnabled}
      stats={stats}
      achievements={achievements}
      hints={hints}
      questsDigest={questsDigest}
      hideoutNeeds={hideoutNeeds}
      hideoutStations={hideoutStations}
    />
  );
}
