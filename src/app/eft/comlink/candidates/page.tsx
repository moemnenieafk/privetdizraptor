import type { Metadata } from 'next';
import { getMe } from '@/lib/auth/me';
import { CandidatesClient } from '@/components/features/comlink/CandidatesClient';

// «Кандидаты» — фундамент раздела «Связь»: анкеты игроков с живыми данными из
// трекера и кармой. Статический сегмент перебивает [section] (там жила заглушка).
//
// Auth проверяем на сервере, чтобы неавторизованному не мигал пустой список:
// сразу рендерим «войдите». Список — клиентский (фильтры + приватные данные).

export const metadata: Metadata = {
  title: 'Кандидаты · Связь · ЦТА',
  description: 'Анкеты игроков, ищущих команду или сокомандников. Живые данные из трекера и карма доверия.',
  robots: { index: false, follow: true },
};

export default async function CandidatesPage() {
  const me = await getMe();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <img src="/icons/eft/00-nav/comlink-icon.svg" alt="" className="h-8 w-8" />
            <h1 className="font-blender-medium text-3xl uppercase tracking-widest text-text-primary">
              Кандидаты
            </h1>
          </div>
          <p className="max-w-xl font-blender-book text-sm text-text-secondary">
            Анкеты бойцов: уровень и фракция — из трекера ЦТА, доверие — из подтверждённых
            рейдов. Связь через Discord-сервер сообщества.
          </p>
        </header>

        <CandidatesClient authorized={me !== null} />
      </div>
    </main>
  );
}
