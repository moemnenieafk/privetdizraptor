'use client';

// Инлайн-редактор Кодекса (E10, фаза 3). Открывается кнопкой «✎» на самой статье —
// редактор не уходит в отдельную админку и правит контент в его настоящем контексте.
//
// Структура статьи — дерево (интро + секции с абзацами и списками), поэтому это
// форма-конструктор, а не WYSIWYG: секции добавляются/удаляются/двигаются, абзацы
// вводятся построчно (пустая строка = новый абзац).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import type { CodexArticle, CodexSection } from '@/types/codex';

interface Props {
  article: CodexArticle;
  published: boolean;
  /** Статья ещё не в БД (отдана из статики) — сохранение создаст запись. */
  fromStatic: boolean;
  onClose: () => void;
}

interface SectionDraft {
  heading: string;
  /** Абзацы одной строкой на абзац. */
  body: string;
  bullets: string;
}

const toDraft = (s: CodexSection): SectionDraft => ({
  heading: s.heading,
  body: s.body.join('\n\n'),
  bullets: (s.bullets ?? []).join('\n'),
});

const splitParagraphs = (v: string): string[] =>
  v.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

const splitLines = (v: string): string[] =>
  v.split('\n').map((p) => p.trim()).filter(Boolean);

const field =
  'w-full rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary outline-none focus:border-(--primary)';
const label =
  'font-blender-medium text-type-micro uppercase tracking-widest text-text-muted';

export function CodexEditor({ article, published: initialPublished, fromStatic, onClose }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(article.title);
  const [subtitle, setSubtitle] = useState(article.subtitle ?? '');
  const [intro, setIntro] = useState(article.intro);
  const [sections, setSections] = useState<SectionDraft[]>(article.sections.map(toDraft));
  const [published, setPublished] = useState(initialPublished);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, key: keyof SectionDraft, value: string) =>
    setSections((prev) => prev.map((s, n) => (n === i ? { ...s, [key]: value } : s)));

  const move = (i: number, delta: number) =>
    setSections((prev) => {
      const next = [...prev];
      const j = i + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/codex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: article.slug,
          title,
          subtitle,
          icon: article.icon ?? '',
          intro,
          sections: sections.map((s) => ({
            heading: s.heading,
            body: splitParagraphs(s.body),
            bullets: splitLines(s.bullets),
          })),
          // Таймлайн и связи — редко меняются и правятся сложнее формы; переносим как есть.
          timeline: article.timeline,
          sources: article.sources,
          confidence: article.confidence,
          published,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5 rounded-sm border border-(--primary)/40 bg-(--color-base) p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-blender-medium text-base uppercase tracking-widest text-(--primary)">
          Правка статьи · {article.slug}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Отмена
        </button>
      </header>

      {fromStatic && (
        <p className="rounded-xs border border-tactical-amber/40 bg-tactical-amber/10 px-3 py-2 font-blender-book text-xs text-tactical-amber">
          Статья пока хранится в коде. Сохранение перенесёт её в базу — дальше правки
          применяются сразу, без деплоя.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className={label}>Заголовок</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Подзаголовок</span>
        <input className={field} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Вступление</span>
        <textarea
          rows={4}
          className={field}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4">
        <span className={label}>Секции ({sections.length})</span>

        {sections.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xs border border-lines-hover p-3">
            <div className="flex items-center gap-2">
              <input
                className={field}
                placeholder="Заголовок секции"
                value={s.heading}
                onChange={(e) => patch(i, 'heading', e.target.value)}
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                aria-label="Выше"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                aria-label="Ниже"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSections((prev) => prev.filter((_, n) => n !== i))}
                aria-label="Удалить секцию"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-danger/40 text-danger transition-colors hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <textarea
              rows={5}
              className={field}
              placeholder="Абзацы. Пустая строка разделяет абзацы."
              value={s.body}
              onChange={(e) => patch(i, 'body', e.target.value)}
            />

            <textarea
              rows={3}
              className={field}
              placeholder="Маркированный список: по пункту на строку (необязательно)."
              value={s.bullets}
              onChange={(e) => patch(i, 'bullets', e.target.value)}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={() => setSections((prev) => [...prev, { heading: '', body: '', bullets: '' }])}
          className="flex h-11 w-fit items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Добавить секцию
        </button>
      </div>

      <label className="flex items-center gap-2 font-blender-book text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Опубликовано (снимите галочку — статья станет черновиком и пропадёт с сайта)
      </label>

      {error && (
        <p className="rounded-xs border border-danger/40 bg-danger/10 px-3 py-2 font-blender-book text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Сохранить
      </button>
    </div>
  );
}
