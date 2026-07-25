import type { Metadata } from 'next';
import Link from 'next/link';
import { ArcadeHost } from '@/components/features/arcade/ArcadeHost';

export const metadata: Metadata = { title: 'Зал автоматов | Кто ты в Игре | ЦТА' };

export default function ArcadePage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/eft/progress/rookie"
          className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary transition-colors hover:text-(--primary)"
        >
          ← Кто ты в Игре
        </Link>
        <header className="mt-3 mb-7">
          <div className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Мини-игры
          </div>
          <h1 className="mt-1 text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">
            Зал автоматов
          </h1>
          <p className="mt-2 text-sm font-blender-book text-text-secondary">
            Занял очередь в рейд — разомнись на автомате. Аркадные мини-игры по вселенной Таркова.
          </p>
        </header>
        <ArcadeHost />
      </div>
    </main>
  );
}
