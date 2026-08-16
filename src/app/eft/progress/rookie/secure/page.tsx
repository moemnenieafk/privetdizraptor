import type { Metadata } from 'next';
import Link from 'next/link';
import { SecureClient } from './SecureClient';

export const metadata: Metadata = { title: 'Не потеряй всё | Путь Новобранца | ЦТА' };

export default function SecureStagePage() {
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
            Этап 03
          </div>
          <h1 className="mt-1 text-[1.75rem] font-blender-medium uppercase tracking-widest text-text-primary">
            Не потеряй всё
          </h1>
          <p className="mt-2 text-sm font-blender-book text-text-secondary">
            Смерть в Таркове забирает шмот. Разложи ценное по контейнеру, погибни — и увидь, что уцелело.
          </p>
        </header>
        <SecureClient />
      </div>
    </main>
  );
}
