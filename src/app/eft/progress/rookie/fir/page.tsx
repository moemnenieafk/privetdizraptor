import type { Metadata } from 'next';
import Link from 'next/link';
import { FirClient } from './FirClient';

export const metadata: Metadata = { title: 'Найдено в рейде | Путь Новобранца | ЦТА' };

export default function FirStagePage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-150 px-4 xl:px-0">
        <Link
          href="/eft/progress/rookie/path"
          className="text-type-label font-blender-medium uppercase tracking-wide text-text-secondary transition-colors hover:text-(--primary)"
        >
          ← Путь Новобранца
        </Link>
        <header className="mt-3 mb-7">
          <div className="text-type-label font-blender-medium uppercase tracking-widest text-text-secondary">
            Этап 04
          </div>
          <h1 className="mt-1 text-[1.75rem] font-blender-medium uppercase tracking-widest text-text-primary">
            Найдено в рейде
          </h1>
          <p className="mt-2 text-sm font-blender-book text-text-secondary">
            Метка «⛏ Найдено в рейде» ломает больше новичков, чем пули. Разбери по карточкам, где её ищут.
          </p>
        </header>
        <FirClient />
      </div>
    </main>
  );
}
