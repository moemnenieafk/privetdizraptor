'use client';

// Список кандидатов + моя анкета. Клиентский: фильтры без перезагрузки, данные
// приватные (Discord-хендлы) — SSR-кэшировать нельзя, всё через /api/comlink/*.
//
// Козырь против Discord-LFG: уровень/фракция в карточке — снимок из трекера ЦТА,
// а не слова. Карма — бейдж уровня доверия, считается из подтверждённых действий.
import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Check,
  Headphones,
  Loader2,
  MicOff,
  Pencil,
  Plus,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react';
import { ComlinkProfileForm } from '@/components/features/comlink/ComlinkProfileForm';
import { VerificationCard } from '@/components/features/players/VerificationCard';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import type { CandidateListItem } from '@/db/comlink';
import type { ComlinkGoal, ComlinkProfileRow } from '@/db/schema-comlink';
import { EFT_MAP_CONFIG } from '@/data/eft-map-config';

const GOAL_LABELS: Record<ComlinkGoal, string> = {
  partner: 'Ищу напарника',
  team: 'Ищу команду',
  student: 'Хочу научиться',
  sherpa: 'Готов обучать',
};

const TIME_LABELS: Record<string, string> = {
  morning: 'Утро',
  day: 'День',
  evening: 'Вечер',
  night: 'Ночь',
};

const STYLE_LABELS: Record<string, string> = {
  pvp: 'ПВП',
  loot: 'Лут',
  quests: 'Квесты',
  chill: 'Чилл',
};

const MAP_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(EFT_MAP_CONFIG).map(([slug, c]) => [slug, c.displayName ?? slug]),
);

/** Цвет бейджа кармы по уровню доверия. */
const TIER_CLASS: Record<string, string> = {
  legend: 'border-(--primary) text-(--primary)',
  veteran: 'border-success/60 text-success',
  fighter: 'border-lines-hover text-text-primary',
  wild: 'border-lines-hover text-text-secondary',
};

type View = 'list' | 'form';

interface CandidatesClientProps {
  /** null — не авторизован: список не показываем, зовём войти. */
  authorized: boolean;
}

