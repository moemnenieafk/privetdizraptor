'use client';

// Развлекательный слой над конструктором перков: вместо сухих чипов-пресетов —
// «Генератор вызова». Крутишь барабан → выпадает курируемый билд (мета/мем/боль);
// «Хаос» собирает случайный ВАЛИДНЫЙ билд математикой бюджета. «Собрать» заряжает
// выбор в конструктор ниже (applyPreset) и скроллит к нему.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dices, Skull, Shield, Hammer, Check, Repeat } from 'lucide-react';
import type { Season, SeasonPerk } from '@/data/eft-seasons';
import {
  getSeasonBuilds,
  VIBE_META,
  type CuratedBuild,
  type BuildVibe,
} from '@/data/season-builds';
import { computeBudget, personalPerks } from '@/lib/season-points';
import { useSeasonStore } from '@/store/useSeasonStore';
import { useSfx } from '@/hooks/useSfx';

interface Props {
  season: Season;
}

const MAX_PAIN = 34; // сумма всех негативных очков — потолок «боли»
const MAX_COMFORT = 29; // «троица снабженца» (Каппа+Медвежатник+Смотритель) — потолок трат

const CHAOS_ADJ = ['Пьяный', 'Кривой', 'Сомнительный', 'Тактический', 'Святой', 'Проклятый', 'Дерзкий', 'Абсурдный'];
const CHAOS_NOUN = ['вердикт', 'замес', 'винегрет', 'коктейль', 'эксперимент', 'приговор', 'план', 'расклад'];

