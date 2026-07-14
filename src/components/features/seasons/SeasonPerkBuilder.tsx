'use client';

// Конструктор сезонных перков. Отличия от справочников-конкурентов, ради которых
// он вообще строился:
//   • блокируем взаимно гасящие пары (−25% кровотечения + 25% кровотечения = слитые очки);
//   • позитивный перк, который сейчас не по карману, гаснет и говорит, скольких очков
//     не хватает — бюджет объясняет себя сам;
//   • снятие негатива каскадом снимает то, что он оплачивал, а не ломает билд молча;
//   • архетипы-пресеты и ссылка-шаринг.
import { useEffect, useMemo, useState } from 'react';
import { Check, Link2, RotateCcw, Undo2 } from 'lucide-react';
import type { Season, SeasonPerk } from '@/data/eft-seasons';
import {
  computeBudget,
  encodeBuild,
  perkStates,
  personalPerks,
  seasonPerks,
} from '@/lib/season-points';
import { useSeasonStore } from '@/store/useSeasonStore';

interface Props {
  season: Season;
  /** Билд из ссылки (/seasons/[slug]/b/[code]) — подставляется один раз при заходе. */
  initialSelection?: string[];
}

/** Архетипы: считаются от реальных цен, чтобы не разъехаться при правке данных. */
const PRESETS: { id: string; label: string; hint: string; perks: string[] }[] = [
  {
    id: 'kappa-rush',
    label: 'Каппа-раш',
    hint: 'Терпим всю боль ради контейнера с первого рейда',
    perks: [
      'kappa-protocol',
      'no-flea-market',
      'exhaustion',
      'incompetent',
      'osteoporosis',
      'broken-secure-container',
      'allergic',
      'well-that-hurt',
    ],
  },
  {
    id: 'newbie',
    label: 'Новичок',
    hint: 'Комфорт без тяжёлых расплат: выживаемость и навыки',
    perks: ['average', 'sturdy-bones', 'polyphagia', 'no-flea-market', 'personality-vacuum', 'dr-jekyll', 'third-leg'],
  },
  {
    id: 'stealth',
    label: 'Тихий ход',
    hint: 'Кусты, выносливость, ключи — про перемещение и лут',
    perks: ['bushborne', 'safecracker', 'marathon-runner', 'no-flea-market', 'exhaustion', 'osteoporosis', 'hemophilia'],
  },
  {
    id: 'hardcore',
    label: 'Хардкор',
    hint: 'Только боль. Очки не тратим — собираем страдание',
    perks: [
      'no-flea-market',
      'exhaustion',
      'incompetent',
      'broken-secure-container',
      'osteoporosis',
      'allergic',
      'hemophilia',
      'well-that-hurt',
      'personality-vacuum',
      'polydipsia',
      'chronic-fatigue',
      'dr-jekyll',
      'third-leg',
    ],
  },
];

const kindStyle: Record<string, { border: string; text: string; label: string }> = {
  season: { border: 'border-lines-hover', text: 'text-text-muted', label: 'Сезонный' },
  positive: { border: 'border-success/50', text: 'text-success', label: 'Позитивный' },
  negative: { border: 'border-danger/50', text: 'text-danger', label: 'Негативный' },
};

