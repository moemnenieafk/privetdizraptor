'use client';

// Ветка обсуждения под опубликованной сборкой.
//
// Асимметрия по правам сделана намеренно: ПИСАТЬ может платный тир (сообщение имеет
// цену — это отсекает мусор), ГОЛОСОВАТЬ — любой залогиненный, включая free. Так
// бесплатная аудитория работает куратором и поднимает наверх полезное, а не молчит.
// Минусов нет: у платного автора минус читается как «мне за деньги нахамили», а
// реально вредное закрывает жалоба и модератор.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EyeOff, ThumbsUp, Trash2 } from 'lucide-react';
import { TwitchIcon } from '@/components/ui/BrandIcons';

// Пороги кармы продублированы локально СПЕЦИАЛЬНО: KARMA_TIERS живёт в
// src/db/schema-comlink.ts рядом с pgTable, и импорт оттуда затащил бы drizzle
// в браузерный бандл. Значения обязаны совпадать со схемой.
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

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

export function BuildComments({ slug }: { slug: string }) {
  const [sort, setSort] = useState<Sort>('best');
  const [items, setItems] = useState<CommentDTO[]>([]);
  const [me, setMe] = useState<MeInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (nextSort: Sort, signal?: AbortSignal) => {
      try {
        const res = await fetch(
          `/api/eft/builds/comments?slug=${encodeURIComponent(slug)}&sort=${nextSort}`,
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
    [slug],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    void load(sort, ctrl.signal);
    return () => ctrl.abort();
  }, [sort, load]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (body.length < 2 || sending) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch('/api/eft/builds/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setNotice(data.error ?? 'Не удалось отправить');
        return;
      }
      setDraft('');
      await load(sort);
    } catch {
      setNotice('Сеть недоступна');
    } finally {
      setSending(false);
    }
  }, [draft, sending, slug, sort, load]);

  const vote = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, votedByMe: !c.votedByMe, score: c.score + (c.votedByMe ? -1 : 1) }
          : c,
      ),
    );
    try {
      const res = await fetch('/api/eft/builds/comments/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { voted?: boolean; score?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'fail');
      setItems((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, votedByMe: data.voted ?? c.votedByMe, score: data.score ?? c.score } : c,
        ),
      );
    } catch {
      setItems((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, votedByMe: !c.votedByMe, score: c.score + (c.votedByMe ? -1 : 1) }
            : c,
        ),
      );
    }
  }, []);

  const removeOwn = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/eft/builds/comments?id=${id}`, { method: 'DELETE' });
    } catch {
      /* список перечитается при следующей загрузке */
    }
  }, []);

  const toggleHide = useCallback(async (id: string, hidden: boolean) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, hidden } : c)));
    try {
      await fetch('/api/eft/builds/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hidden }),
      });
    } catch {
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, hidden: !hidden } : c)));
    }
  }, []);

  return (
    <section className="mt-10 flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Обсуждение {items.length > 0 && <span className="text-text-secondary">{items.length}</span>}
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

      {/* Форма / гейт */}
      {status !== 'loading' && <Composer
        me={me}
        draft={draft}
        setDraft={setDraft}
        send={send}
        sending={sending}
        notice={notice}
      />}

      {status === 'loading' && <SkeletonList />}

      {status === 'error' && (
        <p className="py-6 text-center font-blender-book text-sm text-text-secondary">
          Не удалось загрузить обсуждение.
        </p>
      )}

      {status === 'ready' && items.length === 0 && (
        <p className="py-6 text-center font-blender-book text-sm text-text-secondary">
          Пока тихо. Первый разбор этой сборки — за тобой.
        </p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <CommentRow
              key={c.id}
              c={c}
              me={me}
              onVote={() => void vote(c.id)}
              onDelete={() => void removeOwn(c.id)}
              onHide={() => void toggleHide(c.id, !c.hidden)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────────── форма ───────────────── */

function Composer({
  me,
  draft,
  setDraft,
  send,
  sending,
  notice,
}: {
  me: MeInfo | null;
  draft: string;
  setDraft: (v: string) => void;
  send: () => void;
  sending: boolean;
  notice: string | null;
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

  const left = MAX_LEN - draft.length;

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
        rows={3}
        placeholder="Что не так с обвесом? Чем заменил бы?"
        className="w-full resize-y rounded-xs border border-lines-hover bg-(--color-darkbase) p-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="font-blender-medium text-xs text-text-secondary">
          {notice ?? `${left} символов`}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={sending || draft.trim().length < 2}
          className="h-10 rounded-xs border border-(--primary) px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </div>
    </div>
  );
}

/* ───────────────── строка ───────────────── */

function CommentRow({
  c,
  me,
  onVote,
  onDelete,
  onHide,
}: {
  c: CommentDTO;
  me: MeInfo | null;
  onVote: () => void;
  onDelete: () => void;
  onHide: () => void;
}) {
  const tierLabel = karmaLabel(c.authorKarma);
  const mine = me?.userId === c.authorId;

  return (
    <li
      className={`flex flex-col gap-2 rounded-sm border p-3 ${
        c.hidden ? 'border-lines-hover opacity-50' : 'border-lines-hover bg-(--color-base)'
      }`}
    >
      <div className="flex items-center gap-2">
        <Link
          href={`/u/${encodeURIComponent(c.authorName)}`}
          className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary hover:text-(--primary)"
        >
          {c.authorName}
        </Link>
        {c.authorStreamer && (
          <TwitchIcon className="h-3.5 w-3.5 shrink-0 text-(--color-twitch)" size={14} />
        )}
        <span className="shrink-0 rounded-xs border border-lines-hover px-1.5 font-blender-medium text-xs text-text-secondary">
          {tierLabel}
        </span>
        <span className="ml-auto shrink-0 font-blender-medium text-xs text-text-secondary">
          {fmtDate(c.createdAt)}
        </span>
      </div>

      <p className="whitespace-pre-wrap break-words font-blender-book text-sm text-text-primary">
        {c.body}
      </p>

      <div className="flex items-center gap-2 border-t border-lines-hover pt-2">
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
          <ThumbsUp
            className="h-3.5 w-3.5"
            fill={c.votedByMe ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          {c.score}
        </button>

        {c.hidden && (
          <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            Скрыто
          </span>
        )}

        {mine && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Удалить
          </button>
        )}

        {me?.canModerate && !mine && (
          <button
            type="button"
            onClick={onHide}
            className="ml-auto flex h-8 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-xs text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            {c.hidden ? 'Вернуть' : 'Скрыть'}
          </button>
        )}
      </div>
    </li>
  );
}

/* ───────────────── скелетон ───────────────── */

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3">
          <div className="h-4 w-32 animate-pulse rounded-xs bg-(--color-darkbase)" />
          <div className="h-3 w-full animate-pulse rounded-xs bg-(--color-darkbase)" />
          <div className="h-3 w-2/3 animate-pulse rounded-xs bg-(--color-darkbase)" />
        </div>
      ))}
    </div>
  );
}
