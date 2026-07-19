import type { Metadata } from 'next';
import { getMe } from '@/lib/auth/me';
import { MyRaidsClient } from '@/components/features/comlink/MyRaidsClient';

// «Поиск напарника» = мои связи: входящие заявки, подтверждения, оценки.
// Анкеты живут в «Кандидатах» — сюда человек приходит ПОСЛЕ того, как сыграл.
// Статический сегмент перебивает [section] (там жила заглушка).

export const metadata: Metadata = {
  title: 'Поиск напарника · Связь · ЦТА',
  description: 'Заявки на совместные рейды, подтверждения и оценки напарников.',
  robots: { index: false, follow: true },
};

export default async function FindPartnerPage() {
  const me = await getMe();

  return (
    <main className="flex w-full flex-col items-center justify-start pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <MyRaidsClient authorized={me !== null} />
      </div>
    </main>
  );
}
