// Чистые хелперы экономики биткоин-фермы убежища EFT (без сторов/DOM/React, без сайд-эффектов).
// Формулы 1:1 с docs/research/eft-bitcoin-profit-tarkovdev.md (§ Formulas + worked-examples)
// и docs/decisions/bitcoin-profit-rework.md §1–2, §9. Канон tarkov.dev патч 1.1.0.
//
// Сверка worked-examples (в проекте НЕТ юнит-раннера — §7.2 CLAUDE; проверять руками):
//   coinsPerDay: 1 GPU → 0.288 · 10 → 0.395 · 25 → 0.573 · 50 → 0.870 (допуск ±0.5%)
//   secPerCoin:  1 → 300000 · 10 → ≈218814 · 25 → ≈150799 · 50 → ≈99337
//
// Топливо (§3 ресёрча, метод tarkov.dev useFuelPricePerDay):
//   effDurationMs = tankDurationMs / (1 − rateУУ) × (solarActive ? 2 : 1)
//   ₽/сут        = tankPriceRub / effDurationMs × 86_400_000
//   Пример: Expeditionary (45 473 000 мс), цена бака 40 000 ₽, УУ ур.0 (rate=0):
//     без Solar → 40000 / 45_473_000 × 86_400_000 ≈ 76 002 ₽/сут
//     с  Solar → длительность ×2 (90 946 000 мс) ≈ 38 001 ₽/сут  (ровно вдвое меньше)

/** Базовое время производства одного Physical Bitcoin, сек. Канон 1.1.0 (⚠️ НЕ 145000 — устарело). */
export const BTC_BASE_SEC = 300000;

/** Коэффициент ускорения на каждую видеокарту сверх первой (≈1/24.25, НЕ 1/49). */
export const BTC_GPU_K = 0.041225;

/** Совокупные слоты GPU по уровню фермы. Индекс = уровень (0 = не построена). */
export const BTC_FARM_SLOTS = [0, 10, 25, 50] as const;

/** Баки топлива генератора: базовая длительность питания (мс), лейбл, normalizedName зеркала. */
export const FUEL_TANKS = {
  expeditionary: { durationMs: 45_473_000, label: "Expeditionary", normalizedName: "expeditionary-fuel-tank" },
  metal: { durationMs: 75_789_000, label: "Metal", normalizedName: "metal-fuel-tank" },
} as const;

export type FuelTankKey = keyof typeof FUEL_TANKS;

/**
 * Ёмкость топливных слотов Генератора: сколько канистр вмещает модуль на уровне.
 * Индекс = уровень (0 = не построен). L1:2 / L2:4 / L3:6 (подтверждено V4DYA 2026-08-23).
 */
export const GENERATOR_FUEL_SLOTS = [0, 2, 4, 6] as const;

/** Число топливных слотов Генератора для уровня; уровень клампится в 0..3. */
export function generatorFuelSlots(level: number): number {
  return clampIndex(GENERATOR_FUEL_SLOTS, level);
}

/**
 * Автономность фермы в сутках при `count` установленных канистрах одного типа:
 *   effDurationMs = tankDurationMs / (1 − rateУУ) × (solarActive ? 2 : 1)   ← та же формула, что в fuelCostPerDay
 *   M = count × effDurationMs / 86_400_000
 * Число канистр N масштабирует запас линейно; на ₽/сут расхода НЕ влияет (расход per-бак).
 * Некорректный вход (count/duration ≤0) → 0.
 *
 * Worked-example (ожидание из формулы tarkov.dev, не из кода):
 *   1 metal-бак (75_789_000 мс), УУ ур.0 (rate=0), Solar off →
 *     effDurationMs = 75_789_000 / 1 × 1 = 75_789_000; M = 75_789_000 / 86_400_000 ≈ 0.877 дня.
 *   ×N линейно (2 бака ≈ 1.754); Solar on → ×2 (1 metal ≈ 1.754 дня).
 */
export function fuelAutonomyDays(
  count: number,
  tankDurationMs: number,
  hideoutMgmtLevel: number,
  solarActive: boolean,
): number {
  const n = safePos(count);
  const baseDuration = safePos(tankDurationMs);
  if (n <= 0 || baseDuration <= 0) return 0;
  const effectiveDurationMs =
    (baseDuration / (1 - hideoutMgmtFuelRate(hideoutMgmtLevel))) * (solarActive ? 2 : 1);
  return (n * effectiveDurationMs) / 86_400_000;
}

