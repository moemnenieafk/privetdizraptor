'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { TrendingUp, TrendingDown, Zap, ArrowRight, Sliders, Lock } from 'lucide-react';
import { useBarterStore } from '@/store/useBarterStore';
import { useBarterRushStore } from '@/store/useBarterRushStore';
import { useSfx } from '@/hooks/useSfx';
import { useCountUp } from '@/hooks/useCountUp';
import {
  calcBarterProfitStandalone,
  isPlayableBarter,
  formatRub,
} from '@/lib/barter-calc';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import type { BarterTrade, BarterCalculation } from '@/types/barter';

interface Props {
  allBarters: BarterTrade[];
}

interface RoundResult {
  correct: boolean;
  betProfitable: boolean;
  calc: BarterCalculation;
  points: number;
  mult: number;
  fast: boolean;
}

const DECK_SIZE = 40;
const SWIPE_THRESHOLD = 88;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Сбалансированная колода: чередуем выгодные и невыгодные, чтобы угадывание было неочевидным. */
function buildDeck(barters: BarterTrade[]): BarterTrade[] {
  const playable = barters.filter(isPlayableBarter);
  const good: BarterTrade[] = [];
  const bad: BarterTrade[] = [];
  for (const t of playable) {
    if (calcBarterProfitStandalone(t).verdict === 'profitable') good.push(t);
    else bad.push(t);
  }
  const g = shuffle(good);
  const b = shuffle(bad);
  const merged: BarterTrade[] = [];
  const max = Math.max(g.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < g.length) merged.push(g[i]);
    if (i < b.length) merged.push(b[i]);
  }
  return merged.slice(0, DECK_SIZE);
}

function comboMult(combo: number): number {
  return Math.min(5, 1 + Math.floor(combo / 3));
}

