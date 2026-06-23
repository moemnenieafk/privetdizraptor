import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BOSSES } from '@/data/bosses';

export const metadata: Metadata = { title: 'Боссы Таркова | Кодекс ЦТА' };

// Индекс боссов. Статический маршрут — перекрывает gamesetting/[slug] для «bosses».
export default function BossesIndexPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-14">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <header className="mb-8">
          <h1 className="text-[28px] font-blender-medium uppercase tracking-widest text-text-primary">Боссы Таркова</h1>
          <p className="mt-2 text-sm text-text-secondary font-blender-book">
            Досье на боссов локаций: характеристики, HP по зонам, тактика и достоверный лор.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BOSSES.map((b) => (
            <Link
              key={b.slug}
              href={`/eft/gamesetting/bosses/${b.slug}`}
              className="group relative overflow-hidden rounded-md border border-lines-hover bg-card-menu transition-colors hover:border-(--primary)"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-(--color-darkbase)">
                <Image
                  src={b.portrait}
                  alt={b.nameRu}
                  fill
                  className="object-cover object-top opacity-90 transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-linear-to-t from-(--color-darkbase) via-transparent to-transparent" />
                {b.threat && (
                  <span className="absolute right-2 top-2 rounded border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-2 py-0.5 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
                    {b.threat}
                  </span>
                )}
              </div>
              <div className="p-4">
                <h2 className="text-lg font-blender-medium uppercase tracking-wide text-text-primary transition-colors group-hover:text-(--primary)">
                  {b.nameRu}
                </h2>
                <p className="text-type-caption uppercase tracking-widest text-text-muted">{b.role}</p>
                <p className="mt-1 text-sm text-text-secondary font-blender-book">{b.location}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