function PerkCard({
  perk,
  selected,
  blockedText,
  onToggle,
}: {
  perk: SeasonPerk;
  selected: boolean;
  blockedText: string | null;
  onToggle?: () => void;
}) {
  const s = kindStyle[perk.kind];
  const readonly = !onToggle;
  const disabled = !!blockedText && !selected;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={readonly || disabled}
      aria-pressed={selected}
      className={[
        'flex min-h-27 flex-col gap-2 rounded-sm border p-3 text-left transition-colors',
        selected
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
          : `${s.border} bg-(--color-base)`,
        disabled ? 'opacity-40' : '',
        readonly ? 'cursor-default' : 'cursor-pointer hover:border-(--primary)',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          {/* Иконки перков появятся отдельным коммитом — пока типизированная плашка. */}
          <span
            aria-hidden
            className={`flex size-9 shrink-0 items-center justify-center rounded-xs border ${s.border} font-blender-medium text-xs ${s.text}`}
          >
            {perk.cost === 0 ? '—' : perk.cost > 0 ? `+${perk.cost}` : perk.cost}
          </span>
          <span className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {perk.name}
          </span>
        </span>

        {selected && <Check className="h-4 w-4 shrink-0 text-(--primary)" aria-hidden="true" />}
      </div>

      <ul className="flex flex-col gap-1">
        {perk.effects.map((e) => (
          <li key={e} className="font-blender-book text-xs leading-relaxed text-text-secondary">
            {e}
          </li>
        ))}
      </ul>

      {blockedText && !selected && (
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
          {blockedText}
        </span>
      )}
    </button>
  );
}

export function SeasonPerkBuilder({ season, initialSelection }: Props) {
  const { selected, toggle, applyPreset, reset, undo, history } = useSeasonStore((s) => ({
    selected: s.selected[season.slug] ?? [],
    toggle: s.toggle,
    applyPreset: s.applyPreset,
    reset: s.reset,
    undo: s.undo,
    history: s.history[season.slug] ?? [],
  }));

  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);

  // Билд из ссылки применяем один раз — дальше правит игрок.
  useEffect(() => {
    if (initialSelection?.length) applyPreset(season.slug, initialSelection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const budget = useMemo(() => computeBudget(season, selected), [season, selected]);
  const states = useMemo(() => perkStates(season, selected), [season, selected]);

  const positives = personalPerks(season).filter((p) => p.cost < 0);
  const negatives = personalPerks(season).filter((p) => p.cost > 0);
  const forced = seasonPerks(season);

  const share = async () => {
    const url = `${window.location.origin}/eft/progress/seasons/${season.slug}/b/${encodeBuild(selected)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const blockText = (id: string): string | null => {
    const b = states[id]?.blocked;
    if (!b) return null;
    return b.kind === 'points'
      ? `Не хватает ${b.missing} оч.`
      : `Гасится перком «${b.withName}»`;
  };

  if (!mounted) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-27 animate-pulse rounded-sm bg-(--color-darkbase)" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Бюджет: липкая панель, потому что это главный смысл экрана ── */}
      <div className="sticky top-18 z-30 flex flex-wrap items-center gap-3 rounded-sm border border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_88%,transparent)] p-3 backdrop-blur-md">
        <span className="flex flex-col">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Получено
          </span>
          <span className="font-blender-medium text-lg text-danger">+{budget.granted}</span>
        </span>

        <span className="flex flex-col">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Потрачено
          </span>
          <span className="font-blender-medium text-lg text-success">−{budget.spent}</span>
        </span>

        <span className="flex flex-col">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Баланс
          </span>
          <span
            className={`font-blender-medium text-lg ${budget.valid ? 'text-(--primary)' : 'text-danger'}`}
          >
            {budget.balance}
          </span>
        </span>

        <span
          className={`rounded-xs border px-2 py-1 font-blender-medium text-type-micro uppercase tracking-widest ${
            budget.valid
              ? 'border-success/50 bg-success/10 text-success'
              : 'border-danger/50 bg-danger/10 text-danger'
          }`}
        >
          {budget.valid ? 'Персонаж собран' : 'Баланс в минусе'}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => undo(season.slug)}
            disabled={history.length === 0}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Отменить
          </button>
          <button
            type="button"
            onClick={() => reset(season.slug)}
            className="flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-danger hover:text-danger"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Сброс
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="flex h-11 items-center gap-2 rounded-xs border border-(--primary) px-3 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
          >
            <Link2 className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Ссылка скопирована' : 'Поделиться'}
          </button>
        </span>
      </div>

      {/* ── Архетипы ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Готовые стратегии
        </h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const b = computeBudget(season, p.perks);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(season.slug, p.perks)}
                title={p.hint}
                className="flex flex-col items-start gap-0.5 rounded-xs border border-lines-hover px-3 py-2 text-left transition-colors hover:border-(--primary)"
              >
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary">
                  {p.label}
                </span>
                <span className="font-blender-book text-xs text-text-muted">
                  {p.hint} · остаток {b.balance}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Позитивные ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-success">
          Позитивные · тратят очки
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {positives.map((p) => (
            <PerkCard
              key={p.id}
              perk={p}
              selected={states[p.id]?.selected ?? false}
              blockedText={blockText(p.id)}
              onToggle={() => toggle(season.slug, p.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Негативные ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-danger">
          Негативные · дают очки
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {negatives.map((p) => (
            <PerkCard
              key={p.id}
              perk={p}
              selected={states[p.id]?.selected ?? false}
              blockedText={blockText(p.id)}
              onToggle={() => toggle(season.slug, p.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Сезонные: выбора нет, но игрок должен их видеть ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-muted">
          Сезонные · действуют на всех
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {forced.map((p) => (
            <PerkCard key={p.id} perk={p} selected={false} blockedText={null} />
          ))}
        </div>
      </section>
    </div>
  );
}
