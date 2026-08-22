'use client';

// Клиент раздела «Прибыль Bitcoin» (T3 bitcoin-profit-rework). Дашборд ОДНОЙ пассивной
// биткоин-фермы в дизайн-языке соседних hideout-страниц (craft-profit / modules): интро-блок,
// плитки-уровни (стиль HideoutBuildTracker.moduleTiles), скилл-индикатор + тумблеры (паттерны
// craft-profit), крупный ГЕРОЙ-вердикт + шкала масштабирования по GPU, грид MetricCard.
// Экономику считает ТОЛЬКО через computeBtcEconomy (T1) в useMemo (§4.7 — не в JSX).
// Профиль-синк «гибрид C»: уровень фермы из useHideoutStore (+editionFloor), навык УУ из
// resolveSkillLevel (usePmcStatsStore + useManualProfileStore); слайдеры «что-если» поверх.
import { useEffect, useMemo, useState } from 'react';
import { Fuel } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useManualProfileStore } from '@/store/useManualProfileStore';
import { resolveSkillLevel } from '@/lib/tarkov/player-view-merge';
import { editionFloor } from '@/lib/hideout-edition';
import { calcFleaFee } from '@/lib/barter-calc';
import { MetricCard } from '@/components/ui/kit/MetricCard';
import { stationIconClass } from '@/components/features/hideout/HideoutBuildTracker';
import { SKILL_ICONS } from '@/components/features/adaptive/skill-icons';
import {
  BTC_FARM_SLOTS,
  FUEL_TANKS,
  computeBtcEconomy,
  slotsForLevel,
  type BtcEconomy,
  type FuelTankKey,
} from '@/lib/bitcoin-profit';

export interface BtcPrices {
  btcTherapist: number;
  btcFlea: number;
  btcBase: number;
  gpuCost: number;
  fuel: { expeditionary: number; metal: number };
}

