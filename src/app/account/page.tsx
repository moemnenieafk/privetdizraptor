import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMe, getAccountStats } from '@/lib/auth/me';
import { AccountCenter } from './AccountCenter';

export const metadata: Metadata = {
  title: 'Аккаунт Центр — CTA',
  description: 'Управление профилем, безопасностью и подпиской CTA.',
};

export default async function AccountPage() {
  // Server-гард: кабинет только для залогиненных.
  const me = await getMe();
  if (!me) redirect('/login?next=/account');
  const stats = await getAccountStats(me.id);
  return <AccountCenter me={me} stats={stats} />;
}
