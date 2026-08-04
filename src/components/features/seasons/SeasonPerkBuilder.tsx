'use client';

// Конструктор сезонных перков. Отличия от справочников-конкурентов, ради которых
// он вообще строился:
//   • блокируем несовместимые пары — реальный запрет BSG, сверенный кликами в клиенте;
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
import { perkIconColor, perkMaskStyle } from './perkVisual';

interface Props {
  season: Season;
  /** Билд из ссылки (/seasons/[slug]/b/[code]) — подставляется один раз при заходе. */
  initialSelection?: string[];
}

const kindStyle: Record<string, { border: string; text: string; label: string }> = {
  season: { border: 'border-lines-hover', text: 'text-text-muted', label: 'Сезонный' },
  positive: { border: 'border-nvg-green/50', text: 'text-nvg-green', label: 'Позитивный' },
  negative: { border: 'border-danger/50', text: 'text-danger', label: 'Негативный' },
};

// Стабильные пустышки: возвращать `?? []` прямо в селекторе нельзя — новый массив
// каждый рендер ломает сравнение Zustand v5 (Object.is) → бесконечный ре-рендер.
const EMPTY_SELECTION: string[] = [];
const EMPTY_HISTORY: string[][] = [];

// Сетка перков: карточки по 160px (авто-заполнение ряда), высота фиксирована на карточке.
const PERK_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2';

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
  const costLabel = perk.cost === 0 ? null : perk.cost > 0 ? `+${perk.cost}` : `${perk.cost}`;
  const effectsText = perk.effects.join(' · ');

  return (
    // Плитка фикс. высоты (160px) — ряды выравниваются. Эффекты — в тултипе:
    // показывается по hover (десктоп) и по focus-within (тап фокусит кнопку — тач).
    <div className="group relative h-40">
      <button
        type="button"
        onClick={onToggle}
        disabled={readonly || disabled}
        aria-pressed={selected}
        title={effectsText}
        className={[
          'relative flex h-full w-full flex-col items-center gap-1.5 rounded-sm border p-2 text-center transition-colors',
          selected
            ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
            : `${s.border} bg-(--color-base)`,
          disabled ? 'opacity-40' : '',
          readonly ? 'cursor-default' : 'cursor-pointer hover:border-(--primary)',
        ].join(' ')}
      >
        {/* Очки — бейджем в углу, чтобы не воровать место у иконки/названия. */}
        {costLabel && (
          <span
            className={`absolute right-1 top-1 font-blender-medium text-type-micro ${selected ? 'text-(--primary)' : s.text}`}
          >
            {costLabel}
          </span>
        )}
        {selected && (
          <Check className="absolute left-1 top-1 h-3.5 w-3.5 text-(--primary)" aria-hidden="true" />
        )}

        {/* Иконка перка: монохромный SVG, крашенный CSS-маской по типу (баф/дебаф/сезон). */}
        {perk.iconUrl ? (
          <span
            aria-hidden
            className={`size-14 shrink-0 sm:size-16 xl:size-20 ${perkIconColor[perk.kind]}`}
            style={perkMaskStyle(perk.iconUrl)}
          />
        ) : (
          <span
            aria-hidden
            className={`flex size-14 shrink-0 items-center justify-center font-blender-medium text-lg sm:size-16 xl:size-20 ${s.text}`}
          >
            {costLabel ?? '—'}
          </span>
        )}

        <span className="line-clamp-2 min-h-[2lh] font-blender-medium text-type-micro uppercase leading-tight tracking-wide text-text-primary">
          {perk.name}
        </span>

        {blockedText && !selected && (
          <span className="line-clamp-1 font-blender-medium text-type-micro uppercase tracking-widest text-tactical-amber">
            {blockedText}
          </span>
        )}
      </button>

      {/* Тултип с эффектами. bottom-full → над плиткой; на тач появляется при фокусе кнопки. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="rounded border border-lines-hover bg-card-menu px-2.5 py-2 text-left shadow-lg">
          <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-primary">
            {perk.name}
            {costLabel && <span className={`ml-1 ${s.text}`}>({costLabel})</span>}
          </span>
          <ul className="mt-1 flex flex-col gap-0.5">
            {perk.effects.map((e) => (
              <li key={e} className="font-blender-book text-type-caption leading-snug text-text-secondary">
                {e}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SeasonPerkBuilder({ season, initialSelection }: Props) {
  // Индивидуальные селекторы: каждый отдаёт стабильную ссылку (слайс стора или экшен),
  // без создания объектов/массивов в селекторе — иначе Zustand v5 зациклит ре-рендер.
  const selectedMap = useSeasonStore((s) => s.selected);
  const historyMap = useSeasonStore((s) => s.history);
  const toggle = useSeasonStore((s) => s.toggle);
  const applyPreset = useSeasonStore((s) => s.applyPreset);
  const reset = useSeasonStore((s) => s.reset);
  const undo = useSeasonStore((s) => s.undo);

  const selected = selectedMap[season.slug] ?? EMPTY_SELECTION;
  const history = historyMap[season.slug] ?? EMPTY_HISTORY;

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
    return b ? `Несовместим с «${b.withName}»` : null;
  };

  // Статус персонажа: минус баланса → добери боли; нет негатива → нужен хотя бы один;
  // иначе персонаж собран (баланс ≥ 0 И есть негатив).
  const status =
    budget.balance < 0
      ? { text: `В минусе · добери ${-budget.balance}`, cls: 'text-danger' }
      : !budget.hasNegative
        ? { text: 'Нужен хотя бы 1 минус', cls: 'text-tactical-amber' }
        : { text: 'Персонаж собран', cls: 'text-nvg-green' };

  if (!mounted) {
    return (
      <div className={PERK_GRID}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-sm bg-(--color-darkbase)" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Бюджет: липкая панель. Слева статы над полоской, справа мелкие кнопки. ── */}
      <div className="sticky top-18 z-30 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-sm border border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_88%,transparent)] p-3 backdrop-blur-md">
        {/* Слева: статы + полоска потраченного из набранного */}
        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Получено
              </span>
              <span className="font-blender-medium text-base text-danger">+{budget.granted}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Потрачено
              </span>
              <span className="font-blender-medium text-base text-nvg-green">−{budget.spent}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                Баланс
              </span>
              <span
                className={`font-blender-medium text-base ${budget.balance >= 0 ? 'text-(--primary)' : 'text-danger'}`}
              >
                {budget.balance}
              </span>
            </span>
            <span
              className={`font-blender-medium text-type-micro uppercase tracking-widest ${status.cls}`}
            >
              · {status.text}
            </span>
          </div>

          {/* Полоска: сколько набранных очков уже потрачено */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-(--color-darkbase)">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: budget.granted > 0 ? `${Math.min(100, (budget.spent / budget.granted) * 100)}%` : '0%',
                background: budget.valid ? 'var(--color-nvg-green)' : 'var(--color-danger)',
              }}
            />
          </div>
        </div>

        {/* Справа: мелкие кнопки */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => undo(season.slug)}
            disabled={history.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Отменить
          </button>
          <button
            type="button"
            onClick={() => reset(season.slug)}
            className="flex h-9 items-center gap-1.5 rounded-xs border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-danger hover:text-danger"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Сброс
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="flex h-9 items-center gap-1.5 rounded-xs border border-(--primary) px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {copied ? 'Скопировано' : 'Поделиться'}
          </button>
        </div>
      </div>

      {/* ── Выбор: бафы слева, дебафы справа (lg+); ниже — стек ── */}
      <div className="grid gap-x-6 gap-y-8 lg:grid-cols-2">
        {/* Позитивные */}
        <section className="flex flex-col gap-3">
          <h2 className="font-blender-medium text-sm uppercase tracking-widest text-nvg-green">
            Позитивные · тратят очки
          </h2>
          <div className={PERK_GRID}>
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

        {/* Негативные */}
        <section className="flex flex-col gap-3">
          <h2 className="font-blender-medium text-sm uppercase tracking-widest text-danger">
            Негативные · дают очки
          </h2>
          <div className={PERK_GRID}>
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
      </div>

      {/* ── Сезонные: выбора нет, но игрок должен их видеть ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-muted">
          Сезонные · действуют на всех
        </h2>
        <div className={PERK_GRID}>
          {forced.map((p) => (
            <PerkCard key={p.id} perk={p} selected={false} blockedText={null} />
          ))}
        </div>
      </section>
    </div>
  );
}