const FARM_NN = 'bitcoin-farm';
const SKILL_HIDEOUT_MGMT = 'HideoutManagement';
const GPU_SCALE_POINTS = [1, 10, 25, 50] as const; // контрольные точки шкалы масштабирования (§9)

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');
const fmtSigned = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
function fmtHms(sec: number): string {
  const totalH = Math.floor(sec / 3600);
  if (totalH >= 24) {
    const d = Math.floor(totalH / 24);
    const h = totalH % 24;
    return `${d}д ${h}ч`;
  }
  const m = Math.round((sec % 3600) / 60);
  return `${totalH}ч ${m}м`;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Цветокод вердикта чистой прибыли/сутки: выгодно · около нуля · в минус. */
type Verdict = 'good' | 'near' | 'bad';
function verdictOf(net: number): Verdict {
  if (net <= 0) return 'bad';
  if (net < 20_000) return 'near';
  return 'good';
}
const VERDICT_TEXT: Record<Verdict, string> = {
  good: 'text-nvg-green',
  near: 'text-tactical-amber',
  bad: 'text-red-500',
};
const VERDICT_BG: Record<Verdict, string> = {
  good: 'bg-nvg-green',
  near: 'bg-tactical-amber',
  bad: 'bg-red-500',
};
const VERDICT_LABEL: Record<Verdict, string> = {
  good: 'Ферму держать выгодно',
  near: 'На грани окупаемости',
  bad: 'Сейчас в минус',
};

export function BitcoinProfitClient({ prices }: { prices: BtcPrices }) {
  // mounted-гард: persist-сторы читаем только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Профиль: уровень фермы (+editionFloor), издание, навык УУ (загруженный + ручные оверрайды).
  const levels = useHideoutStore((s) => s.levels);
  const edition = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId)?.edition);
  const skillView = usePmcStatsStore((s) => s.view);
  const manualSkills = useManualProfileStore((s) => s.skills);

  // Построенный уровень фермы из профиля (max сохранённого и гарантированного изданием). До маунта 0.
  const profileFarmLevel = mounted ? Math.max(levels[FARM_NN] ?? 0, editionFloor(FARM_NN, edition)) : 0;
  // Уровень УУ из профиля. До маунта 0.
  const profileMgmtLevel = mounted ? resolveSkillLevel(skillView, manualSkills, SKILL_HIDEOUT_MGMT) : 0;

  // Локальный стейт «что-если». Уровень фермы: null → следуем профилю (или L1, если ферма не построена).
  const [farmLevelOverride, setFarmLevelOverride] = useState<number | null>(null);
  const [gpuOverride, setGpuOverride] = useState<number | null>(null);
  const [mgmtOverride, setMgmtOverride] = useState<number | null>(null);
  const [tank, setTank] = useState<FuelTankKey>('metal');
  const [fuelEnabled, setFuelEnabled] = useState(true);
  const [venuePref, setVenuePref] = useState<'therapist' | 'flea'>('therapist');

  // Эффективный уровень фермы: override, иначе профиль (минимум L1 для конфигуратора).
  const farmLevel = clamp(farmLevelOverride ?? Math.max(profileFarmLevel, 1), 1, 3);
  const slots = slotsForLevel(farmLevel);
  // GPU: override клампится к слотам уровня; дефолт — полный слот уровня.
  const gpu = clamp(gpuOverride ?? slots, 1, slots);
  const mgmtLevel = clamp(mgmtOverride ?? profileMgmtLevel, 0, 51);
  // Быстрые кнопки GPU: уникальные значения [1,10,25,slots] в пределах слотов уровня — без дублей
  // (ур.1 → 1/Полный(10); ур.2 → 1/10/Полный(25); ур.3 → 1/10/25/Полный(50)).
  const gpuQuickValues = useMemo(
    () => [...new Set([1, 10, 25, slots].filter((v) => v <= slots))].sort((a, b) => a - b),
    [slots],
  );

  // Барахолка-венью: показываем ТОЛЬКО если оффер BTC есть в зеркале (§9). Net = цена − налог.
  const fleaNetPerCoin = useMemo(
    () => (prices.btcFlea > 0 ? prices.btcFlea - calcFleaFee(prices.btcBase, prices.btcFlea, 1) : 0),
    [prices.btcFlea, prices.btcBase],
  );
  const showFlea = prices.btcFlea > 0;
  // Эффективная венью: барахолка доступна лишь при наличии оффера — иначе всегда трейдер (без setState-эффекта).
  const venue = venuePref === 'flea' && showFlea ? 'flea' : 'therapist';
  const btcSellPrice = venue === 'flea' ? fleaNetPerCoin : prices.btcTherapist;

  const tankMeta = FUEL_TANKS[tank];
  const tankPriceRub = tank === 'expeditionary' ? prices.fuel.expeditionary : prices.fuel.metal;

  // Экономика текущей конфигурации — через computeBtcEconomy (T1), в useMemo (§4.7, не в JSX).
  const eco: BtcEconomy = useMemo(
    () =>
      computeBtcEconomy({
        gpu,
        btcSellPrice,
        gpuPriceRub: prices.gpuCost,
        fuelEnabled,
        tankPriceRub,
        tankDurationMs: tankMeta.durationMs,
        hideoutMgmtLevel: mgmtLevel,
      }),
    [gpu, btcSellPrice, prices.gpuCost, fuelEnabled, tankPriceRub, tankMeta, mgmtLevel],
  );

  // Шкала масштабирования: чистая прибыль/сутки в контрольных точках GPU (клампятся к слотам уровня),
  // одним проходом. Текущее число GPU добавляем как точку, чтобы оно всегда было на шкале.
  const scale = useMemo(() => {
    const pts = new Set<number>();
    for (const p of GPU_SCALE_POINTS) if (p <= slots) pts.add(p);
    pts.add(gpu);
    const rows = [...pts]
      .sort((a, b) => a - b)
      .map((g) => ({
        gpu: g,
        net: computeBtcEconomy({
          gpu: g,
          btcSellPrice,
          gpuPriceRub: prices.gpuCost,
          fuelEnabled,
          tankPriceRub,
          tankDurationMs: tankMeta.durationMs,
          hideoutMgmtLevel: mgmtLevel,
        }).netPerDay,
      }));
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
    return { rows, maxAbs };
  }, [slots, gpu, btcSellPrice, prices.gpuCost, fuelEnabled, tankPriceRub, tankMeta, mgmtLevel]);

  const noData = prices.btcTherapist <= 0 && prices.btcFlea <= 0;
  const verdict = verdictOf(eco.netPerDay);
  const monthNet = eco.netPerDay * 30;

  return (
    <div className="flex flex-col gap-6">
      {/* Заголовок/описание раздела — в SectionHubNav (headerConfig p-hideout-btc), не дублируем. */}

      {/* 1. Конфигуратор фермы. */}
      <section className="flex flex-col gap-5 rounded-md border border-lines-hover bg-card-menu/40 p-4">
        {/* Плитки-уровни L1/L2/L3 (стиль HideoutBuildTracker.moduleTiles). */}
        <div>
          <SectionLabel>Уровень фермы</SectionLabel>
          <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
            {[1, 2, 3].map((lvl) => {
              const isSel = farmLevel === lvl;
              const isBuilt = mounted && profileFarmLevel >= lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setFarmLevelOverride(lvl);
                    setGpuOverride(null); // сброс GPU к полному слоту нового уровня
                  }}
                  title={`Биткоин-ферма ур. ${lvl} — ${BTC_FARM_SLOTS[lvl]} слотов GPU`}
                  className={`group relative flex min-h-20 select-none flex-col items-center justify-center gap-1 overflow-hidden rounded-xs border p-2 transition-all ${
                    isSel
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                      : 'border-lines-hover bg-(--color-base) hover:brightness-110'
                  }`}
                >
                  <span className="relative flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(FARM_NN)} ${
                        isSel ? 'bg-(--primary)' : 'bg-text-muted'
                      }`}
                    />
                    <span
                      className={`font-blender-medium text-[22px] leading-none tabular-nums ${
                        isSel ? 'text-(--primary)' : 'text-text-muted'
                      }`}
                    >
                      {String(lvl).padStart(2, '0')}
                    </span>
                  </span>
                  <span
                    className={`relative font-blender-medium text-type-micro uppercase tracking-wide ${
                      isSel ? 'text-(--primary)' : 'text-text-secondary'
                    }`}
                  >
                    {BTC_FARM_SLOTS[lvl]} слотов GPU
                  </span>
                  {isBuilt && (
                    <span className="relative font-blender-medium text-type-micro uppercase tracking-widest text-nvg-green">
                      Построен
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Слайдер GPU + быстрые кнопки. */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <SectionLabel className="mb-0">Видеокарты</SectionLabel>
            <span className="font-blender-medium text-lg text-(--primary) tabular-nums">
              {gpu} <span className="text-type-caption text-text-muted">/ {slots}</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={slots}
            value={gpu}
            onChange={(e) => setGpuOverride(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
            aria-label="Число видеокарт"
          />
          <div className="mt-2 flex gap-1.5">
            {gpuQuickValues.map((val) => {
              // Значение, равное потолку слотов, подписываем «Полный»; остальные — числом.
              const label = val === slots ? 'Полный' : String(val);
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGpuOverride(val)}
                  className={`h-8 flex-1 rounded-xs font-blender-medium text-type-caption transition-colors ${
                    gpu === val
                      ? 'bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-(--primary)'
                      : 'border border-lines-hover text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Скилл-индикатор УУ (паттерн craft SkillIndicator) + слайдер override. */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <SkillIndicator
              iconSrc={SKILL_ICONS.HideoutManagement?.src ?? ''}
              level={mgmtLevel}
              label="Управление убежищем"
            />
            {mounted && mgmtOverride !== null && mgmtOverride !== profileMgmtLevel && (
              <button
                type="button"
                onClick={() => setMgmtOverride(null)}
                className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)"
              >
                Из профиля · {profileMgmtLevel}
              </button>
            )}
          </div>
          <input
            type="range"
            min={0}
            max={51}
            value={mgmtLevel}
            onChange={(e) => setMgmtOverride(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
            aria-label="Уровень навыка «Управление убежищем»"
          />
          <p className="font-blender-book text-type-micro text-text-muted">
            Режет только расход топлива (до −25% на 50 ур.). На скорость добычи не влияет.
          </p>
        </div>

        {/* Тумблеры: выбор бака + учитывать топливо (паттерн craft IconToggle, расширенный подписью). */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
            Топливо
          </span>
          <div className="flex gap-1.5">
            {(Object.keys(FUEL_TANKS) as FuelTankKey[]).map((k) => {
              const active = tank === k && fuelEnabled;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTank(k)}
                  disabled={!fuelEnabled}
                  className={`flex h-9 items-center gap-1.5 rounded-sm border px-3 font-blender-medium text-type-caption uppercase tracking-wider transition-colors disabled:opacity-40 ${
                    active
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
                      : 'border-lines-hover bg-card-menu text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <Fuel className="h-4 w-4 shrink-0" aria-hidden />
                  {FUEL_TANKS[k].label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setFuelEnabled((v) => !v)}
            aria-pressed={fuelEnabled}
            className={`ml-auto flex h-9 items-center gap-2 rounded-sm border px-3 font-blender-medium text-type-caption uppercase tracking-wider transition-colors ${
              fuelEnabled
                ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
                : 'border-lines-hover bg-card-menu text-text-muted hover:text-text-secondary'
            }`}
          >
            <span
              className={`h-4 w-4 shrink-0 rounded-full border ${
                fuelEnabled ? 'border-(--primary) bg-(--primary)' : 'border-text-muted'
              }`}
              aria-hidden
            />
            Учитывать топливо
          </button>
        </div>

        {/* Венью продажи BTC (барахолка — только если оффер в зеркале, §9). */}
        <div>
          <SectionLabel>Продажа Bitcoin</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            <VenueButton
              active={venue === 'therapist'}
              onClick={() => setVenuePref('therapist')}
              label="Терапевт"
              price={prices.btcTherapist}
            />
            {showFlea && (
              <VenueButton
                active={venue === 'flea'}
                onClick={() => setVenuePref('flea')}
                label="Барахолка (чист.)"
                price={fleaNetPerCoin}
              />
            )}
          </div>
        </div>
      </section>

      {noData ? (
        <p className="rounded-md border border-lines-hover bg-card-menu/40 p-6 text-center font-blender-book text-type-caption text-text-muted">
          Цена биткоина недоступна (зеркало выключено) — метрики появятся после синхронизации цен.
        </p>
      ) : (
        <>
          {/* 3. ГЕРОЙ — вердикт + шкала масштабирования по GPU. */}
          <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            {/* Баннер-вердикт. */}
            <div className="relative flex flex-col justify-center overflow-hidden rounded-md border border-lines-hover bg-(--color-base) p-6">
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-1 ${VERDICT_BG[verdict]}`}
              />
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                {VERDICT_LABEL[verdict]}
              </span>
              <div className={`mt-1 font-blender-medium text-5xl leading-none tracking-tight tabular-nums ${VERDICT_TEXT[verdict]}`}>
                {fmtSigned(eco.netPerDay)} ₽
              </div>
              <span className="mt-1 font-blender-book text-type-caption text-text-secondary">
                чистыми в сутки · {gpu} GPU · ферма ур. {farmLevel}
              </span>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-blender-book text-type-caption text-text-secondary">
                <span>
                  Окупаемость GPU:{' '}
                  <span className="font-blender-medium text-text-primary">
                    {Number.isFinite(eco.paybackDays) ? `${eco.paybackDays} дн` : '—'}
                  </span>
                </span>
                <span>
                  За месяц ≈{' '}
                  <span className={`font-blender-medium ${VERDICT_TEXT[verdict]}`}>{fmtSigned(monthNet)} ₽</span>
                </span>
              </div>
            </div>

            {/* Шкала масштабирования: бары чистой прибыли/сутки по числу GPU. */}
            <div className="flex flex-col gap-3 rounded-md border border-lines-hover bg-(--color-base) p-5">
              <SectionLabel className="mb-0">Как растёт прибыль от числа видеокарт</SectionLabel>
              <div className="flex flex-col gap-2.5">
                {scale.rows.map((row) => {
                  const isCurrent = row.gpu === gpu;
                  const pct = Math.round((Math.abs(row.net) / scale.maxAbs) * 100);
                  const rv = verdictOf(row.net);
                  return (
                    <div key={row.gpu} className="flex items-center gap-3">
                      <span
                        className={`w-14 shrink-0 text-right font-blender-medium text-type-caption tabular-nums ${
                          isCurrent ? 'text-(--primary)' : 'text-text-muted'
                        }`}
                      >
                        {row.gpu} GPU
                      </span>
                      <div className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-xs bg-card-menu">
                        <div
                          className={`h-full rounded-xs transition-[width] duration-500 ${VERDICT_BG[rv]} ${
                            isCurrent ? '' : 'opacity-45'
                          }`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span
                        className={`w-24 shrink-0 text-right font-blender-medium text-type-caption tabular-nums ${
                          isCurrent ? VERDICT_TEXT[rv] : 'text-text-secondary'
                        }`}
                      >
                        {fmtSigned(row.net)} ₽
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 4. Метрики — грид MetricCard. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Добыча BTC / сутки" value={`${eco.coinsPerDay.toFixed(2)} BTC`} subtext={`${(eco.coinsPerDay * 30).toFixed(1)} BTC / месяц`} />
            <MetricCard label="Время на 1 BTC" value={fmtHms(eco.secPerCoin)} subtext={`при ${gpu} GPU`} />
            <MetricCard label="Доход / сутки" value={`${fmt(eco.grossPerDay)} ₽`} subtext={`продажа ${fmt(btcSellPrice)} ₽ / BTC`} />
            <MetricCard
              label="Топливо / сутки"
              value={eco.fuelPerDay > 0 ? `−${fmt(eco.fuelPerDay)} ₽` : '—'}
              subtext={fuelEnabled ? `${tankMeta.label} · УУ ${mgmtLevel}` : 'не учитывается'}
              accent={eco.fuelPerDay > 0 ? 'warning' : 'default'}
            />
            <MetricCard label="Чистая прибыль / сутки" value={`${fmtSigned(eco.netPerDay)} ₽`} subtext="доход − топливо" accent="primary" />
            <MetricCard
              label="Окупаемость GPU"
              value={Number.isFinite(eco.paybackDays) ? `${eco.paybackDays} дн` : '—'}
              subtext={`вложено ${fmt(eco.gpuInvest)} ₽`}
            />
            <MetricCard label="Прибыль на 1 GPU" value={`${fmtSigned(eco.netPerGpu)} ₽`} subtext="в сутки" />
            <MetricCard
              label="ROI % / мес"
              value={`${eco.roiMonthlyPct > 0 ? '+' : ''}${eco.roiMonthlyPct.toFixed(0)}%`}
              subtext="от вложений в GPU"
              accent={eco.roiMonthlyPct > 0 ? 'success' : 'default'}
            />
          </div>
        </>
      )}

      {/* 5. Что нужно / вложения. */}
      <section className="flex flex-col gap-3 rounded-md border border-lines-hover bg-card-menu/40 p-4">
        <SectionLabel>Что нужно</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <Chip label={`GPU × ${gpu}`} value={`${fmt(eco.gpuInvest)} ₽`} note={`по ${fmt(prices.gpuCost)} ₽`} />
          <Chip label="Цена Bitcoin (Терапевт)" value={`${fmt(prices.btcTherapist)} ₽`} />
          {fuelEnabled && tankPriceRub > 0 && (
            <Chip label={`Бак ${tankMeta.label}`} value={`${fmt(tankPriceRub)} ₽`} note="дешевейшая закупка" />
          )}
        </div>
        <p className="font-blender-book text-type-micro text-text-muted">
          Ферма останавливается на 3 несобранных биткоинах (элита УУ → 5) — собирай вовремя. Цена Bitcoin
          динамическая (обновляется в игре ночью), берётся из зеркала как есть.
        </p>
      </section>
    </div>
  );
}

/** Метка-заголовок блока с линией (rule-micro-labels). */
function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted ${className || 'mb-3'}`}>
      <span aria-hidden className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

/** Read-only индикатор навыка: арт-иконка + крупный уровень + подпись (паттерн craft-profit). */
function SkillIndicator({ iconSrc, level, label }: { iconSrc: string; level: number; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {iconSrc && <img src={iconSrc} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-xs object-contain" />}
      <span className="text-2xl leading-none tabular-nums text-(--primary) font-blender-medium">{level}</span>
      <span className="max-w-32 font-blender-medium text-type-micro uppercase leading-tight tracking-widest text-text-muted">
        {label}
      </span>
    </div>
  );
}

/** Кнопка выбора венью продажи с ценой. */
function VenueButton({
  active,
  onClick,
  label,
  price,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  price: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-sm border px-3 font-blender-medium text-type-caption uppercase tracking-wider transition-colors ${
        active
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-(--primary)'
          : 'border-lines-hover bg-card-menu text-text-muted hover:text-text-secondary'
      }`}
    >
      {label}
      <span className="tabular-nums text-text-secondary">{fmt(price)} ₽</span>
    </button>
  );
}

/** Чип вложения: лейбл + крупное значение + опц. заметка. */
function Chip({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-sm border border-lines-hover bg-(--color-base) px-3 py-2">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">{label}</span>
      <span className="font-blender-medium text-type-caption text-text-primary tabular-nums">
        {value}
        {note && <span className="ml-1.5 font-blender-book text-type-micro text-text-muted">{note}</span>}
      </span>
    </div>
  );
}
