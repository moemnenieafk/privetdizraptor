'use client';

// Медиа-библиотека (E10, фаза 4). Один компонент обслуживает два режима:
//   • страница /admin/media — управление (загрузка, копирование URL, удаление);
//   • модалка-пикер внутри редакторов (onPick) — выбрать картинку, не уходя с формы.
// Разделять их значило бы дублировать загрузку и грид.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckSquare, Copy, Loader2, Pencil, Square, Trash2, Upload, X } from 'lucide-react';

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
  /** Батч-пик (режим «Выбрать» в пикере): вернуть несколько URL разом. Нет — фолбэк на onPick по одному. */
  onPickMany?: (urls: string[]) => void;
}

const fmtSize = (b: number): string =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} МБ` : `${Math.round(b / 1024)} КБ`;

// Клиентская конвертация в webp (Canvas) ДО загрузки: держит тело запроса под лимитом Vercel
// (~4.5 МБ) и выполняет «конвертацию при загрузке». Анимированный gif НЕ трогаем — его в
// анимированный webp сконвертит сервер (sharp), Canvas же взял бы один кадр. Любая
// ошибка/неподдержка → отдаём исходник, сервер докрутит webp сам.
const MAX_DIM = 2560;
async function toWebp(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function MediaLibrary({ onPick, onPickMany }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Bug 6: режим «Выбрать» — галочки на ячейках, батч-действие (пикер → добавить, страница → удалить).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Bug 6: инлайн-переименование (правка alt) — id редактируемого элемента + черновик.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const isPicker = !!onPick || !!onPickMany;

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
        const base = file.name.replace(/\.[^.]+$/, '');
        const blob = await toWebp(file);
        const form = new FormData();
        form.append('file', blob, blob.type === 'image/webp' ? `${base}.webp` : file.name);
        form.append('alt', base);

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

  // Bug 6: переименование (правка alt) через PATCH — файл в R2 не трогаем, только подпись каталога.
  const saveRename = async (id: string) => {
    const alt = renameValue.trim();
    const prev = items.find((i) => i.id === id);
    setRenaming(null);
    if (!prev || alt === prev.alt) return;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, alt } : i))); // оптимистично
    try {
      const res = await fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, alt }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setItems((list) => list.map((i) => (i.id === id ? { ...i, alt: prev.alt } : i))); // откат
      setError('Не удалось переименовать');
    }
  };

  // Bug 6: выход из режима выбора (сброс галочек).
  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };
  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Bug 6: батч-пик (пикер) — вернуть выбранные URL разом; фолбэк на onPick по одному.
  const commitPick = () => {
    const urls = items.filter((i) => selected.has(i.id)).map((i) => i.url);
    if (!urls.length) return;
    if (onPickMany) onPickMany(urls);
    else if (onPick) urls.forEach((u) => onPick(u));
    exitSelect();
  };

  // Bug 6: батч-удаление (страница) — подтверждение + последовательные DELETE.
  const batchDelete = async () => {
    const ids = items.filter((i) => selected.has(i.id)).map((i) => i.id);
    if (!ids.length || !confirm(`Удалить выбранные файлы (${ids.length})? Действие необратимо.`)) return;
    setBusy(true);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/admin/media?id=${id}`, { method: 'DELETE' });
        if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } finally {
      setBusy(false);
      exitSelect();
    }
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
          png · jpg · webp · gif — конвертируется в webp (R2) · можно выбрать несколько
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/webp,image/png,image/jpeg,image/gif"
          multiple
          hidden
          onChange={(e) => void upload(e.target.files)}
        />

        {/* Bug 6: справа — тоггл «Выбрать» (обычный режим) / панель батч-действий (режим выбора). */}
        {items.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            {!selectMode ? (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="flex h-9 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <CheckSquare className="h-4 w-4" /> Выбрать
              </button>
            ) : (
              <>
                <span className="font-blender-book text-xs text-text-muted">Выбрано: {selected.size}</span>
                {isPicker ? (
                  <button
                    type="button"
                    onClick={commitPick}
                    disabled={selected.size === 0}
                    className="flex h-9 items-center gap-2 rounded-xs bg-(--primary) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" /> Добавить ({selected.size})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void batchDelete()}
                    disabled={selected.size === 0 || busy}
                    className="flex h-9 items-center gap-2 rounded-xs border border-danger/50 px-3 font-blender-medium text-xs uppercase tracking-widest text-danger transition-colors hover:border-danger hover:bg-danger/10 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" /> Удалить ({selected.size})
                  </button>
                )}
                <button
                  type="button"
                  onClick={exitSelect}
                  aria-label="Выйти из режима выбора"
                  className="flex size-9 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-xs border border-danger/40 bg-danger/10 px-3 py-2 font-blender-book text-sm text-danger">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xs bg-(--color-darkbase)" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
          Пока пусто. Загрузите первый файл.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => {
            const isSel = selected.has(m.id);
            return (
            <figure
              key={m.id}
              className={`relative flex flex-col overflow-hidden rounded-xs border ${
                selectMode && isSel ? 'border-(--primary)' : 'border-lines-hover'
              }`}
            >
              <button
                type="button"
                onClick={() => (selectMode ? toggleSelect(m.id) : onPick?.(m.url))}
                disabled={!selectMode && !onPick}
                className="aspect-square w-full bg-(--color-darkbase) transition-opacity disabled:cursor-default enabled:hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} loading="lazy" className={`h-full w-full object-cover ${selectMode && isSel ? 'opacity-70' : ''}`} />
              </button>

              {/* Bug 6: галочка-оверлей в режиме выбора */}
              {selectMode && (
                <span className="pointer-events-none absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-xs bg-black/60">
                  {isSel ? <CheckSquare className="h-4 w-4 text-(--primary)" /> : <Square className="h-4 w-4 text-text-secondary" />}
                </span>
              )}

              <figcaption className="flex items-center justify-between gap-1 px-2 py-1.5">
                {renaming === m.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void saveRename(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveRename(m.id);
                      else if (e.key === 'Escape') setRenaming(null);
                    }}
                    placeholder="Имя файла"
                    className="min-w-0 flex-1 rounded-xs border border-(--primary)/60 bg-(--color-base) px-1.5 py-0.5 font-blender-book text-xs text-text-primary outline-none"
                  />
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-muted"
                    title={`${m.alt || 'без имени'} · ${fmtSize(m.bytes)}`}
                  >
                    {m.alt || fmtSize(m.bytes)}
                  </span>
                )}
                {!selectMode && renaming !== m.id && (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => { setRenaming(m.id); setRenameValue(m.alt); }}
                      aria-label="Переименовать"
                      className="flex size-7 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-(--primary)"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(m.url)}
                      aria-label="Скопировать ссылку"
                      className="flex size-7 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-(--primary)"
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
                      className="flex size-7 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </figcaption>
            </figure>
            );
          })}
        </div>
      )}
    </div>
  );
}