export function BarterRush({ allBarters }: Props) {
  const selectBarter = useBarterStore((s) => s.selectBarter);
  const recordRound = useBarterRushStore((s) => s.recordRound);
  const bestScore = useBarterRushStore((s) => s.bestScore);
  const bestCombo = useBarterRushStore((s) => s.bestCombo);
  const played = useBarterRushStore((s) => s.played);
  const correctTotal = useBarterRushStore((s) => s.correct);
  const rushHydrated = useBarterRushStore((s) => s._hasHydrated);
  const { play } = useSfx();

  const pool = useMemo(() => allBarters.filter(isPlayableBarter), [allBarters]);

  const [mounted, setMounted] = useState(false);
  const [deck, setDeck] = useState<BarterTrade[]>([]);
  const [deckVer, setDeckVer] = useState(0);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'guess' | 'reveal'>('guess');
  const [result, setResult] = useState<RoundResult | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [dx, setDx] = useState(0);

  const shownAt = useRef(0);
  const drag = useRef<{ x: number; y: number; on: boolean }>({ x: 0, y: 0, on: false });

  useEffect(() => {
    void useBarterRushStore.persist.rehydrate();
    setDeck(buildDeck(allBarters));
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = deck[index] ?? null;

  // Сброс раунда при смене карты (обычный next ИЛИ пересбор колоды).
  useEffect(() => {
    setPhase('guess');
    setResult(null);
    setDx(0);
    shownAt.current = Date.now();
  }, [index, deckVer]);

  const animatedNet = useCountUp(result ? result.calc.netProfit : 0);

  const handleGuess = useCallback(
    (betProfitable: boolean) => {
      if (phase !== 'guess' || !current) return;
      const calc = calcBarterProfitStandalone(current);
      const isProfit = calc.verdict === 'profitable';
      const correct = isProfit === betProfitable;
      const elapsed = Date.now() - shownAt.current;
      const fast = correct && elapsed < 2200;
      const mult = correct ? comboMult(combo) : 0;
      const points = correct ? Math.round(100 * mult) + (fast ? 40 : 0) : 0;
      const newCombo = correct ? combo + 1 : 0;
      const newScore = score + points;

      setCombo(newCombo);
      setScore(newScore);
      setResult({ correct, betProfitable, calc, points, mult: comboMult(newCombo - 1), fast });
      setPhase('reveal');
      setDx(0);

      if (!correct) play('tick');
      else if (comboMult(newCombo - 1) >= 3) play('rank-up');
      else play('coins');

      recordRound({ correct, combo: newCombo, score: newScore });
    },
    [phase, current, combo, score, play, recordRound],
  );

  const handleNext = useCallback(() => {
    const ni = index + 1;
    if (ni >= deck.length) {
      setDeck(buildDeck(allBarters));
      setIndex(0);
      setDeckVer((v) => v + 1);
    } else {
      setIndex(ni);
    }
  }, [index, deck.length, allBarters]);

  const handleAnalyze = useCallback(() => {
    if (current) selectBarter(current);
  }, [current, selectBarter]);

  // ─── Swipe (touch-first) ─────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== 'guess') return;
    drag.current = { x: e.clientX, y: e.clientY, on: true };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.on) return;
    const ddx = e.clientX - drag.current.x;
    const ddy = e.clientY - drag.current.y;
    if (Math.abs(ddx) > Math.abs(ddy)) setDx(ddx);
  };
  const onPointerUp = () => {
    if (!drag.current.on) return;
    drag.current.on = false;
    if (dx > SWIPE_THRESHOLD) handleGuess(true);
    else if (dx < -SWIPE_THRESHOLD) handleGuess(false);
    else setDx(0);
  };

  // ─── Skeleton (SSR-safe, never spinner) ──────────────────────
  if (!mounted || !current) {
    return (
      <div className="mb-5">
        <div className="h-9 w-full animate-pulse rounded bg-card-menu" />
        <div className="mt-2 h-64 w-full animate-pulse rounded-lg bg-card-menu" />
      </div>
    );
  }

  const traderName = current.trader.normalizedName;
  const reward = current.rewardItems[0];
  const rewardLabel = current.rewardItems
    .map((ri) => `${ri.item.name}${ri.count > 1 ? ` ×${Math.ceil(ri.count)}` : ''}`)
    .join(' + ');

  const accuracy = played > 0 ? Math.round((correctTotal / played) * 100) : null;
  const liveMult = comboMult(combo);
  const swipeHintRight = Math.max(0, Math.min(1, dx / SWIPE_THRESHOLD));
  const swipeHintLeft = Math.max(0, Math.min(1, -dx / SWIPE_THRESHOLD));

  const verdictColor = result
    ? result.calc.verdict === 'profitable'
      ? 'var(--color-success)'
      : result.calc.verdict === 'unprofitable'
        ? 'var(--color-danger)'
        : 'var(--color-text-secondary)'
    : 'var(--color-text-secondary)';

  return (
    <div className="mb-5">
      {/* ─── HUD ─── */}
      <div className="flex items-stretch gap-1.5">
        <Hud label="Счёт" value={score.toLocaleString('ru-RU')} accent="var(--primary)" />
        <Hud
          label="Комбо"
          value={combo > 0 ? `${combo}× · ×${liveMult}` : '—'}
          accent={combo > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)'}
          punchKey={combo}
        />
        <Hud
          label="Рекорд"
          value={rushHydrated ? Math.max(bestScore, score).toLocaleString('ru-RU') : '—'}
          accent="var(--color-text-secondary)"
        />
        <Hud
          label="Точность"
          value={rushHydrated && accuracy !== null ? `${accuracy}%` : '—'}
          accent="var(--color-text-secondary)"
          sub={rushHydrated && bestCombo > 0 ? `серия ${bestCombo}` : undefined}
        />
      </div>

      {/* ─── Deck progress ─── */}
      <div className="mt-2 flex items-center justify-between">
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Сделка {index + 1} / {deck.length}
        </span>
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Поток · {pool.length} в пуле
        </span>
      </div>
      <div className="mt-1 h-0.5 w-full overflow-hidden bg-lines-hover">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${((index + 1) / deck.length) * 100}%`, background: 'var(--primary)' }}
        />
      </div>

      {/* ─── Card ─── */}
      <div
        className="relative mt-2 touch-pan-y overflow-hidden rounded-lg border bg-card-menu select-none"
        style={{
          borderColor: phase === 'reveal' ? verdictColor : 'var(--color-lines-hover)',
          transform: `translateX(${dx}px) rotate(${dx * 0.02}deg)`,
          transition: drag.current.on ? 'none' : 'transform 0.25s cubic-bezier(0.16,0.84,0.44,1), border-color 0.3s',
          boxShadow:
            phase === 'reveal' && result && result.calc.verdict !== 'neutral'
              ? `0 0 26px color-mix(in srgb, ${verdictColor} 22%, transparent)`
              : 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Swipe direction hints */}
        {phase === 'guess' && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2"
              style={{ background: `linear-gradient(to right, color-mix(in srgb, var(--color-danger) 26%, transparent), transparent)`, opacity: swipeHintLeft }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
              style={{ background: `linear-gradient(to left, color-mix(in srgb, var(--color-success) 26%, transparent), transparent)`, opacity: swipeHintRight }}
            />
          </>
        )}

        {/* Header: trader */}
        <div className="flex items-center justify-between gap-2 border-b border-lines-hover px-3 py-2">
          <div className="flex items-center gap-2">
            <Image
              src={`/images/traders/eft/${traderName}.webp`}
              alt={current.trader.name}
              width={26}
              height={26}
              className="h-6.5 w-6.5 shrink-0 rounded-xs border border-lines-hover object-cover"
              unoptimized
            />
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary">
              {current.trader.name} LL{current.level}
            </span>
            {current.taskUnlock && <Lock size={10} className="text-moderate" />}
          </div>
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            бартер
          </span>
        </div>

        {/* Reward */}
        <div className="flex items-center gap-3 px-3 pt-4">
          {reward && (
            <div
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xs border"
              style={{
                background: getTarkovBackgroundColor(reward.item.backgroundColor),
                borderColor: phase === 'reveal' && result?.correct ? verdictColor : 'var(--color-lines-hover)',
                transition: 'border-color 0.3s',
                animation: phase === 'reveal' && result?.correct ? 'deal-pop 0.5s ease-out' : undefined,
              }}
            >
              {reward.item.image512pxLink && (
                <Image
                  src={reward.item.image512pxLink}
                  alt={reward.item.shortName}
                  fill
                  className="object-contain p-1"
                  sizes="64px"
                  unoptimized
                />
              )}
              {reward.count > 1 && (
                <span className="absolute right-0 bottom-0 bg-black/70 px-1 font-blender-medium text-type-micro text-text-primary">
                  ×{Math.ceil(reward.count)}
                </span>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              Получаешь
            </p>
            <p className="mt-0.5 font-blender-book text-base text-text-primary">{rewardLabel}</p>
          </div>
        </div>

        {/* Required (cost) tiles */}
        <div className="px-3 pt-3">
          <p className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Отдаёшь
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {current.requiredItems.map((ri, i) => (
              <div
                key={`${ri.item.id}-${i}`}
                className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xs border border-lines-hover"
                style={{
                  background: getTarkovBackgroundColor(ri.item.backgroundColor),
                  animation:
                    phase === 'reveal' && result?.correct ? 'deal-pop 0.45s ease-out both' : undefined,
                  animationDelay: phase === 'reveal' && result?.correct ? `${i * 60}ms` : undefined,
                }}
                title={ri.item.name}
              >
                {ri.item.image512pxLink && (
                  <Image
                    src={ri.item.image512pxLink}
                    alt={ri.item.shortName}
                    fill
                    className="object-contain p-0.5"
                    sizes="44px"
                    unoptimized
                  />
                )}
                {ri.count > 1 && (
                  <span className="absolute right-0 bottom-0 bg-black/70 px-0.5 font-blender-medium text-type-micro text-text-primary">
                    ×{Math.ceil(ri.count)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Guess prompt / Reveal ─── */}
        {phase === 'guess' ? (
          <div className="mt-4 px-3 pb-3">
            <p className="text-center font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              Выгодная сделка? Оцени на глаз
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleGuess(false)}
                className="flex items-center justify-center gap-1.5 rounded px-3 py-3.5 font-blender-medium text-sm uppercase tracking-widest transition-colors duration-150"
                style={{
                  color: 'var(--color-danger)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
                }}
              >
                <TrendingDown size={15} />
                Мимо
              </button>
              <button
                type="button"
                onClick={() => handleGuess(true)}
                className="flex items-center justify-center gap-1.5 rounded px-3 py-3.5 font-blender-medium text-sm uppercase tracking-widest transition-colors duration-150"
                style={{
                  color: 'var(--color-success)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
                }}
              >
                <TrendingUp size={15} />
                Выгода
              </button>
            </div>
            <p className="mt-1.5 text-center font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
              или свайп ← →
            </p>
          </div>
        ) : (
          result && (
            <div className="mt-4 animate-[fade-in_0.25s_ease-out_both] px-3 pb-3">
              {/* Correct / wrong banner */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-blender-medium text-sm uppercase tracking-widest"
                  style={{ color: result.correct ? 'var(--color-success)' : 'var(--color-danger)' }}
                >
                  {result.correct ? '▲ Верно' : '✕ Мимо кассы'}
                </span>
                {result.correct && result.points > 0 && (
                  <span
                    className="flex items-center gap-1 font-blender-medium text-sm"
                    style={{ color: 'var(--primary)' }}
                  >
                    <Zap size={13} />+{result.points}
                    {result.mult > 1 && <span className="text-text-muted">×{result.mult}</span>}
                    {result.fast && <span className="text-text-muted">быстро</span>}
                  </span>
                )}
              </div>

              {/* Verdict + net */}
              <div className="mt-2 flex items-end justify-between gap-3 border-t border-lines-hover pt-2.5">
                <div>
                  <p
                    className="font-blender-medium text-xs uppercase tracking-widest"
                    style={{ color: verdictColor }}
                  >
                    {result.calc.verdict === 'profitable'
                      ? 'Выгодный бартер'
                      : result.calc.verdict === 'unprofitable'
                        ? 'Невыгодный бартер'
                        : 'Нейтральный бартер'}
                  </p>
                  <p className="mt-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                    Чистыми · ROI {result.calc.roi >= 0 ? '+' : '−'}
                    {Math.abs(result.calc.roi).toFixed(0)}%
                  </p>
                </div>
                <span
                  className="shrink-0 font-blender-medium text-2xl leading-none tracking-tight"
                  style={{ color: verdictColor }}
                >
                  {animatedNet >= 0 ? '+' : '−'}
                  {formatRub(Math.abs(Math.round(animatedNet)))}
                </span>
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded px-4 py-3 font-blender-medium text-sm uppercase tracking-widest transition-all duration-150"
                  style={{
                    color: 'var(--primary)',
                    border: '1px solid var(--primary)',
                    background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                  }}
                >
                  Дальше
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  className="flex shrink-0 items-center gap-1.5 border border-lines-hover bg-card-menu px-3 py-3 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors duration-150 hover:text-(--primary)"
                >
                  <Sliders size={12} />
                  Разобрать
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface HudProps {
  label: string;
  value: string;
  accent: string;
  sub?: string;
  punchKey?: number;
}

function Hud({ label, value, accent, sub, punchKey }: HudProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 border border-lines-hover bg-card-menu px-2 py-1.5">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span
        key={punchKey}
        className="truncate font-blender-medium text-sm leading-none"
        style={{
          color: accent,
          animation: punchKey ? 'combo-punch 0.3s ease-out' : undefined,
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          {sub}
        </span>
      )}
    </div>
  );
}
