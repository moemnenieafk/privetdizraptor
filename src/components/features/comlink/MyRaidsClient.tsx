'use client';

// «Мои рейды» — входящие заявки, исходящие, подтверждённые на оценку.
// Живёт на /eft/comlink/find-partner: «Поиск напарника» = мои связи, а анкеты — в
// «Кандидатах». Оценка: 👍/👎, минус требует пояснения; отзывы скрыты до обоюдной
// сдачи или 72ч (анти-месть) — об этом честно пишем под формой.
import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react';
import type { RaidListItem } from '@/db/comlink-raids';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ждёт ответа',
  confirmed: 'Подтверждён',
  declined: 'Отклонён',
  expired: 'Протух',
};

export function MyRaidsClient({ authorized }: { authorized: boolean }) {
  const [raids, setRaids] = useState<RaidListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    try {
      const res = await fetch('/api/comlink/raids');
      if (res.ok) {
        const data = (await res.json()) as { raids: RaidListItem[] };
        setRaids(data.raids);
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
        <Users className="h-8 w-8 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Только для бойцов ЦТА
        </h2>
        <p className="max-w-md font-blender-book text-sm text-text-secondary">
          Войдите, чтобы звать игроков в рейд и подтверждать совместные вылазки —
          из них растёт карма.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-sm bg-card-menu" aria-hidden="true" />
        ))}
      </div>
    );
  }

  const incoming = raids.filter((r) => r.role === 'partner' && r.status === 'pending');
  const toReview = raids.filter((r) => r.canReview);
  const rest = raids.filter((r) => !incoming.includes(r) && !toReview.includes(r));

  if (raids.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-sm border border-lines-hover bg-(--color-base) px-6 py-14 text-center">
        <Users className="h-8 w-8 text-(--primary)" aria-hidden="true" />
        <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
          Рейдов пока нет
        </h2>
        <p className="max-w-md font-blender-book text-sm text-text-secondary">
          Найдите игрока в «Кандидатах», спишитесь в Discord, сыграйте — и позовите его
          здесь кнопкой «Мы сыграли». Подтверждённый рейд даёт +5 кармы обоим.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {incoming.length > 0 && (
        <Section title={`Входящие · ${incoming.length}`}>
          {incoming.map((r) => (
            <RaidCard key={r.id} raid={r} onChanged={load} />
          ))}
        </Section>
      )}

      {toReview.length > 0 && (
        <Section title={`Ждут оценки · ${toReview.length}`}>
          {toReview.map((r) => (
            <RaidCard key={r.id} raid={r} onChanged={load} />
          ))}
        </Section>
      )}

      {rest.length > 0 && (
        <Section title="История">
          {rest.map((r) => (
            <RaidCard key={r.id} raid={r} onChanged={load} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ─────────────────── карточка рейда ─────────────────── */

function RaidCard({ raid, onChanged }: { raid: RaidListItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [positive, setPositive] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patch = async (payload: object) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/comlink/raids/${raid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Не получилось');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const submitReview = () => {
    if (positive === null) return;
    void patch({ action: 'review', positive, comment });
  };

  return (
    <article className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase)">
          {raid.otherAvatar ? (
            <img src={raid.otherAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <Users className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {raid.otherName}
          </span>
          <span className="font-blender-book text-xs text-text-secondary">
            {raid.role === 'partner' ? 'позвал(а) вас в рейд' : 'вы позвали в рейд'}
            {raid.note ? ` · ${raid.note}` : ''}
          </span>
        </div>

        <span className="flex shrink-0 items-center gap-1.5 font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {STATUS_LABELS[raid.status] ?? raid.status}
        </span>
      </div>

      {/* Входящая: подтвердить/отклонить */}
      {raid.role === 'partner' && raid.status === 'pending' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch({ action: 'accept' })}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            Подтвердить (+5 обоим)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void patch({ action: 'decline' })}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:border-danger hover:text-danger disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Не играли
          </button>
        </div>
      )}

      {/* Подтверждён: оценка */}
      {raid.canReview && !reviewing && (
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xs border border-(--primary) font-blender-medium text-xs uppercase tracking-widest text-(--primary) hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          Оценить напарника
        </button>
      )}

      {raid.canReview && reviewing && (
        <div className="flex flex-col gap-2 rounded-xs border border-lines-hover bg-(--color-darkbase) p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPositive(true)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border font-blender-medium text-xs uppercase tracking-widest ${
                positive === true
                  ? 'border-success text-success'
                  : 'border-lines-hover text-text-secondary hover:border-success hover:text-success'
              }`}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Хороший напарник (+10)
            </button>
            <button
              type="button"
              onClick={() => setPositive(false)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border font-blender-medium text-xs uppercase tracking-widest ${
                positive === false
                  ? 'border-danger text-danger'
                  : 'border-lines-hover text-text-secondary hover:border-danger hover:text-danger'
              }`}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              Плохой опыт (−2, вам −1)
            </button>
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 300))}
            rows={2}
            placeholder={
              positive === false
                ? 'Что пошло не так? Для минуса пояснение обязательно (от 10 символов)'
                : 'Комментарий (необязательно)'
            }
            className="w-full rounded-xs border border-lines-hover bg-(--color-base) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
          />

          <button
            type="button"
            disabled={busy || positive === null}
            onClick={submitReview}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] font-blender-medium text-xs uppercase tracking-widest text-(--primary) disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            Отправить оценку
          </button>

          <p className="font-blender-book text-xs text-text-secondary/70">
            Оценки скрыты, пока обе стороны не сдадут свои (или 72 часа) — мстительный
            минус в ответ не сработает.
          </p>
        </div>
      )}

      {raid.status === 'confirmed' && raid.reviewed && (
        <p className="font-blender-book text-xs text-success">Вы оценили этот рейд.</p>
      )}

      {error && <p className="font-blender-book text-xs text-danger">{error}</p>}
    </article>
  );
}
