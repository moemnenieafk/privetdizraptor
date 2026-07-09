import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LOOT_CONTAINERS, containerBySlug, containerImage } from '@/data/loot-containers';

export function generateStaticParams() {
  return LOOT_CONTAINERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const container = containerBySlug(slug);
  return { title: container ? `${container.nameRu} — Лут-контейнеры — ЦТА` : 'Лут-контейнеры — ЦТА' };
}

export default async function LootContainerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const container = containerBySlug(slug);
  if (!container) notFound();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in-up_0.5s_ease-out_both]">
      <div className="mx-auto w-full max-w-275 px-4 xl:px-0">
        <Link
          href="/eft/loot-containers"
          className="mb-6 inline-flex items-center gap-2 font-blender-medium text-sm text-text-secondary transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-4 w-4" /> Все контейнеры
        </Link>

        <div className="mb-8 flex items-center gap-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-lines-hover bg-card-menu">
            <img src={containerImage(container.file)} alt="" className="h-16 w-16 object-contain" />
          </div>
          <div>
            <h1 className="text-[28px] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
              {container.nameRu}
            </h1>
            <p className="mt-2 font-blender-book text-sm text-text-secondary">
              Таблица добычи и ценность лута
            </p>
          </div>
        </div>

        {/* Таблица лута — Фаза 2 (SPT staticLoot). Пока плейсхолдер-скелетон. */}
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-6 py-16 text-center">
          <div className="h-8 w-8 animate-pulse rounded-xs bg-(--primary) opacity-70" aria-hidden="true" />
          <h2 className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)">
            Таблица лута скоро
          </h2>
          <p className="max-w-sm font-blender-book text-sm text-text-secondary">
            Содержимое собирается из игровых файлов. Здесь появятся предметы, шанс их выпадения и ценность лута.
          </p>
        </div>
      </div>
    </main>
  );
}
