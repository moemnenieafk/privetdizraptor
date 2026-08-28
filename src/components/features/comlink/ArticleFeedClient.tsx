'use client';

// Лента материалов (Блог / Мастер-классы) + CMS поверх неё.
// Данные приезжают с сервера пропсами (RSC), клиент нужен только ради редактора.
import { useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Loader2, Pencil, Play, Plus } from 'lucide-react';
import { ArticleEditor, type EditorInitial } from '@/components/features/comlink/ArticleEditor';
import type { ArticleListItem } from '@/db/articles';
import type { ArticleKind } from '@/db/schema-articles';

interface ArticleFeedClientProps {
  kind: Exclude<ArticleKind, 'patch'>;
  items: ArticleListItem[];
  /** Сервер решил, что у человека есть право на контент (admin|editor). Клиент роль не проверяет. */
  canEdit: boolean;
  emptyText: string;
}

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

const fmtEvent = (iso: string): string =>
  new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

const emptyDraft = (kind: Exclude<ArticleKind, 'patch'>): EditorInitial => ({
  kind,
  title: '',
  excerpt: '',
  bodyRu: '',
  coverUrl: null,
  eventAt: null,
  videoUrl: null,
  published: true,
});

export function ArticleFeedClient({ kind, items, canEdit, emptyText }: ArticleFeedClientProps) {
  const [editing, setEditing] = useState<EditorInitial | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  // Снимок «сейчас» на маунте — Date.now в теле рендера нарушает react-hooks/purity.
  const [now] = useState(() => Date.now());

  // Лента не тащит тела материалов (они до 40к символов), поэтому перед правкой
  // догружаем полный материал. Раньше форма открывалась с пустым bodyRu и
  // published:true — сохранение затирало разбор и публиковало черновик.
  const openEditor = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/articles?id=${id}`);
      if (!res.ok) return;
      const { article } = (await res.json()) as {
        article: {
          id: string;
          title: string;
          excerpt: string;
          bodyRu: string;
          coverUrl: string | null;
          eventAt: string | null;
          videoUrl: string | null;
          published: boolean;
          imported: boolean;
        };
      };
      setEditing({ ...article, kind });
    } finally {
      setLoadingId(null);
    }
  };

  if (editing) {
    return (
      <ArticleEditor
        initial={editing}
        onDone={() => {
          setEditing(null);
          // Материал ушёл в БД — перечитываем страницу (RSC отдаст свежую ленту).
          window.location.reload();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(emptyDraft(kind))}
          className="flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {kind === 'news' ? 'Новая статья' : 'Новый мастер-класс'}
        </button>
      )}

      {items.length === 0 ? (
        <p className="py-10 text-center font-blender-book text-sm text-text-secondary">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => {
            const upcoming = a.eventAt !== null && new Date(a.eventAt).getTime() > now;

            return (
              <article
                key={a.id}
                className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)"
              >
                {a.coverUrl && (
                  <div className="h-40 w-full overflow-hidden rounded-xs bg-(--color-darkbase)">
                    <img src={a.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                )}

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="flex items-center gap-2 font-blender-medium text-base uppercase tracking-widest text-text-primary">
                    {a.title}
                    {!a.published && (
                      <span className="rounded-xs border border-tactical-amber/50 bg-tactical-amber/10 px-2 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
                        Черновик
                      </span>
                    )}
                  </h2>

                  {upcoming ? (
                    <span className="flex items-center gap-1.5 rounded-xs border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-2 py-0.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      {fmtEvent(a.eventAt as string)}
                    </span>
                  ) : (
                    <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                      {a.eventAt ? fmtEvent(a.eventAt) : fmtDate(a.publishedAt)}
                    </span>
                  )}
                </div>

                {a.excerpt && (
                  <p className="line-clamp-3 font-blender-book text-sm text-text-secondary">
                    {a.excerpt}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {a.hasBodyRu && (
                    <Link
                      href={`/eft/comlink/${kind === 'news' ? 'blog' : 'masterclasses'}/${a.slug}`}
                      className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    >
                      Читать
                    </Link>
                  )}

                  {a.videoUrl && (
                    <a
                      href={a.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Запись
                    </a>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void openEditor(a.id)}
                      disabled={loadingId === a.id}
                      className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-50"
                    >
                      {loadingId === a.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      )}
                      Править
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
