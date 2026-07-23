import type { Metadata } from 'next';
import Link from 'next/link';
import { AmmoClient } from './AmmoClient';

export const metadata: Metadata = { title: 'Патрон решает | Кто ты в Игре | ЦТА' };

export default function AmmoStagePage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-150 px-4 xl:px-0">
        <Link
          href="/eft/progress/rookie"
          className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary transition-colors hover:text-(--primary)"
        >
          ← Путь Новобранца
        </Link>
        <header className="mt-3 mb-7">
          <div className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">
            Этап 09
          </div>
          <h1 className="mt-1 text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">
            Патрон решает
          </h1>
          <p className="mt-2 text-sm font-blender-book text-text-secondary">
            Выбери патрон и класс брони, стреляй — и увидь, почему дешёвый ствол с правильным патроном страшнее дорогого.
          </p>
        </header>
        <AmmoClient />
      </div>
    </main>
  );
}
