import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  LOOT_CONTAINERS,
  LOOT_CONTAINER_KINDS,
  containerImage,
} from '@/data/loot-containers';

export const metadata = {
  title: 'Лут-контейнеры — ЦТА',
  description: 'Что можно найти в контейнерах Escape from Tarkov — таблицы добычи и ценность лута.',
};

export default function LootContainersPage() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-4 pb-14 animate-[fade-in-up_0.5s_ease-out_both]">
      <div className="mx-auto w-full max-w-275 px-4 xl:px-0">
        <PageHeader
          title="Лут-контейнеры"
          description="Что можно найти в контейнерах Таркова — таблицы добычи и ценность лута."
          iconClass="icon-eft-loot-containers"
          count={LOOT_CONTAINERS.length}
        />

        {LOOT_CONTAINER_KINDS.map((kind) => {
          const items = LOOT_CONTAINERS.filter((c) => c.kind === kind.id);
          if (items.length === 0) return null;
          return (
            <section key={kind.id} className="mb-10">
              <h2 className="mb-4 font-blender-medium text-sm uppercase tracking-widest text-text-muted">
                {kind.label}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/eft/loot-containers/${c.slug}`}
                    className="flex items-center gap-3 rounded-md border border-lines-hover bg-card-menu p-3 transition-colors hover:border-(--primary)"
                  >
                    <img
                      src={containerImage(c.file)}
                      alt=""
                      className="h-12 w-12 shrink-0 object-contain"
                      loading="lazy"
                    />
                    <span className="font-blender-book text-sm text-text-primary">{c.nameRu}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
