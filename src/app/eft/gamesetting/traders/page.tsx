import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { TRADERS } from '@/data/traders';

export const metadata: Metadata = { title: 'Торговцы | Кодекс ЦТА' };

// Индекс торговцев. Статический маршрут — перекрывает gamesetting/[slug] для «traders».
export default function TradersIndexPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Торговцы</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Досье на торговцев Таркова: кто они, где, чем торгуют. Нажмите карточку для подробностей и заданий.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRADERS.map((t) => (
            <Link
              key={t.slug}
              href={`/eft/gamesetting/traders/${t.slug}`}
              className="group flex gap-4 overflow-hidden rounded-md border border-lines-hover bg-card-menu p-3 transition-colors hover:border-(--primary)"
            >
              <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xs border border-lines-hover bg-(--color-darkbase)">
                <Image src={t.image} alt={t.nameRu} fill className="object-cover object-top" sizes="64px" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-blender-medium uppercase tracking-wide text-text-primary transition-colors group-hover:text-(--primary)">{t.nameRu}</h2>
                <p className="text-type-caption uppercase tracking-widest text-text-muted">{t.location}</p>
                <p className="mt-1 line-clamp-2 text-sm text-text-secondary font-blender-book">{t.specializes}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