export function CandidatesClient({ authorized }: CandidatesClientProps) {
  const [view, setView] = useState<View>('list');
  const [items, setItems] = useState<CandidateListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [own, setOwn] = useState<ComlinkProfileRow | null>(null);

  const [goal, setGoal] = useState<ComlinkGoal | null>(null);
  const [mapSlug, setMapSlug] = useState<string | null>(null);
  const [voiceOnly, setVoiceOnly] = useState(false);

  const load = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);

    const qs = new URLSearchParams();
    if (goal) qs.set('goal', goal);
    if (mapSlug) qs.set('map', mapSlug);
    if (voiceOnly) qs.set('voice', '1');

    try {
      const [candidates, mine] = await Promise.all([
        fetch(`/api/comlink/candidates?${qs}`).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/comlink/profile').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (candidates) {
        setItems(candidates.items as CandidateListItem[]);
        setTotal(candidates.total as number);
      }
      if (mine) setOwn(mine.profile as ComlinkProfileRow | null);
    } finally {
      setLoading(false);
    }
  }, [authorized, goal, mapSlug, voiceOnly]);

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
          Анкеты, контакты и карма видны только авторизованным — так соц-раздел закрыт
          от парсеров и случайных людей. Войдите, чтобы найти напарника.
        </p>
      </div>
    );
  }

  if (view === 'form') {
    return (
      <ComlinkProfileForm
        initial={own}
        onDone={() => {
          setView('list');
          void load();
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Подтверждение ЧВК-профиля — галочка в анкете (платные тиры) */}
      <VerificationCard />

      {/* Моя анкета */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {total} анкет
        </p>
        <button
          type="button"
          onClick={() => setView('form')}
          className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-4 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
        >
          {own ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          {own ? 'Моя анкета' : 'Создать анкету'}
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex flex-col gap-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={goal === null} onClick={() => setGoal(null)} label="Все цели" />
          {(Object.keys(GOAL_LABELS) as ComlinkGoal[]).map((g) => (
            <Chip key={g} active={goal === g} onClick={() => setGoal(goal === g ? null : g)} label={GOAL_LABELS[g]} />
          ))}
          <Chip
            active={voiceOnly}
            onClick={() => setVoiceOnly((v) => !v)}
            label="С голосом"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={mapSlug === null} onClick={() => setMapSlug(null)} label="Любая карта" />
          {Object.entries(MAP_NAMES).map(([slug, name]) => (
            <Chip
              key={slug}
              active={mapSlug === slug}
              onClick={() => setMapSlug(mapSlug === slug ? null : slug)}
              label={name}
            />
          ))}
        </div>
      </div>

      {/* Список */}
      {loading ? (
        <CardsSkeleton />
      ) : items.length === 0 ? (
        <p className="py-10 text-center font-blender-book text-sm text-text-secondary">
          По этим фильтрам никого. Снимите фильтр — или станьте первым: создайте анкету.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((c) => (
            <CandidateCard key={c.userId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── карточка кандидата ─────────────────── */

function CandidateCard({ c }: { c: CandidateListItem }) {
  const [copied, setCopied] = useState(false);

  const copyDiscord = async () => {
    if (!c.discord) return;
    try {
      await navigator.clipboard.writeText(c.discord);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Discord:', c.discord);
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4 transition-colors hover:border-(--primary)">
      {/* Шапка: ник + карма */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-(--color-darkbase)">
          {c.avatarUrl ? (
            <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Users className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate font-blender-medium text-sm uppercase tracking-widest text-text-primary">
              {c.username}
            </span>
            {c.verified && (
              <VerifiedBadge title={`ЧВК-профиль «${c.verifiedNickname}» подтверждён`} />
            )}
          </span>
          <span className="font-blender-book text-xs text-text-secondary">
            {GOAL_LABELS[c.goal]}
          </span>
        </div>

        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-xs border px-2 py-1 font-blender-medium text-xs uppercase tracking-widest ${TIER_CLASS[c.karma.tierId] ?? TIER_CLASS.wild}`}
          title={`Карма: ${c.karma.total}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {c.karma.tierLabel} · {c.karma.total}
        </span>
      </div>

      {/* Игровой профиль — снимок из трекера, не слова */}
      {c.game && (
        <div className="flex flex-wrap gap-3 rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-medium text-xs text-text-secondary">
          <span>
            Ур. <span className="text-text-primary">{c.game.level}</span>
          </span>
          <span className="text-text-primary">{c.game.faction}</span>
          <span>{c.game.mode}</span>
          {c.confirmedRaids > 0 && (
            <span>
              Рейдов через ЦТА: <span className="text-text-primary">{c.confirmedRaids}</span>
            </span>
          )}
        </div>
      )}

      {/* Параметры */}
      <div className="flex flex-wrap gap-1.5">
        <span className="flex items-center gap-1 rounded-xs border border-lines-hover px-2 py-0.5 font-blender-medium text-xs text-text-secondary">
          {c.voice ? (
            <Headphones className="h-3 w-3" aria-hidden="true" />
          ) : (
            <MicOff className="h-3 w-3" aria-hidden="true" />
          )}
          {c.voice ? 'Голос' : 'Без голоса'}
        </span>
        {c.playTime.map((t) => (
          <Tag key={t} label={TIME_LABELS[t] ?? t} />
        ))}
        {c.playStyle.map((s) => (
          <Tag key={s} label={STYLE_LABELS[s] ?? s} />
        ))}
        {c.maps.slice(0, 4).map((m) => (
          <Tag key={m} label={MAP_NAMES[m] ?? m} />
        ))}
        {c.maps.length > 4 && <Tag label={`+${c.maps.length - 4}`} />}
        {c.tzOffset !== null && <Tag label={`МСК${c.tzOffset >= 0 ? '+' : ''}${c.tzOffset}`} />}
      </div>

      {c.about && (
        <p className="line-clamp-3 font-blender-book text-sm text-text-secondary">{c.about}</p>
      )}

      {/* Контакт: Discord-хендл, связь на сервере fullkamen (ссылка в футере) */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {c.discord ? (
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
                Discord: {c.discord}
              </>
            )}
          </button>
        ) : (
          <p className="flex-1 self-center font-blender-book text-xs text-text-secondary/70">
            Discord не привязан — игрок появится на связи, когда добавит хендл.
          </p>
        )}

        <InviteButton userId={c.userId} />
      </div>
    </article>
  );
}

/* ─────────────────── «мы сыграли» ─────────────────── */

/**
 * Заявка на подтверждение рейда: жмётся ПОСЛЕ игры (нашлись в Discord → сыграли →
 * фиксируем здесь). Партнёр подтверждает во «Входящих» — +5 кармы обоим.
 */
function InviteButton({ userId }: { userId: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const invite = async () => {
    setState('busy');
    try {
      const res = await fetch('/api/comlink/raids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? 'Не получилось');
        setState('error');
        return;
      }
      setState('sent');
    } catch {
      setMessage('Сеть недоступна');
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <span className="flex h-11 items-center justify-center gap-2 rounded-xs border border-success/60 px-4 font-blender-medium text-xs uppercase tracking-widest text-success">
        <Check className="h-4 w-4" aria-hidden="true" />
        Заявка отправлена
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={invite}
        title="Жмите после совместной игры — партнёр подтвердит, оба получите +5 кармы"
        className="flex h-11 items-center justify-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
      >
        {state === 'busy' ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Swords className="h-4 w-4" aria-hidden="true" />
        )}
        Мы сыграли
      </button>
      {state === 'error' && (
        <span className="font-blender-book text-xs text-danger">{message}</span>
      )}
    </div>
  );
}

/* ─────────────────── мелочь ─────────────────── */

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
        active
          ? 'border-(--primary) text-(--primary)'
          : 'border-lines-hover text-text-secondary hover:border-(--primary)'
      }`}
    >
      {label}
    </button>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-xs border border-lines-hover px-2 py-0.5 font-blender-medium text-xs text-text-secondary">
      {label}
    </span>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-4">
          <div className="h-11 w-full animate-pulse rounded-xs bg-card-menu" aria-hidden="true" />
          <div className="h-8 w-2/3 animate-pulse rounded-xs bg-card-menu" aria-hidden="true" />
          <div className="h-11 w-full animate-pulse rounded-xs bg-card-menu" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
