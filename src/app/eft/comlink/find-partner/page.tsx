import type { Metadata } from 'next';
import Link from 'next/link';
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
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <img src="/icons/eft/00-nav/comlink-icon.svg" alt="" className="h-8 w-8" />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Поиск напарника
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Схема простая: нашли игрока в{' '}
            <Link href="/eft/comlink/candidates" className="text-(--primary) hover:underline">
              Кандидатах
            </Link>
            {' '}→ списались в Discord → сыграли → позвали его здесь. Подтверждённый рейд
            даёт +5 кармы обоим и открывает взаимную оценку.
          </p>
        </header>

        <MyRaidsClient authorized={me !== null} />
      </div>
    </main>
  );
}
