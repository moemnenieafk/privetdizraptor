import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/auth/me';
import { canModerate } from '@/db/comlink-forum';
import { ReportsQueueClient } from '@/components/features/comlink/ReportsQueueClient';

// Очередь жалоб. Не в меню: страница для своих (ты, Дима, добровольцы-модераторы).
// Для всех остальных — 404, чтобы сам факт её существования не светился.

export const metadata: Metadata = {
  title: 'Жалобы · Связь · ЦТА',
  robots: { index: false, follow: false },
};

export default async function ReportsPage() {
  const me = await getMe();
  if (!me || !canModerate(me.role)) notFound();

  return (
    <main className="flex w-full flex-col items-center justify-start pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <ReportsQueueClient />
      </div>
    </main>
  );
}
