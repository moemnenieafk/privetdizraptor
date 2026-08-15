import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LOOT_CONTAINERS, containerBySlug, containerImage } from '@/data/loot-containers';
import { getContainerLoot } from '@/data/loot/container-loot';
import { getEftPricesByIds } from '@/db/prices';
import type { EftPriceInfo } from '@/lib/eft-prices';
import { itemIconUrl } from '@/lib/item-icon';

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

  const loot = getContainerLoot(container.slug);

  let prices = new Map<string, EftPriceInfo>();
  if (loot && loot.items.length > 0) {
    try {
      prices = await getEftPricesByIds(loot.items.map((i) => i.tpl));
    } catch {
      prices = new Map<string, EftPriceInfo>();
    }
  }
  const bestSell = (tpl: string): number => {
    const offers = prices.get(tpl)?.sellFor;
    if (!offers) return 0;
    return offers.reduce((max, o) => Math.max(max, o.priceRUB ?? 0), 0);
  };

  const topCount = loot?.counts[0]?.count;

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
            <h1 className="text-[1.75rem] font-blender-medium leading-none tracking-tighter uppercase text-text-primary">
              {container.nameRu}
            </h1>
            <p className="mt-2 font-blender-book text-sm text-text-secondary">
              {loot && loot.items.length > 0
                ? `Таблица добычи${topCount ? ` · обычно ${topCount} предм.` : ''}`
                : 'Таблица добычи и ценность лута'}
            </p>
          </div>
        </div>

        {loot && loot.items.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-md border border-lines-hover">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-lines-hover text-left text-text-muted">
                    <th className="px-4 py-3 font-blender-medium text-xs uppercase tracking-widest">Предмет</th>
                    <th className="px-4 py-3 text-right font-blender-medium text-xs uppercase tracking-widest">Шанс</th>
                    <th className="px-4 py-3 text-right font-blender-medium text-xs uppercase tracking-widest">Ценность</th>
                  </tr>
                </thead>
                <tbody>
                  {loot.items.map((it) => {
                    const value = bestSell(it.tpl);
                    const slug = prices.get(it.tpl)?.normalizedName ?? '';
                    const cell = (
                      <>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs border border-lines-hover bg-card-menu">
                          <img src={itemIconUrl(it.tpl)} alt="" loading="lazy" className="h-8 w-8 object-contain" />
                        </span>
                        <span className="font-blender-book text-text-primary transition-colors group-hover:text-(--primary)">
                          {it.name}
                        </span>
                      </>
                    );
                    return (
                      <tr key={it.tpl} className="border-b border-lines-hover/50 transition-colors last:border-0 hover:bg-card-menu/40">
                        <td className="px-4 py-2">
                          {slug ? (
                            <Link href={`/eft/items/item/${slug}`} className="group flex items-center gap-3">
                              {cell}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3">{cell}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-blender-medium text-xs text-(--primary)">{it.prob}%</td>
                        <td className="px-4 py-2 text-right font-blender-medium text-xs text-text-secondary">
                          {value > 0 ? `${value.toLocaleString('ru-RU')} ₽` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-blender-book text-xs text-text-muted">
              Шансы — из игровых данных (SPT). Ценность — лучшая цена продажи из базы ЦТА (синхронизируется в фоне). Нажми на предмет — откроется его страница с полными ценами.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-6 py-16 text-center">
            <div className="h-8 w-8 animate-pulse rounded-xs bg-(--primary) opacity-70" aria-hidden="true" />
            <h2 className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)">Таблицы пока нет</h2>
            <p className="max-w-sm font-blender-book text-sm text-text-secondary">
              Для этого контейнера в игровых данных нет статической таблицы лута (напр. аирдроп/ивентовые).
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
