import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe, getAccountStats } from '@/lib/auth/me';
import { getEftAchievements, getEftMaps, getEftTraders } from '@/db/landing';
import { getHideoutNeeds, getHideoutStations } from '@/db/hideout';
import { resolveAchievementHint, type AchievementHint } from '@/lib/achievement-hints';
import { buildQuestsDigest } from '@/lib/tracking-digest';
import { getSubscription } from '@/lib/subscription.server';
import { AccountCenter } from './AccountCenter';

export const metadata: Metadata = {
  title: 'Аккаунт Центр — CTA',
  description: 'Управление профилем, безопасностью и подпиской CTA.',
};

export default async function AccountPage() {
  // Server-гард: кабинет только для залогиненных.
  const me = await getMe();
  if (!me) redirect('/login?next=/account');
  const [stats, sub, achievements, maps, traders, hideoutNeeds, hideoutStations] = await Promise.all([
    getAccountStats(me.id),
    getSubscription(me.id),
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
      stats={stats}
      achievements={achievements}
      hints={hints}
      questsDigest={questsDigest}
      hideoutNeeds={hideoutNeeds}
      hideoutStations={hideoutStations}
    />
  );
}
