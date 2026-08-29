'use client';

// Ветка обсуждения под любой сущностью портала (сборка, патч, Кодекс, босс, торговец,
// сборка перков). Цель — пара type+id (реестр @/lib/comment-targets).
//
// Модернизация 2026-08-28: ответы-ветки (1 уровень), правка своих, относительное время,
// аватары, @упоминания-ссылки. Права: ПИСАТЬ/ОТВЕЧАТЬ — по canWrite (для season-build —
// любой залогиненный, иначе платный тир); ГОЛОСОВАТЬ — любой залогиненный; правит автор,
// скрывает модератор.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { EyeOff, MessageSquare, Pencil, ThumbsUp, Trash2 } from 'lucide-react';
import { TwitchIcon } from '@/components/ui/BrandIcons';
import type { CommentTargetType } from '@/lib/comment-targets';

// Пороги кармы продублированы локально (KARMA_TIERS в schema-comlink рядом с drizzle —
// импорт затащил бы его в браузер). Значения обязаны совпадать со схемой.
const KARMA_LABELS: { min: number; label: string }[] = [
  { min: 500, label: 'Легенда' },
  { min: 200, label: 'Ветеран' },
  { min: 50, label: 'Боец' },
  { min: 0, label: 'Дикий' },
];
const karmaLabel = (total: number): string =>
  KARMA_LABELS.find((t) => total >= t.min)?.label ?? 'Дикий';

type Sort = 'best' | 'new';
const MAX_LEN = 1500;

interface CommentDTO {
  id: string;
  body: string;
  score: number;
  createdAt: string;
  parentId: string | null;
  editedAt: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorStreamer: boolean;
  authorKarma: number;
  votedByMe: boolean;
  hidden: boolean;
}

interface MeInfo {
  userId: string;
  canWrite: boolean;
  canVote: boolean;
  canModerate: boolean;
}

interface FeedResponse {
  items: CommentDTO[];
  me: MeInfo | null;
}

// Относительное время («5 мин назад») — тренд-2026 вместо абсолютной даты.
const RTF = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
function relTime(iso: string): string {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const a = Math.abs(s);
  if (a < 60) return RTF.format(Math.round(s), 'second');
  if (a < 3600) return RTF.format(Math.round(s / 60), 'minute');
  if (a < 86400) return RTF.format(Math.round(s / 3600), 'hour');
  if (a < 2592000) return RTF.format(Math.round(s / 86400), 'day');
  if (a < 31536000) return RTF.format(Math.round(s / 2592000), 'month');
  return RTF.format(Math.round(s / 31536000), 'year');
}

