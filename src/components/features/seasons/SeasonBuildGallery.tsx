'use client';

// Рулетка курируемых билдов — pseudo-3D coverflow. Центральная карта увеличена и в
// амбер-рамке, соседние уменьшаются, тускнеют и разворачиваются по Y (иллюзия объёма).
// Движение на requestAnimationFrame по дробной позиции ленты: КРУТИТЬ раскручивает к
// случайному каталожному билду, ХАОС собирает случайный ВАЛИДНЫЙ билд математикой
// бюджета. Клик по соседней карте — доворот к ней. «Собрать» заряжает выбор в
// конструктор ниже (applyPreset) и скроллит к нему.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Dices, Hammer, Check, Repeat } from 'lucide-react';
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
import { perkIconColor, perkMaskStyle } from './perkVisual';

interface Props {
  season: Season;
}

// Геометрия ленты
const CARD_W = 184;
const CARD_H = 328;
const STEP = 150; // расстояние между центрами соседних карт
const WINDOW = 4; // сколько карт рендерим по каждую сторону от центра
const SPIN_MS = 2600;
const ROTATE_MS = 520;
const LOOPS = 3;
const TICK_GAP_MS = 45; // не чаще одного тика раз в N мс — иначе на пике скорости жужжит

const MAX_PAIN = 50; // сумма всех негативных очков (релиз 1.1.0.0) — потолок «боли»
const MAX_COMFORT = 29; // тяжёлый позитивный стек (Каппа+Середнячок+Геркулес) — потолок трат

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

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Ближайшее «завёрнутое» смещение карты i от дробной позиции pos, в (-n/2, n/2].
function wrappedDelta(i: number, pos: number, n: number): number {
  let d = ((i - pos) % n + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

export function SeasonBuildGallery({ season }: Props) {
  const applyPreset = useSeasonStore((s) => s.applyPreset);
  const { play } = useSfx();

  const builds = useMemo(() => getSeasonBuilds(season.slug), [season.slug]);
  const perkMap = useMemo(
    () => new Map<string, SeasonPerk>(season.perks.map((p) => [p.id, p])),
    [season],
  );
  const N = builds.length;

  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState(0); // дробная позиция ленты (для рендера)
  const [center, setCenter] = useState(0); // приземлённый индекс
  const [spinning, setSpinning] = useState(false);
  const [spinKind, setSpinKind] = useState<'spin' | 'chaos'>('spin');
  const [chaosPick, setChaosPick] = useState<CuratedBuild | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const posRef = useRef(0);
  const raf = useRef<number | null>(null);
  const spinningRef = useRef(false);
  const lastTick = useRef(0);
  const lastTickTime = useRef(0);
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    const start = N ? Math.floor(Math.random() * N) : 0;
    posRef.current = start;
    setPos(start);
    setCenter(start);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (applyTimer.current) clearTimeout(applyTimer.current);
    };
  }, [N]);

  // ── Случайный валидный билд («Хаос») ─────────────────────────────
  const makeChaos = useCallback((): CuratedBuild => {
    const personal = personalPerks(season);
    const negs = shuffle(personal.filter((p) => p.cost > 0));
    const pos2 = shuffle(personal.filter((p) => p.cost < 0));
    const taken = new Set<string>();
    const conflicts = (p: SeasonPerk) =>
      (p.excludes ?? []).some((id) => taken.has(id)) ||
      [...taken].some((id) => (perkMap.get(id)?.excludes ?? []).includes(p.id));

    for (const p of negs) {
      if (Math.random() < 0.55 && !conflicts(p)) taken.add(p.id);
    }
    let balance = [...taken].reduce((s, id) => s + (perkMap.get(id)?.cost ?? 0), 0);
    for (const p of pos2) {
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

  // ── Анимация ленты на rAF ────────────────────────────────────────
  const animate = useCallback(
    (target: number, duration: number, kind: 'spin' | 'chaos') => {
      if (spinningRef.current || N === 0) return;
      spinningRef.current = true;
      setSpinning(true);
      setSpinKind(kind);
      setApplied(null);
      setJustApplied(false);

      const from = posRef.current;
      const startT = performance.now();
      lastTick.current = Math.round(from);

      const stepFn = (now: number) => {
        const t = Math.min(1, (now - startT) / duration);
        const v = from + (target - from) * easeOut(t);
        posRef.current = v;
        setPos(v);
        const r = Math.round(v);
        if (r !== lastTick.current) {
          lastTick.current = r;
          // Разрежаем тики по времени: на пике скорости пересечения идут слишком часто
          // (жужжание) — играем не чаще раза в TICK_GAP_MS, к концу они естественно расходятся.
          if (now - lastTickTime.current > TICK_GAP_MS) {
            lastTickTime.current = now;
            play('reel');
          }
        }
        if (t < 1) {
          raf.current = requestAnimationFrame(stepFn);
        } else {
          const landed = ((Math.round(target) % N) + N) % N;
          posRef.current = landed;
          setPos(landed);
          setCenter(landed);
          spinningRef.current = false;
          setSpinning(false);
          play(kind === 'chaos' ? 'unlock' : 'coins');
        }
      };
      raf.current = requestAnimationFrame(stepFn);
    },
    [N, play],
  );

  const spinFull = useCallback(
    (idx: number, kind: 'spin' | 'chaos') => {
      const from = posRef.current;
      let target = ((idx % N) + N) % N;
      while (target < from + LOOPS * N) target += N;
      animate(target, SPIN_MS, kind);
    },
    [animate, N],
  );

  const onSpin = useCallback(() => {
    if (spinningRef.current) return;
    setChaosPick(null);
    spinFull(Math.floor(Math.random() * N), 'spin');
  }, [N, spinFull]);

  const onChaos = useCallback(() => {
    if (spinningRef.current) return;
    setChaosPick(makeChaos());
    spinFull(Math.floor(Math.random() * Math.max(1, N)), 'chaos');
  }, [makeChaos, N, spinFull]);

  const rotateTo = useCallback(
    (idx: number) => {
      if (spinningRef.current) return;
      setChaosPick(null);
      const from = posRef.current;
      animate(from + wrappedDelta(idx, from, N), ROTATE_MS, 'spin');
    },
    [animate, N],
  );

  const applyBuild = useCallback(
    (b: CuratedBuild) => {
      applyPreset(season.slug, b.perks);
      setApplied(b.id);
      setJustApplied(true);
      if (applyTimer.current) clearTimeout(applyTimer.current);
      applyTimer.current = setTimeout(() => setJustApplied(false), 950);
      play('confirm');
      document.getElementById('season-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [applyPreset, season.slug, play],
  );

  if (!mounted || N === 0) {
    return (
      <div className="mb-9 flex flex-col gap-4">
        <div className="h-84 w-full animate-pulse rounded-lg bg-card-menu" />
        <div className="h-11 w-full animate-pulse rounded bg-card-menu" />
      </div>
    );
  }

  const pick = chaosPick ?? builds[center];
  const pickBudget = computeBudget(season, pick.perks);
  const painPct = Math.min(100, (pickBudget.granted / MAX_PAIN) * 100);
  const comfortPct = Math.min(100, (pickBudget.spent / MAX_COMFORT) * 100);

  return (
    <div className="mb-9 flex flex-col gap-5">
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            Генератор вызова
          </h2>
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            {builds.length} готовых билдов
          </span>
        </div>

        {/* ── Лента-рулетка (pseudo-3D coverflow) ──
             overflow-x-clip режет дальние карты по бокам (не даёт горизонтальный скролл),
             но по вертикали overflow видимый — свечение и тени центральной карты не зарезаются. */}
        <div className="relative w-full overflow-x-clip" style={{ height: CARD_H + 44, perspective: '1400px' }}>
          <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {builds.map((b, i) => {
              const d = wrappedDelta(i, pos, N);
              if (Math.abs(d) > WINDOW) return null;
              const ad = Math.abs(d);
              const scale = Math.max(0.6, 1 - ad * 0.14);
              const rotateY = Math.max(-48, Math.min(48, -d * 15));
              const opacity = Math.max(0.12, 1 - ad * 0.26);
              const isCenter = ad < 0.5;
              return (
                <ReelCard
                  key={b.id}
                  build={b}
                  isCenter={isCenter}
                  chaos={isCenter && !!chaosPick}
                  transform={`translateX(calc(-50% + ${d * STEP}px)) scale(${scale}) rotateY(${rotateY}deg)`}
                  opacity={opacity}
                  z={Math.round(100 - ad * 10)}
                  onClick={() => {
                    if (spinning) return;
                    if (isCenter) applyBuild(pick);
                    else rotateTo(i);
                  }}
                />
              );
            })}
          </div>
          {/* Виньетки по краям — уводят соседей в фон */}
          <span className="pointer-events-none absolute inset-y-0 left-0 z-[200] w-24 bg-linear-to-r from-(--color-base) to-transparent" />
          <span className="pointer-events-none absolute inset-y-0 right-0 z-[200] w-24 bg-linear-to-l from-(--color-base) to-transparent" />
        </div>

        {/* ── КРУТИТЬ / ХАОС с линиями по бокам ── */}
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-lines-hover" />
          <button
            type="button"
            onClick={onSpin}
            disabled={spinning}
            className="flex items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-5 py-3 font-blender-medium text-sm uppercase tracking-widest text-(--primary) transition-all duration-150 active:scale-[0.97] hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] disabled:opacity-50"
          >
            <Repeat size={15} className={spinning && spinKind === 'spin' ? 'animate-spin' : ''} />
            {spinning && spinKind === 'spin' ? 'Крутим…' : 'Крутить'}
          </button>
          <button
            type="button"
            onClick={onChaos}
            disabled={spinning}
            className="flex items-center justify-center gap-2 rounded-xs border border-lines-hover bg-card-menu px-5 py-3 font-blender-medium text-sm uppercase tracking-widest text-text-secondary transition-colors duration-150 active:scale-[0.97] hover:text-(--primary) disabled:opacity-50"
          >
            <Dices size={15} className={spinning && spinKind === 'chaos' ? 'animate-spin' : ''} />
            Хаос
          </button>
          <span aria-hidden className="h-px flex-1 bg-lines-hover" />
        </div>

        {/* ── Caption текущего выбора + «Собрать» ── */}
        <div
          className={`flex flex-col gap-3 rounded-lg border p-4 transition-all duration-300 ${justApplied ? 'animate-reveal-punch' : ''}`}
          style={{
            borderColor: justApplied
              ? 'var(--color-nvg-green)'
              : `color-mix(in srgb, ${VIBE_META[pick.vibe].color} 45%, transparent)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <VibeChip vibe={pick.vibe} />
                <BalanceBadge balance={pickBudget.balance} valid={pickBudget.valid} />
              </div>
              <h3 className="mt-1.5 font-blender-medium text-xl uppercase tracking-widest text-text-primary">
                {pick.name}
              </h3>
            </div>
            <ApplyButton applied={applied === pick.id} onApply={() => applyBuild(pick)} />
          </div>

          <p className="font-blender-book text-sm leading-relaxed text-text-secondary">
            {pick.tagline}
          </p>

          <MeterRow pain={painPct} comfort={comfortPct} />

          <PerkIcons build={pick} perkMap={perkMap} limit={12} size="md" />

          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            <span style={{ color: 'var(--color-danger)' }}>страдания {pickBudget.granted}</span>
            {' · '}
            <span style={{ color: 'var(--color-nvg-green)' }}>комфорт {pickBudget.spent}</span>
            {' · '}
            {pick.perks.length} перков
          </span>
        </div>
      </section>
    </div>
  );
}

// ─── Карта ленты ───────────────────────────────────────────────────
function ReelCard({
  build,
  isCenter,
  chaos,
  transform,
  opacity,
  z,
  onClick,
}: {
  build: CuratedBuild;
  isCenter: boolean;
  chaos: boolean;
  transform: string;
  opacity: number;
  z: number;
  onClick: () => void;
}) {
  const accent = VIBE_META[build.vibe].color;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={build.name}
      style={{
        width: CARD_W,
        height: CARD_H,
        transform,
        opacity,
        zIndex: z,
        borderColor: isCenter
          ? 'var(--primary)'
          : `color-mix(in srgb, ${accent} 30%, var(--color-lines-hover))`,
        boxShadow: isCenter
          ? '0 0 34px color-mix(in srgb, var(--primary) 32%, transparent)'
          : 'none',
      }}
      className="absolute left-1/2 top-5 origin-center overflow-hidden rounded-lg border-2 bg-(--color-darkbase) transition-[border-color,box-shadow] duration-200"
    >
      {build.banner ? (
        <Image
          src={build.banner}
          alt={build.name}
          fill
          sizes="200px"
          draggable={false}
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <VibeChip vibe={build.vibe} />
        </span>
      )}

      {/* Тайтл на центральной карте */}
      {isCenter && !chaos && (
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-(--color-darkbase) to-transparent px-3 pb-3 pt-10 text-left font-blender-medium text-sm uppercase leading-tight tracking-widest text-text-primary">
          {build.short ?? build.name}
        </span>
      )}

      {/* Глитч-оверлей «Хаос» */}
      {isCenter && chaos && (
        <span className="animate-chaos-glitch absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-darkbase)_55%,transparent)] font-blender-medium text-2xl uppercase tracking-widest text-(--primary)">
          Хаос
        </span>
      )}
    </button>
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
      <Meter icon="comfort" value={comfort} color="var(--color-nvg-green)" />
    </div>
  );
}

function Meter({ icon, value, color }: { icon: 'pain' | 'comfort'; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        style={{ color }}
        className={`icon-mask h-3 w-3 shrink-0 ${
          icon === 'pain' ? 'icon-eft-negative-debuffs' : 'icon-eft-positive-buffs'
        }`}
      />
      <div className="relative h-1 flex-1 overflow-hidden bg-lines-hover">
        <div
          className="relative h-full overflow-hidden transition-[width] duration-500 ease-out"
          style={{ width: `${value}%`, background: color }}
        >
          {value > 4 && (
            <div
              className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/2"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Размеры мини-иконок перка в карточках сборок: md — крупная (caption), sm — грид.
const PERK_ICON_SIZE = {
  sm: { wrap: 'gap-1', box: 'size-9', inner: 'size-6' },
  md: { wrap: 'gap-1.5', box: 'size-11', inner: 'size-8' },
} as const;

function PerkIcons({
  build,
  perkMap,
  limit,
  size = 'sm',
}: {
  build: CuratedBuild;
  perkMap: Map<string, SeasonPerk>;
  limit: number;
  size?: keyof typeof PERK_ICON_SIZE;
}) {
  const sz = PERK_ICON_SIZE[size];
  const shown = build.perks.slice(0, limit);
  const rest = build.perks.length - shown.length;
  return (
    <div className={`flex flex-wrap items-center ${sz.wrap}`}>
      {shown.map((id) => {
        const p = perkMap.get(id);
        const border = p && p.cost < 0 ? 'border-nvg-green/50' : 'border-danger/50';
        return p?.iconUrl ? (
          <span
            key={id}
            aria-hidden
            title={p.name}
            className={`flex ${sz.box} shrink-0 items-center justify-center rounded-xs border ${border}`}
          >
            <span className={`${sz.inner} ${perkIconColor[p.kind]}`} style={perkMaskStyle(p.iconUrl)} />
          </span>
        ) : (
          <span
            key={id}
            className={`flex ${sz.box} shrink-0 items-center justify-center rounded-xs border font-blender-medium text-type-micro text-text-muted ${border}`}
          >
            {p ? (p.cost > 0 ? `+${p.cost}` : p.cost) : '?'}
          </span>
        );
      })}
      {rest > 0 && (
        <span className={`flex ${sz.box} shrink-0 items-center justify-center rounded-xs border border-lines-hover font-blender-medium text-type-micro text-text-muted`}>
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
      style={{ color: valid ? 'var(--color-nvg-green)' : 'var(--color-danger)' }}
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
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-xs px-3 py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-all duration-150 active:scale-[0.96]"
      style={
        applied
          ? { color: 'var(--color-nvg-green)', border: '1px solid color-mix(in srgb, var(--color-nvg-green) 50%, transparent)' }
          : { color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)' }
      }
    >
      {applied ? <Check size={12} /> : <Hammer size={12} />}
      {applied ? 'Заряжено ↓' : 'Собрать'}
    </button>
  );
}

// ─── Полный список всех сборок (внизу страницы, после конструктора) ──
export function SeasonBuildList({ season }: Props) {
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

  const [filter, setFilter] = useState<BuildVibe | 'all'>('all');
  const filtered = useMemo(
    () => (filter === 'all' ? builds : builds.filter((b) => b.vibe === filter)),
    [builds, filter],
  );

  const [applied, setApplied] = useState<string | null>(null);

  const applyBuild = useCallback(
    (b: CuratedBuild) => {
      applyPreset(season.slug, b.perks);
      setApplied(b.id);
      play('confirm');
      document.getElementById('season-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [applyPreset, season.slug, play],
  );

  if (builds.length === 0) return null;

  return (
    <section className="mt-10 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-t border-lines-hover pt-6">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Все сборки
        </h2>
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {filtered.length} из {builds.length}
        </span>
      </div>

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

      <div className="flex flex-col gap-2">
        {filtered.map((b) => (
          <ListRow
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
  );
}

function ListRow({
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
    <div className="flex items-stretch gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-2.5 transition-colors duration-200 hover:border-(--primary)/60">
      {/* Миниатюра баннера 9:16 */}
      <div
        className="relative w-16 shrink-0 self-start overflow-hidden rounded-xs bg-(--color-darkbase)"
        style={{ aspectRatio: '9 / 16' }}
      >
        {build.banner && (
          <Image src={build.banner} alt={build.name} fill sizes="64px" className="object-cover" />
        )}
      </div>

      {/* Основное */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <VibeChip vibe={build.vibe} />
          <h3 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
            {build.name}
          </h3>
          <BalanceBadge balance={meta.balance} valid={meta.valid} />
        </div>

        <p className="font-blender-book text-xs leading-relaxed text-text-muted line-clamp-2">
          {build.tagline}
        </p>

        <PerkIcons build={build} perkMap={perkMap} limit={12} />

        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          <span style={{ color: 'var(--color-danger)' }}>страдания {meta.pain}</span>
          {' · '}
          <span style={{ color: 'var(--color-nvg-green)' }}>комфорт {meta.comfort}</span>
          {' · '}
          {build.perks.length} перков
        </span>
      </div>

      {/* Собрать */}
      <div className="flex shrink-0 items-center">
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
