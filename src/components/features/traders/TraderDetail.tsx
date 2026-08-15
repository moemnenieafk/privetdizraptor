import Image from 'next/image';
import Link from 'next/link';
import type { Trader } from '@/data/traders';

const QUEST_SLUGS = new Set([
  'prapor', 'therapist', 'fence', 'skier', 'peacekeeper',
  'mechanic', 'ragman', 'jaeger', 'ref', 'lightkeeper', 'btr-driver',
]);

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{label}</span>
      <span className="text-sm text-text-primary font-blender-book">{value}</span>
    </div>
  );
}

export function TraderDetail({ trader }: { trader: Trader }) {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-16">
      <div className="w-full max-w-275 px-4 xl:px-0">
        <Link href="/eft/gamesetting/traders" className="mb-6 inline-block text-type-caption font-blender-medium uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)">
          ← Все торговцы
        </Link>

        <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-lines-hover bg-(--color-darkbase)">
            <Image src={trader.image} alt={trader.nameRu} fill className="object-cover object-top" sizes="240px" priority />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-blender-medium uppercase tracking-widest text-text-primary">{trader.nameRu}</h1>
              <p className="text-sm uppercase tracking-widest text-text-muted">{trader.nameEn}</p>
            </div>
            <div className="grid grid-cols-[15rem_1fr] gap-4">
              <Info label="Локация" value={trader.location} />
              <Info label="Валюта" value={trader.currency} />
              <Info label="Специализация" value={trader.specializes} />
            </div>

            <section className="rounded-md border border-lines-hover bg-card-menu p-5">
              <h2 className="mb-3 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">Досье</h2>
              <p className="text-sm leading-relaxed text-text-secondary font-blender-book">{trader.description}</p>
            </section>

            {QUEST_SLUGS.has(trader.slug) && (
              <Link
                href={`/eft/quests/${trader.slug}`}
                className="inline-flex w-fit items-center gap-2 rounded border border-lines-hover bg-card-menu px-4 py-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                Задания торговца →
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
