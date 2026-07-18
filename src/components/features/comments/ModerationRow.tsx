'use client';

// Строка ленты модерации: показать контекст и дать скрыть/вернуть в один тап.
// Дёргает тот же PATCH /api/eft/comments, что и ветка на странице сущности.
import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, EyeOff } from 'lucide-react';

interface Props {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  hidden: boolean;
  score: number;
  sectionLabel: string;
  href: string;
}

export function ModerationRow({
  id,
  body,
  authorName,
  createdAt,
  hidden: initialHidden,
  score,
  sectionLabel,
  href,
}: Props) {
  const [hidden, setHidden] = useState(initialHidden);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !hidden;
    setHidden(next);
    try {
      const res = await fetch('/api/eft/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hidden: next }),
      });
      if (!res.ok) throw new Error('fail');
    } catch {
      setHidden(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`flex flex-col gap-2 rounded-sm border border-lines-hover p-3 ${
        hidden ? 'opacity-50' : 'bg-(--color-base)'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-xs border border-lines-hover px-1.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {sectionLabel}
        </span>
        <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          {authorName}
        </span>
        <span className="font-blender-medium text-xs text-text-secondary">
          {new Date(createdAt).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="ml-auto font-blender-medium text-xs text-text-secondary">+{score}</span>
      </div>

      <p className="whitespace-pre-wrap break-words font-blender-book text-sm text-text-primary">
        {body}
      </p>

      <div className="flex items-center gap-2 border-t border-lines-hover pt-2">
        <Link
          href={href}
          className="flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Открыть
        </Link>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={busy}
          className="ml-auto flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          {hidden ? 'Вернуть' : 'Скрыть'}
        </button>
      </div>
    </li>
  );
}
