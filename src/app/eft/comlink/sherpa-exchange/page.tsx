import type { Metadata } from 'next';
import Link from 'next/link';
import { getMe } from '@/lib/auth/me';
import { SherpaExchangeClient } from '@/components/features/comlink/SherpaExchangeClient';

// «Биржа шерпов» — наставники поверх анкет (goal='sherpa') с честной статистикой:
// сессии и доля положительных отзывов вместо значка. Статический сегмент перебивает
// [section] (там жила заглушка).

export const metadata: Metadata = {
  title: 'Биржа шерпов · Связь · ЦТА',
  description: 'Опытные наставники помогают новичкам. Доверие — из подтверждённых сессий и кармы.',
  robots: { index: false, follow: true },
};

export default async function SherpaExchangePage() {
  const me = await getMe();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <img src="/icons/eft/00-nav/comlink-icon.svg" alt="" className="h-8 w-8" />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Биржа шерпов
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Наставники со статистикой: подтверждённые сессии, доля положительных отзывов,
            карма. Хотите обучать сами — создайте анкету «Готов обучать» в{' '}
            <Link href="/eft/comlink/candidates" className="text-(--primary) hover:underline">
              Кандидатах
            </Link>
            : каждая подтверждённая сессия даёт +15 кармы.
          </p>
        </header>

        <SherpaExchangeClient authorized={me !== null} />
      </div>
    </main>
  );
}
