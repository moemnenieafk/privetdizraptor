'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Trash2, CheckCircle2, Copy, Volume2, VolumeX, Search, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useBarterStore } from '@/store/useBarterStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import { calcBarterProfit, formatRub } from '@/lib/barter-calc';
import { computeProStatus, type TraderTier } from '@/types/gamification';
import { useSfx } from '@/hooks/useSfx';
import { useGamificationSync, type SyncState } from '@/hooks/useGamificationSync';
import { BarterSearchBar } from '@/components/features/barter/BarterSearchBar';
import { BarterTradeSelector } from '@/components/features/barter/BarterTradeSelector';
import { BarterRush } from '@/components/features/barter/BarterRush';
import { StashGrid } from '@/components/features/barter/StashGrid';
import { StashSummary } from '@/components/features/barter/StashSummary';
import { StatsDashboard } from '@/components/features/barter/StatsDashboard';
import { ProMetaProgress } from '@/components/features/barter/ProMetaProgress';
import type { BarterSearchResult, BarterTrade } from '@/types/barter';

interface Props {
  initialItems: BarterSearchResult[];
  initialBarters: BarterTrade[];
}

export function BarterPageClient({ initialItems, initialBarters }: Props) {
  const items = useBarterStore((s) => s.items);
  const selectedBarter = useBarterStore((s) => s.selectedBarter);
  const clearStash = useBarterStore((s) => s.clearStash);
  const recordDeal = useGamificationStore((s) => s.recordDeal);
  const xp = useGamificationStore((s) => s.xp);
  const confirmedBarterIds = useGamificationStore((s) => s.confirmedBarterIds);
  const badges = useGamificationStore((s) => s.badges);
  const { play } = useSfx();
  const sync = useGamificationSync();

  const { isUnlocked: proUnlocked } = computeProStatus(xp, confirmedBarterIds, badges);

  const [dealConfirmed, setDealConfirmed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [floatXp, setFloatXp] = useState<number | null>(null);
  const [rankUpTier, setRankUpTier] = useState<TraderTier | null>(null);
  const floatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rankTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SSR-safe регидратация persist-стора на клиенте (skipHydration в сторе).
  useEffect(() => {
    void useGamificationStore.persist.rehydrate();
  }, []);

  // Очистка отложенных таймеров эффектов при размонтировании.
  useEffect(
    () => () => {
      if (floatTimer.current) clearTimeout(floatTimer.current);
      if (rankTimer.current) clearTimeout(rankTimer.current);
    },
    [],
  );

  useEffect(() => {
    setDealConfirmed(false);
    setFloatXp(null);
    setRankUpTier(null);
    if (floatTimer.current) clearTimeout(floatTimer.current);
    if (rankTimer.current) clearTimeout(rankTimer.current);
  }, [selectedBarter?.id]);

  const handleConfirmDeal = useCallback(() => {
    if (!selectedBarter || dealConfirmed) return;
    const calc = calcBarterProfit(selectedBarter, items);
    const result = recordDeal({ barter: selectedBarter, calc, allBarters: initialBarters });
    setDealConfirmed(true);

    if (result.rankUp) play('rank-up');
    else if (result.newBadges.length > 0) play('unlock');
    else play(result.verdict === 'profitable' ? 'coins' : 'confirm');

    if (result.xpGained > 0) {
      setFloatXp(result.xpGained);
      if (floatTimer.current) clearTimeout(floatTimer.current);
      floatTimer.current = setTimeout(() => setFloatXp(null), 1500);
    }
    if (result.rankUp) {
      setRankUpTier(result.rankUp);
      if (rankTimer.current) clearTimeout(rankTimer.current);
      rankTimer.current = setTimeout(() => setRankUpTier(null), 2800);
    }
  }, [selectedBarter, items, dealConfirmed, recordDeal, initialBarters, play]);

  const handleExport = useCallback(() => {
    if (!selectedBarter) return;
    const calc = calcBarterProfit(selectedBarter, items);
    const rewardLabel = selectedBarter.rewardItems
      .map((r) => `${r.item.name}${r.count > 1 ? ` ×${Math.ceil(r.count)}` : ''}`)
      .join(' + ');
    const sign = (n: number) => (n >= 0 ? '+' : '');
    const lines = [
      `▲ БАРТЕР: ${selectedBarter.trader.name} LL${selectedBarter.level}`,
      `Награда:            ${rewardLabel}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Ингредиенты:        ${formatRub(calc.totalComponentsCost)}`,
      `Цена награды:       ${calc.targetItemFleaPrice > 0 ? formatRub(calc.targetItemFleaPrice) : '—'}`,
      `Мгновенный профит:  ${sign(calc.instantProfit)}${formatRub(calc.instantProfit)}`,
      `Комиссия флии:      −${formatRub(calc.fleaCommission)}`,
      `Чистыми:            ${sign(calc.netProfit)}${formatRub(calc.netProfit)}`,
      `ROI:                ${sign(calc.roi)}${calc.roi.toFixed(1)}%`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `cta — Центр Тактической Адаптации`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedBarter, items]);

  return (
    <>
      <PageHeader pageId="eft-progress-barter" />

      <div className="mt-2 flex items-center justify-between gap-2">
        <SyncIndicator state={sync.state} />
        <MuteToggle />
      </div>

      {selectedBarter ? (
        <>
          <div className="mt-2 mb-5">
            <BarterTradeSelector allBarters={initialBarters} />
          </div>

          <div className="overflow-x-auto pb-4">
            <StashGrid />
          </div>

          <StashSummary />
        </>
      ) : (
        <div className="mt-2 mb-5">
          {/* Hero: играбельная колода бартеров — без строки поиска */}
          <BarterRush allBarters={initialBarters} />

          {/* Про-путь: точный поиск + ручной схрон, свёрнуты по умолчанию */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 border border-lines-hover bg-card-menu px-3 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors duration-150 hover:text-(--primary)"
          >
            <span className="flex items-center gap-2">
              <Search size={13} />
              Точный поиск и ручной схрон
            </span>
            <ChevronDown
              size={14}
              className="transition-transform duration-200"
              style={{ transform: searchOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          {searchOpen && (
            <div className="mt-2 space-y-2 animate-[fade-in_0.2s_ease-out_both]">
              <BarterTradeSelector allBarters={initialBarters} />
              <div className="flex items-center gap-3">
                <BarterSearchBar allItems={initialItems} />
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={clearStash}
                    className="flex shrink-0 items-center gap-1.5 border border-lines-hover bg-card-menu px-3 py-2 font-blender-book text-sm text-text-secondary transition-colors duration-150 hover:border-failure hover:text-failure"
                  >
                    <Trash2 size={13} />
                    Очистить схрон
                  </button>
                )}
              </div>

              <div className="overflow-x-auto pb-4">
                <StashGrid />
              </div>

              <StashSummary />
            </div>
          )}
        </div>
      )}

      {selectedBarter && (
        <div className="relative mt-3 flex flex-wrap items-center gap-2">
          {floatXp !== null && (
            <span
              className="animate-xp-float pointer-events-none absolute -top-5 left-6 font-blender-medium text-sm"
              style={{ color: 'var(--color-success)' }}
            >
              +{formatRub(floatXp)} XP
            </span>
          )}

          {dealConfirmed ? (
            <div className="flex items-center gap-2 border border-lines-hover bg-card-menu px-4 py-2.5">
              <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
              <span
                className="font-blender-medium text-xs uppercase tracking-widest"
                style={{ color: 'var(--color-success)' }}
              >
                Зафиксировано — XP начислен
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConfirmDeal}
              className="flex items-center gap-2 rounded px-5 py-3 font-blender-medium text-sm uppercase tracking-widest transition-all duration-200"
              style={{
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                boxShadow: '0 0 16px color-mix(in srgb, var(--primary) 18%, transparent)',
              }}
            >
              ▲ Зафиксировать сделку
            </button>
          )}

          {proUnlocked && (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 border border-lines-hover bg-card-menu px-3 py-2.5 font-blender-medium text-xs uppercase tracking-widest transition-colors duration-150"
              style={copied ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-text-muted)' }}
            >
              <Copy size={12} />
              {copied ? 'Скопировано' : 'Экспорт'}
            </button>
          )}
        </div>
      )}

      {rankUpTier && (
        <div
          className="mt-3 flex animate-[fade-in-up_0.5s_ease-out_both] items-center gap-2 rounded-lg border px-4 py-3"
          style={{
            borderColor: 'var(--primary)',
            background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
            boxShadow: '0 0 24px color-mix(in srgb, var(--primary) 30%, transparent)',
          }}
        >
          <span
            className="font-blender-medium text-sm uppercase tracking-widest"
            style={{ color: 'var(--primary)' }}
          >
            ▲ Ранг повышен — {rankUpTier.label}
          </span>
        </div>
      )}

      <StatsDashboard />
      <ProMetaProgress />
    </>
  );
}

function SyncIndicator({ state }: { state: SyncState }) {
  if (state === 'guest') {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors duration-150 hover:text-(--primary)"
      >
        <span className="text-text-muted">●</span>
        Локально · войти для синка
      </Link>
    );
  }
  const cfg: Record<Exclude<SyncState, 'guest'>, { color: string; text: string }> = {
    loading: { color: 'var(--color-text-muted)', text: 'Синхронизация…' },
    synced: { color: 'var(--color-success)', text: 'Синхронизировано' },
    error: { color: 'var(--color-danger)', text: 'Оффлайн — локально' },
  };
  const c = cfg[state];
  return (
    <span
      className="flex items-center gap-1.5 font-blender-medium text-type-micro uppercase tracking-widest"
      style={{ color: c.color }}
    >
      ● {c.text}
    </span>
  );
}

function MuteToggle() {
  const { muted, toggle } = useSfx();
  return (
    <button
      type="button"
      onClick={toggle}
      title={muted ? 'Включить звук' : 'Выключить звук'}
      className="flex items-center gap-1.5 border border-lines-hover bg-card-menu px-2.5 py-1.5 text-text-muted transition-colors duration-150 hover:text-(--primary)"
    >
      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      <span className="font-blender-medium text-type-micro uppercase tracking-widest">
        {muted ? 'звук выкл' : 'звук вкл'}
      </span>
    </button>
  );
}
