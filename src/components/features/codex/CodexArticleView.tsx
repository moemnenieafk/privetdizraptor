'use client';

// Статья Кодекса + инлайн-CMS поверх неё. Кнопку «Править» рендерим, только если
// СЕРВЕР передал canEdit — клиент роль не проверяет.
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { CodexArticle } from '@/components/features/codex/CodexArticle';
import { CodexEditor } from '@/components/features/codex/CodexEditor';
import type { CodexArticle as CodexArticleType } from '@/types/codex';

interface Props {
  article: CodexArticleType;
  published: boolean;
  fromStatic: boolean;
  canEdit: boolean;
}

export function CodexArticleView({ article, published, fromStatic, canEdit }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <main className="flex w-full flex-col items-center pt-7 pb-14">
        <div className="w-full max-w-3xl px-4 xl:px-0">
          <CodexEditor
            article={article}
            published={published}
            fromStatic={fromStatic}
            onClose={() => setEditing(false)}
          />
        </div>
      </main>
    );
  }

  return (
    <>
      {canEdit && (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-3 px-4 pt-4 xl:px-0">
          {!published && (
            <span className="rounded-xs border border-tactical-amber/50 bg-tactical-amber/10 px-2 py-1 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
              Черновик
            </span>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Править
          </button>
        </div>
      )}

      <CodexArticle article={article} />
    </>
  );
}
