import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Play } from 'lucide-react';
import { getArticle } from '@/db/articles';

// Статья блога или мастер-класс. Общий шаблон: kind различается только хлебной крошкой.

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return { title: 'Материал не найден · ЦТА' };
  return { title: `${a.title} · ЦТА`, description: a.excerpt.slice(0, 160) };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a || (a.kind !== 'news' && a.kind !== 'masterclass')) notFound();

  const backHref = a.kind === 'news' ? '/eft/comlink/blog' : '/eft/comlink/masterclasses';
  const backLabel = a.kind === 'news' ? 'Все статьи' : 'Все мастер-классы';

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <article className="w-full max-w-3xl px-4 xl:px-0">
        <Link
          href={backHref}
          className="mb-5 inline-flex h-11 items-center gap-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>

        {a.coverUrl && (
          <div className="mb-6 h-56 w-full overflow-hidden rounded-sm bg-(--color-darkbase)">
            <img src={a.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        <h1 className="mb-2 font-blender-medium text-2xl uppercase tracking-widest text-text-primary md:text-3xl">
          {a.title}
        </h1>

        <div className="mb-6 flex flex-wrap gap-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          <span>
            {new Date(a.publishedAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
          {a.authorName && <span>{a.authorName}</span>}
          {a.eventAt && (
            <span className="flex items-center gap-1.5 text-(--primary)">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {new Date(a.eventAt).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="whitespace-pre-wrap font-blender-book text-base leading-relaxed text-text-primary">
          {a.bodyRu || a.excerpt}
        </div>

        {a.videoUrl && (
          <a
            href={a.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Смотреть запись
          </a>
        )}
      </article>
    </main>
  );
}
