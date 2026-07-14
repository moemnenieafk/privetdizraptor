'use client';

// Форум «Обсуждения»: список тем + тема с ответами + форма. Один клиентский компонент
// с тремя видами (list / topic / new) — без вложенных роутов: форум приватный
// (только авторизованным), SSR-кэшировать нечего, а навигация состоянием мгновенна.
//
// Модерация инлайном: pin/lock темы и hide поста видят только admin|moderator
// (сервер отдаёт canModerate). Жалоба — у каждого поста.
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  EyeOff,
  Flag,
  Loader2,
  Lock,
  MessageSquare,
  Pin,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { PostItem, TopicDetail, TopicListItem } from '@/db/comlink-forum';

const TIER_CLASS: Record<string, string> = {
  legend: 'text-(--primary)',
  veteran: 'text-success',
  fighter: 'text-text-primary',
  wild: 'text-text-secondary',
};

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type View = { kind: 'list' } | { kind: 'topic'; id: string } | { kind: 'new' };

export function DiscussionsClient({ authorized }: { authorized: boolean }) {
  const [view, setView] = useState<View>({ kind: 'list' });

  if (!authorized) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <MessageSquare className="h-8 w-8 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Только для бойцов ЦТА
        </h2>
        <p className="max-w-md font-blender-book text-sm text-text-secondary">
          Войдите, чтобы открывать темы и отвечать. Обсуждения закрыты от анонимов —
          у каждого автора виден уровень доверия.
        </p>
      </div>
    );
  }

  if (view.kind === 'new') {
    return <NewTopicForm onDone={(id) => setView({ kind: 'topic', id })} onCancel={() => setView({ kind: 'list' })} />;
  }

  if (view.kind === 'topic') {
    return <TopicView id={view.id} onBack={() => setView({ kind: 'list' })} />;
  }

  return <TopicList onOpen={(id) => setView({ kind: 'topic', id })} onNew={() => setView({ kind: 'new' })} />;
}

/* ─────────────────── список тем ─────────────────── */

