'use client';

// Медиа-библиотека (E10, фаза 4). Один компонент обслуживает два режима:
//   • страница /admin/media — управление (загрузка, копирование URL, удаление);
//   • модалка-пикер внутри редакторов (onPick) — выбрать картинку, не уходя с формы.
// Разделять их значило бы дублировать загрузку и грид.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Trash2, Upload } from 'lucide-react';

export interface MediaItem {
  id: string;
  url: string;
  path: string;
  alt: string;
  mime: string;
  bytes: number;
  createdAt: string;
}

interface Props {
  /** Задан — грид работает как пикер: клик по картинке возвращает URL. */
  onPick?: (url: string) => void;
}

const fmtSize = (b: number): string =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${Math.round(b / 1024)} КБ`;

export function MediaLibrary({ onPick }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/media');
      if (!res.ok) throw new Error('Каталог недоступен');
      const data = (await res.json()) as { items: MediaItem[] };
      setItems(data.items);
      setError(null);
    } catch {
      setError('Не удалось загрузить каталог');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        form.append('alt', file.name.replace(/\.[^.]+$/, ''));

        const res = await fetch('/api/admin/media', { method: 'POST', body: form });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `Не удалось загрузить ${file.name}`);
          break;
        }
        const { item } = (await res.json()) as { item: MediaItem };
        setItems((prev) => [item, ...prev]);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Загрузить
        </button>
        <span className="font-blender-book text-xs text-text-muted">
          webp, png, jpg, gif · до 3 МБ · можно выбрать несколько
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/png,image/jpeg,image/gif"
          multiple
          hidden
          onChange={(e) => void upload(e.target.files)}
        />
      </div>

      {error && (
        <p className="rounded-xs border border-danger/40 bg-danger/10 px-3 py-2 font-blender-book text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xs bg-(--color-darkbase)" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
          Пока пусто. Загрузите первый файл.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <figure
              key={m.id}
              className="flex flex-col overflow-hidden rounded-xs border border-lines-hover"
            >
              <button
                type="button"
                onClick={() => onPick?.(m.url)}
                disabled={!onPick}
                className="h-32 w-full bg-(--color-darkbase) transition-opacity disabled:cursor-default enabled:hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} loading="lazy" className="h-full w-full object-cover" />
              </button>

              <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate font-blender-book text-xs text-text-muted">
                  {fmtSize(m.bytes)}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void copy(m.url)}
                    aria-label="Скопировать ссылку"
                    className="flex size-8 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-(--primary)"
                  >
                    {copied === m.url ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(m.id)}
                    disabled={busy}
                    aria-label="Удалить"
                    className="flex size-8 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