function rnd<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function SeasonBuildGallery({ season }: Props) {
  const applyPreset = useSeasonStore((s) => s.applyPreset);
  const { play } = useSfx();

  const builds = useMemo(() => getSeasonBuilds(season.slug), [season.slug]);
  const perkMap = useMemo(
    () => new Map<string, SeasonPerk>(season.perks.map((p) => [p.id, p])),
    [season],
  );

  const vibes = useMemo(() => {
    const set = new Set<BuildVibe>();
    builds.forEach((b) => set.add(b.vibe));
    return [...set];
  }, [builds]);

  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<BuildVibe | 'all'>('all');
  const [featured, setFeatured] = useState<CuratedBuild | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setMounted(true);
    setFeatured(rnd(builds));
    return () => timers.current.forEach(clearTimeout);
  }, [builds]);

  const filtered = useMemo(
    () => (filter === 'all' ? builds : builds.filter((b) => b.vibe === filter)),
    [builds, filter],
  );

  // ── Случайный валидный билд («Хаос») ─────────────────────────────
  const makeChaos = useCallback((): CuratedBuild => {
    const personal = personalPerks(season);
    const negs = shuffle(personal.filter((p) => p.cost > 0));
    const pos = shuffle(personal.filter((p) => p.cost < 0));
    const taken = new Set<string>();
    const conflicts = (p: SeasonPerk) =>
      (p.excludes ?? []).some((id) => taken.has(id)) ||
      [...taken].some((id) => (perkMap.get(id)?.excludes ?? []).includes(p.id));

    for (const p of negs) {
      if (Math.random() < 0.55 && !conflicts(p)) taken.add(p.id);
    }
    let balance = [...taken].reduce((s, id) => s + (perkMap.get(id)?.cost ?? 0), 0);
    for (const p of pos) {
      const price = -p.cost;
      if (price <= balance && !conflicts(p)) {
        taken.add(p.id);
        balance -= price;
      }
    }
    if (taken.size === 0) taken.add('third-leg');
    return {
      id: `chaos-${Date.now()}`,
      name: `${rnd(CHAOS_ADJ)} ${rnd(CHAOS_NOUN)}`,
      tagline: 'Судьба собрала это за тебя. Живи с этим 74 дня.',
      vibe: 'meme',
      perks: [...taken],
    };
  }, [season, perkMap]);

  // ── Барабан ──────────────────────────────────────────────────────
  const spinTo = useCallback(
    (final: CuratedBuild) => {
      if (spinning) return;
      setSpinning(true);
      setApplied(null);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const seq = [70, 70, 90, 110, 140, 180, 240, 320, 440];
      let acc = 0;
      seq.forEach((d, i) => {
        acc += d;
        timers.current.push(
          setTimeout(() => {
            setFeatured(i === seq.length - 1 ? final : rnd(builds));
            play('tick');
          }, acc),
        );
      });
      timers.current.push(
        setTimeout(() => {
          setSpinning(false);
          play('coins');
        }, acc + 40),
      );
    },
    [spinning, builds, play],
  );

  const applyBuild = useCallback(
    (b: CuratedBuild) => {
      applyPreset(season.slug, b.perks);
      setApplied(b.id);
      play('confirm');
      document.getElementById('season-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [applyPreset, season.slug, play],
  );

  if (!mounted || !featured) {
    return (
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-52 w-full animate-pulse rounded-lg bg-card-menu" />
        <div className="h-9 w-full animate-pulse rounded bg-card-menu" />
      </div>
    );
  }

  return (
    <div className="mb-9 flex flex-col gap-5">
      {/* ── Генератор ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            Генератор вызова
          </h2>
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            {builds.length} готовых билдов
          </span>
        </div>

        <FeaturedCard
          build={featured}
          perkMap={perkMap}
          season={season}
          spinning={spinning}
          applied={applied === featured.id}
          onApply={() => applyBuild(featured)}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => spinTo(rnd(filtered.length ? filtered : builds))}
            disabled={spinning}
            className="flex items-center justify-center gap-2 rounded px-4 py-3.5 font-blender-medium text-sm uppercase tracking-widest transition-all duration-150 disabled:opacity-50"
            style={{
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            }}
          >
            <Repeat size={15} className={spinning ? 'animate-spin' : ''} />
            {spinning ? 'Крутим…' : 'Крутить'}
          </button>
          <button
            type="button"
            onClick={() => spinTo(makeChaos())}
            disabled={spinning}
            className="flex items-center justify-center gap-2 border border-lines-hover bg-card-menu px-4 py-3.5 font-blender-medium text-sm uppercase tracking-widest text-text-secondary transition-colors duration-150 hover:text-(--primary) disabled:opacity-50"
          >
            <Dices size={15} />
            Хаос
          </button>
        </div>
      </section>

      {/* ── Каталог ── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Все" color="var(--color-text-secondary)" />
          {vibes.map((v) => (
            <FilterChip
              key={v}
              active={filter === v}
              onClick={() => setFilter(v)}
              label={VIBE_META[v].label}
              color={VIBE_META[v].color}
            />
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <GridCard
              key={b.id}
              build={b}
              perkMap={perkMap}
              season={season}
              applied={applied === b.id}
              onApply={() => applyBuild(b)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Мета-строка билда (боль/комфорт/баланс) ───────────────────────
function useBuildMeta(build: CuratedBuild, season: Season) {
  return useMemo(() => {
    const b = computeBudget(season, build.perks);
    return {
      pain: b.granted,
      comfort: b.spent,
      balance: b.balance,
      valid: b.valid,
      painPct: Math.min(100, (b.granted / MAX_PAIN) * 100),
      comfortPct: Math.min(100, (b.spent / MAX_COMFORT) * 100),
    };
  }, [build, season]);
}

function MeterRow({ pain, comfort }: { pain: number; comfort: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Meter icon="pain" value={pain} color="var(--color-danger)" />
      <Meter icon="comfort" value={comfort} color="var(--color-success)" />
    </div>
  );
}

function Meter({ icon, value, color }: { icon: 'pain' | 'comfort'; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon === 'pain' ? (
        <Skull size={12} style={{ color }} className="shrink-0" />
      ) : (
        <Shield size={12} style={{ color }} className="shrink-0" />
      )}
      <div className="h-1 flex-1 overflow-hidden bg-lines-hover">
        <div className="h-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function PerkIcons({
  build,
  perkMap,
  limit,
}: {
  build: CuratedBuild;
  perkMap: Map<string, SeasonPerk>;
  limit: number;
}) {
  const shown = build.perks.slice(0, limit);
  const rest = build.perks.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((id) => {
        const p = perkMap.get(id);
        const border = p && p.cost < 0 ? 'border-success/50' : 'border-danger/50';
        return p?.iconUrl ? (
          <img
            key={id}
            src={p.iconUrl}
            alt=""
            aria-hidden
            title={p.name}
            className={`size-7 shrink-0 rounded-xs border object-contain p-0.5 ${border}`}
          />
        ) : (
          <span
            key={id}
            className={`flex size-7 shrink-0 items-center justify-center rounded-xs border font-blender-medium text-type-micro text-text-muted ${border}`}
          >
            {p ? (p.cost > 0 ? `+${p.cost}` : p.cost) : '?'}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-lines-hover font-blender-medium text-type-micro text-text-muted">
          +{rest}
        </span>
      )}
    </div>
  );
}

function VibeChip({ vibe }: { vibe: BuildVibe }) {
  const m = VIBE_META[vibe];
  return (
    <span
      className="shrink-0 rounded-xs border px-1.5 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest"
      style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 50%, transparent)` }}
    >
      {m.label}
    </span>
  );
}

function BalanceBadge({ balance, valid }: { balance: number; valid: boolean }) {
  return (
    <span
      className="font-blender-medium text-type-micro uppercase tracking-widest"
      style={{ color: valid ? 'var(--color-success)' : 'var(--color-danger)' }}
    >
      Баланс {balance >= 0 ? `+${balance}` : balance}
    </span>
  );
}

function ApplyButton({ applied, onApply }: { applied: boolean; onApply: () => void }) {
  return (
    <button
      type="button"
      onClick={onApply}
      className="flex items-center justify-center gap-1.5 rounded-xs px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-all duration-150"
      style={
        applied
          ? { color: 'var(--color-success)', border: '1px solid color-mix(in srgb, var(--color-success) 50%, transparent)' }
          : { color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)' }
      }
    >
      {applied ? <Check size={12} /> : <Hammer size={12} />}
      {applied ? 'Заряжено ↓' : 'Собрать'}
    </button>
  );
}

function FeaturedCard({
  build,
  perkMap,
  season,
  spinning,
  applied,
  onApply,
}: {
  build: CuratedBuild;
  perkMap: Map<string, SeasonPerk>;
  season: Season;
  spinning: boolean;
  applied: boolean;
  onApply: () => void;
}) {
  const meta = useBuildMeta(build, season);
  const accent = VIBE_META[build.vibe].color;
  return (
    <div
      className="relative overflow-hidden rounded-lg border p-4 transition-all duration-300"
      style={{
        borderColor: spinning ? 'var(--color-lines-hover)' : `color-mix(in srgb, ${accent} 55%, transparent)`,
        background: `radial-gradient(circle at 50% -30%, color-mix(in srgb, ${accent} 10%, transparent), var(--color-darkbase))`,
        boxShadow: spinning ? 'none' : `0 0 24px color-mix(in srgb, ${accent} 16%, transparent)`,
      }}
    >
      <div
        key={build.id}
        className="flex flex-col gap-3 animate-[fade-in_0.2s_ease-out_both]"
        style={{ opacity: spinning ? 0.55 : 1 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <VibeChip vibe={build.vibe} />
              <BalanceBadge balance={meta.balance} valid={meta.valid} />
            </div>
            <h3 className="mt-1.5 font-blender-medium text-xl uppercase tracking-widest text-text-primary">
              {build.name}
            </h3>
          </div>
        </div>

        <p className="font-blender-book text-sm leading-relaxed text-text-secondary">
          {build.tagline}
        </p>

        <MeterRow pain={meta.painPct} comfort={meta.comfortPct} />

        <PerkIcons build={build} perkMap={perkMap} limit={12} />

        <div className="flex items-center justify-between gap-2 border-t border-lines-hover pt-3">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            <span style={{ color: 'var(--color-danger)' }}>боль {meta.pain}</span>
            {' · '}
            <span style={{ color: 'var(--color-success)' }}>трат {meta.comfort}</span>
            {' · '}
            {build.perks.length} перков
          </span>
          <ApplyButton applied={applied} onApply={onApply} />
        </div>
      </div>
    </div>
  );
}

function GridCard({
  build,
  perkMap,
  season,
  applied,
  onApply,
}: {
  build: CuratedBuild;
  perkMap: Map<string, SeasonPerk>;
  season: Season;
  applied: boolean;
  onApply: () => void;
}) {
  const meta = useBuildMeta(build, season);
  return (
    <div className="flex flex-col gap-2.5 rounded-sm border border-lines-hover bg-(--color-base) p-3">
      <div className="flex items-center justify-between gap-2">
        <VibeChip vibe={build.vibe} />
        <BalanceBadge balance={meta.balance} valid={meta.valid} />
      </div>

      <h3 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
        {build.name}
      </h3>

      <p className="font-blender-book text-xs leading-relaxed text-text-muted line-clamp-3">
        {build.tagline}
      </p>

      <MeterRow pain={meta.painPct} comfort={meta.comfortPct} />

      <PerkIcons build={build} perkMap={perkMap} limit={7} />

      <div className="mt-auto flex justify-end pt-1">
        <ApplyButton applied={applied} onApply={onApply} />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xs border px-2.5 py-1 font-blender-medium text-type-micro uppercase tracking-widest transition-colors duration-150"
      style={
        active
          ? { color, borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` }
          : { color: 'var(--color-text-muted)', borderColor: 'var(--color-lines-hover)' }
      }
    >
      {label}
    </button>
  );
}
