'use client';

import { useMemo, useState } from 'react';
import { calcFleaFee } from '@/lib/barter-calc';

export interface BtcPrices {
  btcTherapist: number;
  btcFlea: number;
  btcBase: number;
  gpuCost: number;
}

// Игровая формула добычи (вики): время одного коина (сек) = 145000 / (1 + (GPU-1)*0.041225).
const BASE_SEC = 145000;
const GPU_K = 0.041225;
const MAX_GPU = 50; // Биткоин-ферма ур.3
const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

function timePerCoinSec(gpu: number): number {
  return BASE_SEC / (1 + (gpu - 1) * GPU_K);
}
function fmtHms(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}ч ${m}м`;
}

export function BitcoinProfitClient({ prices }: { prices: BtcPrices }) {
  const [gpu, setGpu] = useState(10);
  const [venue, setVenue] = useState<'therapist' | 'flea'>('therapist');

  const r = useMemo(() => {
    const g = Math.max(1, Math.min(MAX_GPU, gpu));
    const tps = timePerCoinSec(g);
    const coinsPerDay = 86400 / tps;
    const fleaNetPerCoin =
      prices.btcFlea > 0 ? prices.btcFlea - calcFleaFee(prices.btcBase, prices.btcFlea, 1) : 0;
    const netPerCoin = venue === 'therapist' ? prices.btcTherapist : fleaNetPerCoin;
    const dailyProfit = coinsPerDay * netPerCoin;
    const gpuInvest = g * prices.gpuCost;
    const paybackDays = dailyProfit > 0 ? gpuInvest / dailyProfit : Infinity;
    return {
      g,
      tps,
      coinsPerDay,
      coinsPerMonth: coinsPerDay * 30,
      netPerCoin,
      fleaNetPerCoin,
      dailyProfit,
      gpuInvest,
      paybackDays,
      low: coinsPerDay * netPerCoin * 0.9,
      high: coinsPerDay * netPerCoin * 1.1,
    };
  }, [gpu, venue, prices]);

  const noData = prices.btcTherapist <= 0 && prices.btcFlea <= 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Ввод */}
      <div className="flex flex-col gap-4 rounded-md border border-lines-hover bg-card-menu p-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">Видеокарт</span>
            <span className="text-lg font-blender-medium text-(--primary)">{r.g}</span>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_GPU}
            value={gpu}
            onChange={(e) => setGpu(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
          <div className="mt-2 flex gap-1.5">
            {[1, 10, 25, 50].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setGpu(p)}
                className={`h-7 flex-1 rounded-xs text-type-caption font-blender-medium transition-colors ${
                  r.g === p ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'border border-lines-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">Продажа</span>
          <div className="flex gap-1.5">
            {([
              { k: 'therapist', label: `Терапевт (${fmt(prices.btcTherapist)} ₽)` },
              { k: 'flea', label: `Барахолка (${fmt(r.fleaNetPerCoin)} ₽ чист.)` },
            ] as const).map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setVenue(o.k)}
                className={`h-9 flex-1 rounded text-type-caption font-blender-medium uppercase tracking-widest transition-colors ${
                  venue === o.k ? 'border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)' : 'border border-lines-hover text-text-secondary hover:text-text-primary'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-type-caption text-text-muted font-blender-book">
          Цена GPU (закупка): {fmt(prices.gpuCost)} ₽ · из зеркала. Топливо в расчёт не включено.
        </div>
      </div>

      {/* Метрики */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric label="Добыча" big={`${r.coinsPerDay.toFixed(2)} BTC / сутки`} sub={`${r.coinsPerMonth.toFixed(1)} BTC / месяц`} accent />
        <Metric label="Время на 1 BTC" big={fmtHms(r.tps)} sub={`при ${r.g} GPU`} />
        <Metric label="Прибыль / сутки" big={`${fmt(r.dailyProfit)} ₽`} sub={`±10%: ${fmt(r.low)} … ${fmt(r.high)} ₽`} accent />
        <Metric
          label="Окупаемость GPU"
          big={Number.isFinite(r.paybackDays) ? `${Math.ceil(r.paybackDays)} дн` : '—'}
          sub={`вложено ${fmt(r.gpuInvest)} ₽ в ${r.g} GPU`}
        />
        {noData && (
          <p className="sm:col-span-2 text-type-caption text-text-muted font-blender-book">
            Цена биткоина недоступна (зеркало выключено) — метрики появятся после синхронизации цен.
          </p>
        )}
        <p className="sm:col-span-2 text-type-caption text-text-muted font-blender-book">
          Формула добычи: 145000 / (1 + (GPU−1)·0.041225) сек на коин. Ферма останавливается на 3 несобранных биткоинах.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, big, sub, accent }: { label: string; big: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-lines-hover bg-card-menu p-4">
      <p className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-blender-medium ${accent ? 'text-(--primary)' : 'text-text-primary'}`}>{big}</p>
      {sub && <p className="mt-1 text-sm text-text-secondary font-blender-book">{sub}</p>}
    </div>
  );
}
