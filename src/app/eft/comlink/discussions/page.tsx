import type { Metadata } from 'next';
import { getMe } from '@/lib/auth/me';
import { DiscussionsClient } from '@/components/features/comlink/DiscussionsClient';

// «Обсуждения» — седьмой подраздел «Связи» (решение V4DYA): форум по игре.
// Роут новый, в [section]-заглушках его не было — конфликтов нет.

export const metadata: Metadata = {
  title: 'Обсуждения · Связь · ЦТА',
  description: 'Темы по игре: мета, споты, патчи. У каждого автора виден уровень доверия.',
  robots: { index: false, follow: true },
};

export default async function DiscussionsPage() {
  const me = await getMe();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <DiscussionsClient authorized={me !== null} />
      </div>
    </main>
  );
}
