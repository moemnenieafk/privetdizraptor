'use client';

// Биржа шерпов: наставники (анкеты goal='sherpa') со статистикой сессий и долей
// положительных отзывов. Тот же контакт-паттерн, что в «Кандидатах»: Discord +
// «Мы сыграли» после сессии. Подтверждённая сессия даёт шерпе +15 кармы.
//
// Отличие от официальной программы BSG (70 волонтёров, очередь в тикетах): у нас
// шерпой становится любой — но доверие видно по цифрам, а не по значку.
import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Swords,
  ThumbsUp,
  Users,
} from 'lucide-react';
import type { SherpaListItem } from '@/db/sherpa';

const TIER_CLASS: Record<string, string> = {
  legend: 'border-(--primary) text-(--primary)',
  veteran: 'border-success/60 text-success',
  fighter: 'border-lines-hover text-text-primary',
  wild: 'border-lines-hover text-text-secondary',
};

export function SherpaExchangeClient({ authorized }: { authorized: boolean }) {
  const [items, setItems] = useState<SherpaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    try {
      const res = await fetch('/api/comlink/sherpas');
      if (res.ok) {
        const data = (await res.json()) as { items: SherpaListItem[] };
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [authorized]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!authorized) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <GraduationCap className="h-8 w-8 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Только для бойцов ЦТА
        </h2>
        <p className="max-w-md font-blender-book text-sm text-text-secondary">
          Войдите, чтобы найти наставника — или стать им: официальных шерпов на всех
          не хватает, а здесь доверие видно по цифрам.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-52 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <GraduationCap className="h-8 w-8 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Шерпов пока нет
        </h2>
        <p className="max-w-md font-blender-book text-sm text-text-secondary">
          Знаете игру и готовы проводить новичков? Создайте анкету в «Кандидатах»
          с целью «Готов обучать» — каждая подтверждённая сессия даёт +15 кармы.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {items.map((s) => (
        <SherpaCard key={s.userId} s={s} />
      ))}
    </div>
  );
}

function SherpaCard({ s }: { s: SherpaListItem }) {
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [inviteError, setInviteError] = useState('');

  const copyDiscord = async () => {
    if (!s.discord) return;
    try {
      await navigator.clipboard.writeText(s.discord);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Discord:', s.discord);
    }
  };

  const sendInvite = async () => {
    setInvite('busy');
    try {
      const res = await fetch('/api/comlink/raids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: s.userId, note: 'Сессия с шерпой' }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setInviteError(data.error ?? 'Не получилось');
        setInvite('error');
        return;
      }
      setInvite('sent');
    } catch {
      setInviteError('Сеть недоступна');
      setInvite('error');
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase)">
          {s.avatarUrl ? (
            <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Users className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {s.username}
          </span>
          <span className="font-blender-book text-xs text-text-secondary">Наставник</span>
        </div>

        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-1 font-blender-medium text-xs uppercase tracking-widest ${TIER_CLASS[s.karma.tierId] ?? TIER_CLASS.wild}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {s.karma.tierLabel} · {s.karma.total}
        </span>
      </div>

      {/* Статистика наставника — цифры вместо значка */}
      <div className="flex flex-wrap gap-3 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-medium text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          Сессий: <span className="text-text-primary">{s.sessions}</span>
        </span>
        {s.positiveShare !== null && (
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            Положительных: <span className="text-text-primary">{Math.round(s.positiveShare * 100)}%</span>
          </span>
        )}
        {s.game && (
          <span>
            Ур. <span className="text-text-primary">{s.game.level}</span> · {s.game.faction}
          </span>
        )}
      </div>

      {s.about && (
        <p className="line-clamp-3 font-blender-book text-sm text-text-secondary">{s.about}</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {s.discord ? (
          <button
            type="button"
            onClick={copyDiscord}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Discord: {s.discord}
              </>
            )}
          </button>
        ) : (
          <p className="flex-1 self-center font-blender-book text-xs text-text-secondary/70">
            Discord не привязан.
          </p>
        )}

        {invite === 'sent' ? (
          <span className="flex h-11 items-center justify-center gap-2 rounded-xs border border-success/60 px-4 font-blender-medium text-xs uppercase tracking-widest text-success">
            <Check className="h-4 w-4" aria-hidden="true" />
            Заявка отправлена
          </span>
        ) : (
          <button
            type="button"
            disabled={invite === 'busy'}
            onClick={sendInvite}
            title="Жмите после сессии — шерпа подтвердит и получит +15 кармы"
            className="flex h-11 items-center justify-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
          >
            {invite === 'busy' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Swords className="h-4 w-4" aria-hidden="true" />
            )}
            Мы провели сессию
          </button>
        )}
      </div>

      {invite === 'error' && (
        <p className="font-blender-book text-xs text-danger">{inviteError}</p>
      )}
    </article>
  );
}
