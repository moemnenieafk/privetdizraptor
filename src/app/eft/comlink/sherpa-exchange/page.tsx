import type { Metadata } from 'next';
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

// Рендер в рантайме: на сборке БД недоступна (порт 5432 закрыт наружу, §4.11).
export const dynamic = "force-dynamic";

export default async function SherpaExchangePage() {
  const me = await getMe();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <SherpaExchangeClient authorized={me !== null} />
      </div>
    </main>
  );
}
