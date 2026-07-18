import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EntityComments } from '@/components/features/comments/EntityComments';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { draftMode } from 'next/headers';
import { getArticle } from '@/db/articles';
import { getMe } from '@/lib/auth/me';
import { canEditContent } from '@/lib/auth/roles';

/** Черновик открывается только CMS-роли и только в режиме черновика. */
async function draftAllowed(): Promise<boolean> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return false;
  const me = await getMe();
  return canEditContent(me?.role ?? 'user');
}

// Разбор патча: НАШ русский текст. Оригинал патчноута BSG не воспроизводим —
// показываем выжимку и отправляем к первоисточнику.

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug, await draftAllowed());
  if (!a) return { title: 'Патч не найден · ЦТА' };
  return {
    title: `${a.title} — разбор · ЦТА`,
    description: a.excerpt.slice(0, 160),
  };
}

export default async function PatchDetailPage({ params }: Props) {
  const { slug } = await params;
  const a = await getArticle(slug, await draftAllowed());
  if (!a || a.kind !== 'patch') notFound();

  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14 animate-[fade-in_0.5s_ease-out_both]">
      <article className="w-full max-w-3xl px-4 xl:px-0">
        <Link
          href="/eft/gamesetting/game-updates"
          className="mb-5 inline-flex h-11 items-center gap-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Все обновления
        </Link>

        <h1 className="mb-2 font-blender-medium text-2xl uppercase tracking-widest text-text-primary md:text-3xl">
          {a.title}
        </h1>
        <p className="mb-6 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {new Date(a.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          {a.authorName ? ` · разбор: ${a.authorName}` : ''}
        </p>

        {a.bodyRu ? (
          <div className="whitespace-pre-wrap font-blender-book text-base leading-relaxed text-text-primary">
            {a.bodyRu}
          </div>
        ) : (
          <p className="font-blender-book text-sm text-text-secondary">
            Разбор этого патча ещё готовится. Полный текст обновления — в оригинале по ссылке ниже.
          </p>
        )}

        {a.externalUrl && (
          <a
            href={a.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 flex h-11 w-fit items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Полный патчноут в Steam
          </a>
        )}
      </article>

      <EntityComments type="patch" id={slug} />
    </main>
  );
}