// @упоминания → ссылки на профиль + подсветка. Разбиваем текст, сохраняя разделители.
const MENTION_RE = /(@[\wА-Яа-яЁё-]{2,32})/g;
function renderBody(text: string): ReactNode[] {
  return text.split(MENTION_RE).map((part, i) => {
    if (i % 2 === 1) {
      const name = part.slice(1);
      return (
        <Link
          key={i}
          href={`/u/${encodeURIComponent(name)}`}
          className="font-blender-medium text-(--primary) hover:underline"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function EntityComments({ type, id }: { type: CommentTargetType; id: string }) {
  const [sort, setSort] = useState<Sort>('best');
  const [items, setItems] = useState<CommentDTO[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(
    async (nextSort: Sort, signal?: AbortSignal) => {
      try {
        const res = await fetch(
          `/api/eft/comments?type=${type}&id=${encodeURIComponent(id)}&sort=${nextSort}`,
          { signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as FeedResponse;
        setItems(data.items);
        setMe(data.me);
        setStatus('ready');
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
        setStatus('error');
      }
    },
    [type, id],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(sort, ctrl.signal);
    return () => ctrl.abort();
  }, [sort, load]);

  // Верхнеуровневые в порядке сервера + карта ответов (хронология).
  const { tops, repliesByParent } = useMemo(() => {
    const tops: CommentDTO[] = [];
    const repliesByParent = new Map<string, CommentDTO[]>();
    for (const c of items) {
      if (c.parentId) {
        const arr = repliesByParent.get(c.parentId) ?? [];
        arr.push(c);
        repliesByParent.set(c.parentId, arr);
      } else {
        tops.push(c);
      }
    }
    for (const arr of repliesByParent.values()) {
      arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return { tops, repliesByParent };
  }, [items]);

  const totalCount = items.length;

  const post = useCallback(
    async (bodyText: string, parentId: string | null): Promise<boolean> => {
      const body = bodyText.trim();
      if (body.length < 2) return false;
      const res = await fetch('/api/eft/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, body, parentId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? 'Не удалось отправить');
        return false;
      }
      return true;
    },
    [type, id],
  );

  const sendTop = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setNotice(null);
    try {
      if (await post(draft, null)) {
        setDraft('');
        await load(sort);
      }
    } finally {
      setSending(false);
    }
  }, [sending, post, draft, load, sort]);

  const sendReply = useCallback(
    async (parentId: string, text: string) => {
      if (await post(text, parentId)) {
        setReplyTo(null);
        await load(sort);
      }
    },
    [post, load, sort],
  );

  const saveEdit = useCallback(
    async (commentId: string, text: string) => {
      const body = text.trim();
      if (body.length < 2) return;
      const res = await fetch('/api/eft/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId, body }),
      });
      if (res.ok) {
        setEditing(null);
        await load(sort);
      } else {
        const data = (await res.json()) as { error?: string };
        setNotice(data.error ?? 'Не удалось сохранить');
      }
    },
    [load, sort],
  );

  const vote = useCallback(async (commentId: string) => {
    const flip = (c: CommentDTO): CommentDTO =>
      c.id === commentId
        ? { ...c, votedByMe: !c.votedByMe, score: c.score + (c.votedByMe ? -1 : 1) }
        : c;
    setItems((prev) => prev.map(flip));
    try {
      const res = await fetch('/api/eft/comments/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId }),
      });
      const data = (await res.json()) as { voted?: boolean; score?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'fail');
      setItems((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, votedByMe: data.voted ?? c.votedByMe, score: data.score ?? c.score } : c,
        ),
      );
    } catch {
      setItems((prev) => prev.map(flip));
    }
  }, []);

  const removeOwn = useCallback(async (commentId: string) => {
    setItems((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await fetch(`/api/eft/comments?id=${commentId}`, { method: 'DELETE' });
    } catch {
      /* перечитается */
    }
  }, []);

  const toggleHide = useCallback(async (commentId: string, hidden: boolean) => {
    setItems((prev) => prev.map((c) => (c.id === commentId ? { ...c, hidden } : c)));
    try {
      await fetch('/api/eft/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId, hidden }),
      });
    } catch {
      setItems((prev) => prev.map((c) => (c.id === commentId ? { ...c, hidden: !hidden } : c)));
    }
  }, []);

  return (
    <section className="mt-10 flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Обсуждение {totalCount > 0 && <span className="text-text-secondary">{totalCount}</span>}
        </h2>
        <div className="flex gap-1.5">
          {(['best', 'new'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`h-9 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
                sort === s
                  ? 'border-(--primary) text-(--primary)'
                  : 'border-lines-hover text-text-secondary hover:border-(--primary)'
              }`}
            >
              {s === 'best' ? 'Лучшие' : 'Новые'}
            </button>
          ))}
        </div>
      </div>

      {status !== 'loading' && (
        <Composer
          me={me}
          value={draft}
          setValue={setDraft}
          onSubmit={sendTop}
          submitting={sending}
          notice={notice}
          placeholder="Что думаешь об этой сборке? Чем заменил бы перк?"
        />
      )}

      {status === 'loading' && <SkeletonList />}

      {status === 'error' && (
        <p className="py-6 text-center font-blender-book text-sm text-text-secondary">
          Не удалось загрузить обсуждение.
        </p>
      )}

      {status === 'ready' && tops.length === 0 && (
        <p className="py-6 text-center font-blender-book text-sm text-text-secondary">
          Пока тихо. Первый разбор этой сборки — за тобой.
        </p>
      )}

      {tops.length > 0 && (
        <ul className="flex flex-col gap-3">
          {tops.map((c) => (
            <li key={c.id} className="flex flex-col gap-3">
              <CommentRow
                c={c}
                me={me}
                editing={editing === c.id}
                onVote={() => void vote(c.id)}
                onDelete={() => void removeOwn(c.id)}
                onHide={() => void toggleHide(c.id, !c.hidden)}
                onReply={() => setReplyTo(replyTo === c.id ? null : c.id)}
                onEdit={() => setEditing(editing === c.id ? null : c.id)}
                onSaveEdit={(text) => void saveEdit(c.id, text)}
                onCancelEdit={() => setEditing(null)}
              />

              {/* Ответы (1 уровень) с отступом-линией слева */}
              {(repliesByParent.get(c.id)?.length ?? 0) > 0 && (
                <ul className="ml-4 flex flex-col gap-3 border-l border-lines-hover pl-4 sm:ml-6 sm:pl-5">
                  {repliesByParent.get(c.id)!.map((r) => (
                    <li key={r.id}>
                      <CommentRow
                        c={r}
                        me={me}
                        editing={editing === r.id}
                        onVote={() => void vote(r.id)}
                        onDelete={() => void removeOwn(r.id)}
                        onHide={() => void toggleHide(r.id, !r.hidden)}
                        onEdit={() => setEditing(editing === r.id ? null : r.id)}
                        onSaveEdit={(text) => void saveEdit(r.id, text)}
                        onCancelEdit={() => setEditing(null)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {/* Инлайн-форма ответа */}
              {replyTo === c.id && me?.canWrite && (
                <div className="ml-4 sm:ml-6">
                  <ReplyComposer
                    onSubmit={(text) => void sendReply(c.id, text)}
                    onCancel={() => setReplyTo(null)}
                    replyToName={c.authorName}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────────── аватар ───────────────── */

function Avatar({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-(--color-darkbase) font-blender-medium text-xs uppercase text-text-secondary"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/* ───────────────── форма верхнего уровня ───────────────── */

function Composer({
  me,
  value,
  setValue,
  onSubmit,
  submitting,
  notice,
  placeholder,
}: {
  me: MeInfo | null;
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  notice: string | null;
  placeholder: string;
}) {
  if (!me) {
    return (
      <div className="rounded-sm border border-lines-hover bg-(--color-base) p-4 text-center">
        <p className="font-blender-book text-sm text-text-secondary">
          <Link href="/login" className="text-(--primary) hover:underline">
            Войди
          </Link>
          , чтобы участвовать в обсуждении.
        </p>
      </div>
    );
  }

  if (!me.canWrite) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-sm border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] p-4 text-center">
        <p className="font-blender-book text-sm text-text-secondary">
          Комментарии пишут подписчики «Оперативник» и «Ветеран» — так у каждого сообщения
          есть цена. Голосовать за чужие можно и без подписки.
        </p>
        <Link
          href="/account"
          className="h-9 rounded-xs border border-(--primary) px-4 pt-2 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          Оформить подписку
        </Link>
      </div>
    );
  }

  const left = MAX_LEN - value.length;

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-y rounded-xs border border-lines-hover bg-(--color-darkbase) p-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-blender-medium text-xs text-text-secondary">
          {notice ?? `${left} символов · @ упомянёт игрока`}
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || value.trim().length < 2}
          className="h-10 rounded-xs border border-(--primary) px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Отправка…' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}

/* ───────────────── инлайн-форма ответа ───────────────── */

function ReplyComposer({
  onSubmit,
  onCancel,
  replyToName,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
  replyToName: string;
}) {
  const [text, setText] = useState(`@${replyToName} `);
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3">
      <textarea
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        rows={2}
        placeholder="Ответить…"
        className="w-full resize-y rounded-xs border border-lines-hover bg-(--color-darkbase) p-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => onSubmit(text)}
          disabled={text.trim().length < 2}
          className="h-9 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:opacity-40"
        >
          Ответить
        </button>
      </div>
    </div>
  );
}

/* ───────────────── инлайн-правка (свежий стейт при каждом монтировании) ───────────────── */

function EditBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        rows={3}
        className="w-full resize-y rounded-xs border border-lines-hover bg-(--color-darkbase) p-2.5 font-blender-book text-sm text-text-primary focus:border-(--primary) focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => onSave(text)}
          disabled={text.trim().length < 2}
          className="h-8 rounded-xs border border-(--primary) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:opacity-40"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

/* ───────────────── строка комментария ───────────────── */

function CommentRow({
  c,
  me,
  editing,
  onVote,
  onDelete,
  onHide,
  onReply,
  onEdit,
  onSaveEdit,
  onCancelEdit,
}: {
  c: CommentDTO;
  me: MeInfo | null;
  editing: boolean;
  onVote: () => void;
  onDelete: () => void;
  onHide: () => void;
  onReply?: () => void;
  onEdit: () => void;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
}) {
  const mine = me?.userId === c.authorId;

  return (
    <div
      className={`flex gap-3 rounded-sm border p-3 ${
        c.hidden ? 'border-lines-hover opacity-50' : 'border-lines-hover bg-(--color-base)'
      }`}
    >
      <Avatar url={c.authorAvatar} name={c.authorName} />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link
            href={`/u/${encodeURIComponent(c.authorName)}`}
            className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary hover:text-(--primary)"
          >
            {c.authorName}
          </Link>
          {c.authorStreamer && <TwitchIcon className="h-3.5 w-3.5 shrink-0 text-(--color-twitch)" size={14} />}
          <span className="shrink-0 rounded-xs border border-lines-hover px-1.5 font-blender-medium text-xs text-text-secondary">
            {karmaLabel(c.authorKarma)}
          </span>
          <span className="ml-auto shrink-0 font-blender-medium text-xs text-text-secondary" title={new Date(c.createdAt).toLocaleString('ru-RU')}>
            {relTime(c.createdAt)}
            {c.editedAt && <span className="ml-1 text-text-muted">· изменено</span>}
          </span>
        </div>

        {editing ? (
          <EditBox initial={c.body} onSave={onSaveEdit} onCancel={onCancelEdit} />
        ) : (
          <p className="whitespace-pre-wrap break-words font-blender-book text-sm text-text-primary">
            {renderBody(c.body)}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVote}
            disabled={!me || mine}
            aria-pressed={c.votedByMe}
            title={mine ? 'Свой комментарий' : 'Полезно'}
            className={`flex h-8 items-center gap-1.5 rounded-xs border px-2.5 font-blender-medium text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              c.votedByMe
                ? 'border-(--primary) text-(--primary)'
                : 'border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)'
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" fill={c.votedByMe ? 'currentColor' : 'none'} aria-hidden="true" />
            {c.score}
          </button>

          {onReply && me?.canWrite && (
            <button
              type="button"
              onClick={onReply}
              className="flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Ответить
            </button>
          )}

          {c.hidden && (
            <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Скрыто</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {mine && !editing && (
              <button
                type="button"
                onClick={onEdit}
                className="flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Изменить
              </button>
            )}
            {mine && (
              <button
                type="button"
                onClick={onDelete}
                className="flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-danger hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Удалить
              </button>
            )}
            {me?.canModerate && !mine && (
              <button
                type="button"
                onClick={onHide}
                className="flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                {c.hidden ? 'Вернуть' : 'Скрыть'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── скелетон ───────────────── */

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3">
          <div className="size-8 shrink-0 animate-pulse rounded-full bg-(--color-darkbase)" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-32 animate-pulse rounded-xs bg-(--color-darkbase)" />
            <div className="h-3 w-full animate-pulse rounded-xs bg-(--color-darkbase)" />
            <div className="h-3 w-2/3 animate-pulse rounded-xs bg-(--color-darkbase)" />
          </div>
        </div>
      ))}
    </div>
  );
}