/** Не-число / NaN / Infinity / ≤0 → 0. Страховка от деления на 0 в цепочке. */
function safePos(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Значение из массива по уровню: floor + кламп индекса в 0..(len-1). */
function clampIndex(arr: readonly number[], level: number): number {
  const max = arr.length - 1;
  const lvl = Number.isFinite(level) ? Math.floor(level) : 0;
  const clamped = lvl < 0 ? 0 : lvl > max ? max : lvl;
  return arr[clamped];
}

/**
 * Время производства одного Physical Bitcoin, сек: BASE / (1 + (GPU−1)·K).
 * GPU клампится снизу до 1 (минимум одна карта для работы фермы).
 */
export function secPerCoin(gpu: number): number {
  const cards = Number.isFinite(gpu) && gpu > 1 ? gpu : 1;
  return BTC_BASE_SEC / (1 + (cards - 1) * BTC_GPU_K);
}

/** Произведённых Physical Bitcoin (юнитов) в сутки: 86400 / secPerCoin(gpu). */
export function coinsPerDay(gpu: number): number {
  return 86400 / secPerCoin(gpu);
}

/** Совокупные слоты GPU для уровня фермы; уровень клампится в 0..3. */
export function slotsForLevel(level: number): number {
  return clampIndex(BTC_FARM_SLOTS, level);
}

/**
 * Скидка расхода топлива от навыка «Управление убежищем»: min(level·0.5%, 25%).
 * На скорость добычи биткоина навык НЕ влияет — только на топливо (§4 ресёрча).
 */
export function hideoutMgmtFuelRate(level: number): number {
  const lvl = Number.isFinite(level) && level > 0 ? level : 0;
  return Math.min(lvl * 0.005, 0.25);
}

/**
 * Стоимость топлива в сутки (₽) методом tarkov.dev `useFuelPricePerDay`:
 *   эффективная длительность = durationMs / (1 − rate(HM)) × (solarActive ? 2 : 1)
 *   ₽/сутки = tankPriceRub / эффективная_длительность_мс · 86_400_000
 * Solar Power (L1) удваивает длительность бака → ровно вдвое меньше ₽/сут.
 * Цена бака ≤0 (нет оффера / топливо выкл) → 0.
 */
export function fuelCostPerDay(
  tankPriceRub: number,
  tankDurationMs: number,
  hideoutMgmtLevel: number,
  solarActive: boolean,
): number {
  const price = safePos(tankPriceRub);
  const baseDuration = safePos(tankDurationMs);
  if (price <= 0 || baseDuration <= 0) return 0;
  const effectiveDurationMs =
    (baseDuration / (1 - hideoutMgmtFuelRate(hideoutMgmtLevel))) * (solarActive ? 2 : 1);
  return (price / effectiveDurationMs) * 86_400_000;
}

export interface BtcEconomyInput {
  gpu: number;
  /** ₽ за 1 Physical Bitcoin (выбранная венью; уже net, если барахолка). */
  btcSellPrice: number;
  /** Дешевейшая закупка одной GPU, ₽. */
  gpuPriceRub: number;
  fuelEnabled: boolean;
  /** Цена выбранного бака, ₽ (0 если нет/выкл). */
  tankPriceRub: number;
  /** Базовая длительность выбранного бака, мс. */
  tankDurationMs: number;
  hideoutMgmtLevel: number;
  /** Построен ли модуль Solar Power (L1) — удваивает длительность бака. Дефолт false. */
  solarActive?: boolean;
}

export interface BtcEconomy {
  secPerCoin: number;
  coinsPerDay: number;
  /** Доход/сутки = coinsPerDay · btcSellPrice. */
  grossPerDay: number;
  /** Топливо/сутки; 0 если fuelEnabled=false. */
  fuelPerDay: number;
  /** Чистая прибыль/сутки = gross − fuel. */
  netPerDay: number;
  /** Вложение в видеокарты = gpu · gpuPriceRub. */
  gpuInvest: number;
  /** Окупаемость, дней = ceil(invest / net); Infinity если net ≤ 0. */
  paybackDays: number;
  /** Прибыль на 1 GPU/сутки = net / gpu. */
  netPerGpu: number;
  /** ROI %/мес = net · 30 / invest · 100; 0 если invest ≤ 0. */
  roiMonthlyPct: number;
}

/**
 * Полная экономика фермы за сутки. Чистые арифметические выводы из §1–2 спеки;
 * все деления защищены (net ≤ 0 → payback Infinity, gpu/invest ≤ 0 → 0).
 */
export function computeBtcEconomy(i: BtcEconomyInput): BtcEconomy {
  const sec = secPerCoin(i.gpu);
  const perDay = coinsPerDay(i.gpu);
  const grossPerDay = perDay * safePos(i.btcSellPrice);
  const solar = i.solarActive ?? false;
  const fuelPerDay = i.fuelEnabled
    ? fuelCostPerDay(i.tankPriceRub, i.tankDurationMs, i.hideoutMgmtLevel, solar)
    : 0;
  const netPerDay = grossPerDay - fuelPerDay;

  const cards = Number.isFinite(i.gpu) && i.gpu > 0 ? i.gpu : 1;
  const gpuInvest = cards * safePos(i.gpuPriceRub);

  const paybackDays = netPerDay > 0 ? Math.ceil(gpuInvest / netPerDay) : Infinity;
  const netPerGpu = netPerDay / cards;
  const roiMonthlyPct = gpuInvest > 0 ? ((netPerDay * 30) / gpuInvest) * 100 : 0;

  return {
    secPerCoin: sec,
    coinsPerDay: perDay,
    grossPerDay,
    fuelPerDay,
    netPerDay,
    gpuInvest,
    paybackDays,
    netPerGpu,
    roiMonthlyPct,
  };
}
