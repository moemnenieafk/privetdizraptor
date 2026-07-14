'use client';

// CMS-форма ЦТА: Блог, Мастер-классы, разборы патчей. Рендерится только админу
// (сервер решает, кто её видит — клиент не проверяет роль сам).
//
// Патч из Steam правится частично: только «Разбор ЦТА». Заголовок и выжимка
// принадлежат первоисточнику, поэтому в этом режиме поля заблокированы.
import { useState } from 'react';
import { Check, Loader2, Trash2, X } from 'lucide-react';
import type { ArticleKind } from '@/db/schema-articles';

export interface EditorInitial {
  id?: string;
  kind: ArticleKind;
  title: string;
  excerpt: string;
  bodyRu: string;
  coverUrl: string | null;
  eventAt: string | null;
  videoUrl: string | null;
  published: boolean;
  /** Импорт из Steam — редактируем только разбор. */
  imported?: boolean;
}

interface ArticleEditorProps {
  initial: EditorInitial;
  onDone: () => void;
  onCancel: () => void;
}

export function ArticleEditor({ initial, onDone, onCancel }: ArticleEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [bodyRu, setBodyRu] = useState(initial.bodyRu);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl ?? '');
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? '');
  const [eventAt, setEventAt] = useState(initial.eventAt ? initial.eventAt.slice(0, 16) : '');
  const [published, setPublished] = useState(initial.published);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = initial.imported === true;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initial.id,
          kind: initial.kind,
          title,
          excerpt,
          bodyRu,
          coverUrl,
          videoUrl,
          eventAt: eventAt ? new Date(eventAt).toISOString() : null,
          published,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial.id) return;
    setBusy(true);
    await fetch(`/api/admin/articles?id=${initial.id}`, { method: 'DELETE' });
    setBusy(false);
    onDone();
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-sm border border-(--primary)/40 bg-(--color-base) p-4">
      <h2 className="font-blender-medium text-lg uppercase tracking-widest text-(--primary)">
        {initial.id ? 'Правка материала' : 'Новый материал'}
      </h2>

      {locked && (
        <p className="rounded-xs border border-lines-hover bg-(--color-darkbase) p-3 font-blender-book text-xs text-text-secondary">
          Патч импортирован из Steam: заголовок, выжимка и дата принадлежат первоисточнику
          и не редактируются. Пишем только разбор ЦТА.
        </p>
      )}

      {!locked && (
        <>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 160))}
            placeholder="Заголовок"
            className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
          />

          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="Короткое описание для карточки (до 400 символов)"
            className="w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
          />
        </>
      )}

      <textarea
        value={bodyRu}
        onChange={(e) => setBodyRu(e.target.value.slice(0, 40000))}
        rows={12}
        placeholder={
          initial.kind === 'patch'
            ? 'Разбор патча: что изменилось для игрока, что теперь мета, что сломали…'
            : 'Текст материала'
        }
        className="w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
      />

      {!locked && initial.kind === 'masterclass' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              Когда проводим
            </span>
            <input
              type="datetime-local"
              value={eventAt}
              onChange={(e) => setEventAt(e.target.value)}
              className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary focus:border-(--primary) focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
              Ссылка на запись
            </span>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube / Twitch"
              className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
            />
          </label>
        </div>
      )}

      {!locked && (
        <input
          type="url"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          placeholder="Обложка (URL, необязательно)"
          className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
        />
      )}

      {!locked && (
        <button
          type="button"
          onClick={() => setPublished((v) => !v)}
          className="flex items-center gap-2 font-blender-book text-sm text-text-secondary"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-xs border ${
              published ? 'border-(--primary) bg-(--primary)' : 'border-lines-hover'
            }`}
          >
            {published && <Check className="h-3.5 w-3.5 text-(--color-base)" aria-hidden="true" />}
          </span>
          Опубликовано
        </button>
      )}

      {error && <p className="font-blender-book text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          Сохранить
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:border-(--primary) hover:text-(--primary)"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Отмена
        </button>

        {initial.id && !locked && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Удалить
          </button>
        )}
      </div>
    </div>
  );
}
