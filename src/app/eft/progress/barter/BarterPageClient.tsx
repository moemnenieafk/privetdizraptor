'use client';

import { useState, useCallback, useEffect } from 'react';
import { Trash2, CheckCircle2, Copy } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useBarterStore } from '@/store/useBarterStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import { calcBarterProfit, formatRub } from '@/lib/barter-calc';
import { computeProStatus } from '@/types/gamification';
import { BarterSearchBar } from '@/components/features/barter/BarterSearchBar';
import { BarterTradeSelector } from '@/components/features/barter/BarterTradeSelector';
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

  const { isUnlocked: proUnlocked } = computeProStatus(xp, confirmedBarterIds, badges);

  const [dealConfirmed, setDealConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDealConfirmed(false);
  }, [selectedBarter?.id]);

  const handleConfirmDeal = useCallback(() => {
    if (!selectedBarter || dealConfirmed) return;
    const calc = calcBarterProfit(selectedBarter, items);
    recordDeal({ barter: selectedBarter, calc, allBarters: initialBarters });
    setDealConfirmed(true);
  }, [selectedBarter, items, dealConfirmed, recordDeal, initialBarters]);

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
      `Экономия:           ${sign(calc.calculatedSavings)}${formatRub(calc.calculatedSavings)}`,
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

      <div className="mt-2 mb-5 space-y-2">
        {/* Row 1: Barter trade selector */}
        <BarterTradeSelector allBarters={initialBarters} />

        {/* Row 2: Manual item search + clear — скрыто в режиме бартер-симуляции */}
        {!selectedBarter && (
          <div className="flex items-center gap-3">
            <BarterSearchBar allItems={initialItems} />
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearStash}
                className="flex shrink-0 items-center gap-1.5 px-3 py-2 bg-card-menu border border-lines-hover hover:border-failure hover:text-failure text-text-secondary font-blender-book text-sm transition-colors duration-150"
              >
                <Trash2 size={13} />
                Очистить схрон
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <StashGrid />
      </div>

      <StashSummary />

      {selectedBarter && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {dealConfirmed ? (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-card-menu border border-lines-hover">
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
              className="flex items-center gap-2 px-4 py-2.5 bg-card-menu border border-lines-hover hover:border-(--primary) font-blender-medium text-xs uppercase tracking-widest text-text-secondary hover:text-(--primary) transition-colors duration-150"
            >
              ▲ Зафиксировать сделку
            </button>
          )}

          {proUnlocked && (
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-card-menu border border-lines-hover font-blender-medium text-xs uppercase tracking-widest transition-colors duration-150"
              style={copied ? { color: 'var(--color-success)', borderColor: 'var(--color-success)' } : { color: 'var(--color-text-muted)' }}
            >
              <Copy size={12} />
              {copied ? 'Скопировано' : 'Экспорт'}
            </button>
          )}
        </div>
      )}

      <StatsDashboard />
      <ProMetaProgress />
    </>
  );
}
