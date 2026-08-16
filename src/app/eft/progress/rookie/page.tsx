import type { Metadata } from 'next';
import Link from 'next/link';
import { ArcadeHost } from '@/components/features/arcade/ArcadeHost';
import { getRushDeck } from '@/lib/eft-barter-rush';

export const metadata: Metadata = { title: 'Аркады | Прогресс ЦТА' };

// Колода бартеров для game03 зеркалится из нашей Supabase (как /eft/progress/barter).
export const revalidate = 3600;

// Индекс раздела «Аркады» = зал автоматов (мини-игры). Туториал «Путь Новобранца»
// переехал в подраздел /eft/progress/rookie/path (инверсия прежней вложенности).
export default async function ArcadeHubPage() {
  const barterDeck = await getRushDeck();
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-7">
          <div className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Мини-игры
          </div>
          <h1 className="mt-1 text-[1.75rem] font-blender-medium uppercase tracking-widest text-text-primary">
            Зал автоматов
          </h1>
          <p className="mt-2 text-sm font-blender-book text-text-secondary">
            Занял очередь в рейд — разомнись на автомате. Аркадные мини-игры по вселенной Таркова.
          </p>
        </header>

        <ArcadeHost initialBarters={barterDeck} />

        <section className="mt-10 flex flex-col gap-4">
          <h2 className="text-sm font-blender-medium uppercase tracking-widest text-text-primary">Новичку</h2>
          <Link
            href="/eft/progress/rookie/path"
            className="group flex items-center gap-4 rounded-xs border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-blender-medium text-xs uppercase tracking-wide text-text-primary">
                Путь Новобранца
              </span>
              <span className="truncate text-type-label font-blender-book text-text-secondary">
                Не понимаешь Тарков? Пройди курс из 10 этапов — учим мир игры по шагам.
              </span>
            </div>
            <span className="shrink-0 font-blender-medium text-type-label uppercase tracking-wide text-(--primary) opacity-70 transition-opacity group-hover:opacity-100">
              Начать
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