function TopicList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const [items, setItems] = useState<TopicListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/comlink/topics')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items: TopicListItem[]; total: number } | null) => {
        if (!alive || !data) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {total} тем
        </p>
        <button
          type="button"
          onClick={onNew}
          className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Новая тема
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
          Тем пока нет. Откройте первую — про мету патча, спорный спот или что угодно из игры.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpen(t.id)}
              className="flex w-full items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3 text-left transition-colors hover:border-(--primary)"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  {t.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-(--primary)" aria-hidden="true" />}
                  {t.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden="true" />}
                  <span className="truncate font-blender-medium text-sm text-text-primary">{t.title}</span>
                </span>
                <span className="font-blender-book text-xs text-text-secondary">
                  <span className={TIER_CLASS[t.authorKarma.tierId] ?? ''}>{t.authorName}</span>
                  {' · '}
                  {fmtDate(t.lastReplyAt ?? t.createdAt)}
                </span>
              </div>

              <span className="flex shrink-0 items-center gap-1.5 font-blender-medium text-xs text-text-secondary">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                {t.replyCount}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── новая тема ─────────────────── */

function NewTopicForm({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/comlink/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body: text }),
      });
      const data = (await res.json()) as { error?: string; topicId?: string };
      if (!res.ok || !data.topicId) {
        setError(data.error ?? 'Не удалось создать тему');
        return;
      }
      onDone(data.topicId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">Новая тема</h2>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 120))}
        placeholder="Заголовок (от 5 символов)"
        className="h-11 w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 4000))}
        rows={6}
        placeholder="Суть: вопрос, наблюдение, спорный момент… (от 10 символов)"
        className="w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
      />

      {error && <p className="font-blender-book text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          Опубликовать
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:border-(--primary) hover:text-(--primary)"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── тема + ответы ─────────────────── */

function TopicView({ id, onBack }: { id: string; onBack: () => void }) {
  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [mod, setMod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/comlink/topics/${id}`);
    if (res.ok) {
      const data = (await res.json()) as { topic: TopicDetail; canModerate: boolean };
      setTopic(data.topic);
      setMod(data.canModerate);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/comlink/topics/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Не удалось отправить');
        return;
      }
      setReply('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const modAction = async (payload: object) => {
    await fetch(`/api/comlink/topics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await load();
  };

  if (loading || !topic) {
    return <div className="h-60 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 w-fit items-center gap-2 font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:text-(--primary)"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Все темы
      </button>

      {/* Шапка темы */}
      <div className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
            {topic.pinned && <Pin className="mr-2 inline h-4 w-4 text-(--primary)" aria-hidden="true" />}
            {topic.title}
          </h1>

          {mod && (
            <div className="flex shrink-0 gap-1.5">
              <ModButton
                active={topic.pinned}
                label={topic.pinned ? 'Открепить' : 'Закрепить'}
                onClick={() => void modAction({ action: 'pin', value: !topic.pinned })}
              />
              <ModButton
                active={topic.locked}
                label={topic.locked ? 'Открыть' : 'Закрыть'}
                onClick={() => void modAction({ action: 'lock', value: !topic.locked })}
              />
            </div>
          )}
        </div>

        <AuthorLine name={topic.authorName} tierId={topic.authorKarma.tierId} karma={topic.authorKarma.total} date={topic.createdAt} />
        <p className="whitespace-pre-wrap font-blender-book text-sm text-text-primary">{topic.body}</p>
      </div>

      {/* Ответы */}
      {topic.posts.map((p) => (
        <PostCard key={p.id} post={p} topicId={id} mod={mod} onModerated={load} />
      ))}

      {/* Форма ответа */}
      {topic.locked ? (
        <p className="flex items-center gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3 font-blender-book text-sm text-text-secondary">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Тема закрыта модератором.
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Ваш ответ…"
            className="w-full rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
          />
          {error && <p className="font-blender-book text-xs text-danger">{error}</p>}
          <button
            type="button"
            disabled={busy || reply.trim().length < 2}
            onClick={send}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40 sm:w-auto sm:self-end sm:px-6"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Ответить
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── пост ─────────────────── */

function PostCard({
  post,
  topicId,
  mod,
  onModerated,
}: {
  post: PostItem;
  topicId: string;
  mod: boolean;
  onModerated: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [reportState, setReportState] = useState<'idle' | 'busy' | 'sent'>('idle');

  const hidePost = async (value: boolean) => {
    await fetch(`/api/comlink/topics/${topicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hide_post', postId: post.id, value }),
    });
    onModerated();
  };

  const sendReport = async () => {
    setReportState('busy');
    const res = await fetch('/api/comlink/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: post.authorId, refType: 'post', refId: post.id, reason }),
    });
    setReportState(res.ok ? 'sent' : 'idle');
    if (res.ok) setReporting(false);
  };

  if (post.hidden) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3">
        <p className="flex items-center gap-2 font-blender-book text-xs text-text-secondary">
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          Сообщение скрыто модератором.
        </p>
        {mod && (
          <button
            type="button"
            onClick={() => void hidePost(false)}
            className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:text-(--primary)"
          >
            Вернуть
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <div className="flex items-center justify-between gap-3">
        <AuthorLine name={post.authorName} tierId={post.authorKarma.tierId} karma={post.authorKarma.total} date={post.createdAt} />

        <div className="flex shrink-0 gap-1.5">
          {reportState !== 'sent' && (
            <button
              type="button"
              onClick={() => setReporting((v) => !v)}
              aria-label="Пожаловаться"
              className="flex h-8 w-8 items-center justify-center rounded-xs border border-lines-hover text-text-secondary hover:border-danger hover:text-danger"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {mod && (
            <button
              type="button"
              onClick={() => void hidePost(true)}
              aria-label="Скрыть сообщение"
              className="flex h-8 w-8 items-center justify-center rounded-xs border border-lines-hover text-text-secondary hover:border-(--primary) hover:text-(--primary)"
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <p className="whitespace-pre-wrap font-blender-book text-sm text-text-primary">{post.body}</p>

      {reporting && (
        <div className="flex flex-col gap-2 rounded-xs border border-danger/40 p-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Причина жалобы (от 10 символов) — увидят только модераторы"
            className="w-full rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-danger focus:outline-none"
          />
          <button
            type="button"
            disabled={reportState === 'busy' || reason.trim().length < 10}
            onClick={sendReport}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xs border border-danger font-blender-medium text-xs uppercase tracking-widest text-danger disabled:opacity-40 sm:w-auto sm:self-end sm:px-4"
          >
            {reportState === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Flag className="h-4 w-4" aria-hidden="true" />}
            Отправить жалобу
          </button>
        </div>
      )}

      {reportState === 'sent' && (
        <p className="font-blender-book text-xs text-success">Жалоба ушла модераторам.</p>
      )}
    </div>
  );
}

function AuthorLine({ name, tierId, karma, date }: { name: string; tierId: string; karma: number; date: string }) {
  return (
    <span className="flex items-center gap-2 font-blender-book text-xs text-text-secondary">
      <Users className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={`font-blender-medium ${TIER_CLASS[tierId] ?? ''}`}>{name}</span>
      <span className="flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        {karma}
      </span>
      {fmtDate(date)}
    </span>
  );
}

function ModButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-xs border px-2 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
        active ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-secondary hover:border-(--primary)'
      }`}
    >
      {label}
    </button>
  );
}
