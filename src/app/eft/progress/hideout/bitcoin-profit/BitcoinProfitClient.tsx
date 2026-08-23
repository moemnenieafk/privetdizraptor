'use client';

// Клиент раздела «Прибыль Bitcoin» (T3 bitcoin-profit-rework). Дашборд ОДНОЙ пассивной
// биткоин-фермы. КОНФИГУРАТОР пересобран 1:1 по Figma-ноде 3022:1901 (design-to-code,
// bitcoin-config-redesign): EFT-native 3-колоночный ряд — «Уровень фермы» (плитки + кликабельный
// грид GPU из gpu-icon.svg), «Убежище ЧВК» (навык УУ со степперами + учёт топлива ячейками),
// «Продажа Bitcoin» (карточка Physical Bitcoin + Терапевт). Блоки НИЖЕ (герой-вердикт, шкала GPU,
// метрики, «что нужно») — не тронуты, кормятся тем же `eco`.
// Экономику считает ТОЛЬКО через computeBtcEconomy (T1) в useMemo (§4.7 — не в JSX).
// Профиль-синк «гибрид C»: уровень фермы из useHideoutStore (+editionFloor), навык УУ из
// resolveSkillLevel (usePmcStatsStore + useManualProfileStore); override поверх.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus } from 'lucide-react';
import { useHideoutStore } from '@/store/useHideoutStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { usePmcStatsStore } from '@/store/usePmcStatsStore';
import { useManualProfileStore } from '@/store/useManualProfileStore';
import { resolveSkillLevel } from '@/lib/tarkov/player-view-merge';
import { editionFloor } from '@/lib/hideout-edition';
import { stationIconClass } from '@/components/features/hideout/HideoutBuildTracker';
import { SKILL_ICONS } from '@/components/features/adaptive/skill-icons';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { traderImg } from '@/lib/trader-utils';
import {
  BTC_FARM_SLOTS,
  FUEL_TANKS,
  computeBtcEconomy,
  fuelAutonomyDays,
  generatorFuelSlots,
  slotsForLevel,
  type BtcEconomy,
  type FuelTankKey,
} from '@/lib/bitcoin-profit';
import type { FunnelNode } from '@/lib/acquisition-funnel';
import type { BtcFuelInfo } from './page';

export interface BtcPrices {
  btcTherapist: number;
  btcFlea: number;
  btcBase: number;
  gpuCost: number;
  /** Старая плоская цена бака (buyFor) — оставлена для совместимости page.tsx, клиент читает fuelFunnel. */
  fuel: { expeditionary: number; metal: number };
  /** Оптимальная цена по воронке + путь для каждого бака (T03). */
  fuelFunnel: { expeditionary: BtcFuelInfo; metal: BtcFuelInfo };
  /** Дешевейший бак по воронке — дефолт-выбор; null если оба недоступны. */
  cheapestTank: FuelTankKey | null;
}

const FARM_NN = 'bitcoin-farm';
const SOLAR_NN = 'solar-power'; // модуль Solar Power — удваивает время работы бака (×2)
const GENERATOR_NN = 'generator'; // Генератор — ёмкость топливных слотов = число канистр
const SKILL_HIDEOUT_MGMT = 'HideoutManagement';
const GPU_SCALE_POINTS = [1, 10, 25, 50] as const; // контрольные точки шкалы масштабирования (§9)

// Иконки предметов конфигуратора (id зеркала tarkov.dev).
const BTC_ITEM_ID = '59faff1d86f7746c51718c9c'; // Physical Bitcoin
const FUEL_ITEM_ID: Record<FuelTankKey, string> = {
  expeditionary: '5d1b371186f774253763a656',
  metal: '5d1b36a186f7742523398433',
};
const GPU_ITEM_ID = '57347ca924597744596b4e71'; // Graphics card
const GPU_SLUG = 'graphics-card'; // normalizedName → карточка предмета
const GPU_MASK = 'url(/icons/eft/04-progression/gpu-icon.svg)';
const FUEL_MASK = 'url(/icons/eft/04-progression/crafting/full-tank-icon.svg)'; // маска слота сетки канистр
const RUBLE_MASK = 'url(/icons/eft/03-items/currency-ruble.svg)';
const BARTER_MASK = 'url(/icons/eft/04-progression/barter-profit.svg)';
const CRAFT_MASK = 'url(/icons/eft/04-progression/craft-profit.svg)';
const FUEL_GRID_MAX = 6; // максимум ячеек сетки (ёмкость Генератора L3)

// Иконки метрик (маски, красятся по семантике).
const IC_MINE = 'url(/icons/eft/04-progression/bitcoin-profit.svg)'; // добыча BTC
const IC_TIME = 'url(/icons/eft/02-quests/ingame-events.svg)'; // время / доход
const IC_FUEL = 'url(/icons/eft/04-progression/crafting/empty-tank-icon.svg)'; // топливо
const IC_PROFIT = 'url(/icons/eft/03-items/profit-icon.svg)'; // чистая прибыль / профит за месяц
const GPU_COLS = 10;
const GPU_ROWS = 5;

// Рарити-фон EFT-ячеек «что нужно купить» (как в Figma): базовый градиент + тинт редкости.
const CELL_BASE = 'linear-gradient(180deg, rgb(49,49,54) 0%, rgb(20,20,22) 100%)';
const rarityCellBg = (tint: string) => `linear-gradient(90deg, ${tint} 0%, ${tint} 100%), ${CELL_BASE}`;
const GPU_CELL_BG = rarityCellBg('rgba(28,65,86,0.302)'); // синяя редкость видеокарты
const FUEL_CELL_BG = rarityCellBg('rgba(104,102,40,0.302)'); // оливковая редкость топлива

// Мета баков для карточки «что нужно купить»: имя предмета и slug карточки. Источник (у кого/как) —
// динамический, из дерева воронки (fuelFunnel[tank].path), а не константа.
const FUEL_BUY: Record<FuelTankKey, { name: string; slug: string }> = {
  metal: { name: 'Металлическая топливная канистра', slug: 'metal-fuel-tank' },
  expeditionary: { name: 'Экспедиционная топливная канистра', slug: 'expeditionary-fuel-tank' },
};

/** Человекочитаемый ярлык источника воронки: у кого купить / бартер / крафт. */
function funnelSourceLabel(node: FunnelNode): string {
  const lvl = node.level != null ? ` LL${node.level}` : '';
  switch (node.source) {
    case 'trader':
      return `Купить${node.sourceName ? ` у ${node.sourceName}` : ''}`;
    case 'flea':
      return 'Купить на барахолке';
    case 'barter':
      return `Бартер${node.sourceName ? ` у ${node.sourceName}` : ''}${lvl}`;
    case 'craft':
      return `Крафт${node.sourceName ? `: ${node.sourceName}` : ''}${lvl}`;
    default:
      return 'Источник недоступен';
  }
}

/**
 * Иконка типа источника воронки (перед общей суммой): бартер · барахолка (рубль) ·
 * торговец (аватар) · крафт. Размер 16px. Тултип — человекочитаемый ярлык источника.
 */
function SourceIcon({ node }: { node: FunnelNode }) {
  const title = funnelSourceLabel(node);
  if (node.source === 'trader' && node.sourceName) {
    return (
      <img
        src={traderImg(node.sourceName)}
        alt=""
        title={title}
        loading="lazy"
        className="h-4 w-4 shrink-0 rounded-[0.125rem] object-cover"
      />
    );
  }
  const mask =
    node.source === 'barter' ? BARTER_MASK : node.source === 'craft' ? CRAFT_MASK : RUBLE_MASK;
  return (
    <span
      aria-hidden
      title={title}
      className="icon-mask h-4 w-4 shrink-0 bg-(--primary)"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    />
  );
}

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

/** Минимальный уровень фермы, чьи слоты ≥ нужного числа видеокарт (для клика по locked-слоту). */
function minLevelForGpu(count: number): number {
  for (let lvl = 1; lvl <= 3; lvl++) if (slotsForLevel(lvl) >= count) return lvl;
  return 3;
}

/** Минимальный уровень Генератора, чья ёмкость ≥ нужного числа канистр (для клика по locked-слоту сетки). */
function minLevelForGenerator(count: number): number {
  for (let lvl = 1; lvl <= 3; lvl++) if (generatorFuelSlots(lvl) >= count) return lvl;
  return 3;
}

/** Русское склонение слова «день» по числу: 1 день · 2 дня · 5 дней. */
function plDay(n: number): string {
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return 'дней';
  const d10 = n % 10;
  if (d10 === 1) return 'день';
  if (d10 >= 2 && d10 <= 4) return 'дня';
  return 'дней';
}

/** Русское склонение слова «канистра» по числу: 1 канистра · 2 канистры · 5 канистр. */
function plCanister(n: number): string {
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return 'канистр';
  const d10 = n % 10;
  if (d10 === 1) return 'канистра';
  if (d10 >= 2 && d10 <= 4) return 'канистры';
  return 'канистр';
}

/** Русское склонение слова «видеокарта» по числу (именительный): 1 видеокарта · 2 видеокарты · 5 видеокарт. */
function plGpu(n: number): string {
  const d100 = n % 100;
  if (d100 >= 11 && d100 <= 14) return 'видеокарт';
  const d10 = n % 10;
  if (d10 === 1) return 'видеокарта';
  if (d10 >= 2 && d10 <= 4) return 'видеокарты';
  return 'видеокарт';
}

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
  // Модуль Solar Power построен в профиле? (L1 достаточно для ×2). До маунта false.
  const profileSolarBuilt = mounted ? (levels[SOLAR_NN] ?? 0) >= 1 : false;
  // Уровень Генератора из профиля (0..3) — задаёт ёмкость топливных слотов = число канистр. До маунта 0.
  const profileGeneratorLevel = mounted ? clamp(levels[GENERATOR_NN] ?? 0, 0, 3) : 0;

  // Локальный стейт «что-если». Уровень фермы: null → следуем профилю (или L1, если ферма не построена).
  const [farmLevelOverride, setFarmLevelOverride] = useState<number | null>(null);
  const [gpuOverride, setGpuOverride] = useState<number | null>(null);
  const [mgmtOverride, setMgmtOverride] = useState<number | null>(null);
  const [tankOverride, setTankOverride] = useState<FuelTankKey | null>(null);
  const [solarOverride, setSolarOverride] = useState<boolean | null>(null);
  // Число выбранных канистр (сетка-зеркало GPU-грида); дефолт ×1. Клампится к максимуму сетки.
  const [canisterCount, setCanisterCount] = useState(1);
  // Уровень Генератора «что-если»: null → следуем профилю. Override через клик по locked-слоту сетки.
  const [generatorOverride, setGeneratorOverride] = useState<number | null>(null);
  // Открыт ли поповер выбора типа канистры.
  const [tankMenuOpen, setTankMenuOpen] = useState(false);
  const tankMenuRef = useRef<HTMLDivElement | null>(null);

  // Закрытие поповера типа канистры по клику вне / Escape.
  useEffect(() => {
    if (!tankMenuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (tankMenuRef.current && !tankMenuRef.current.contains(e.target as Node)) setTankMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTankMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [tankMenuOpen]);

  // Эффективный уровень фермы: override, иначе профиль (минимум L1 для конфигуратора).
  const farmLevel = clamp(farmLevelOverride ?? Math.max(profileFarmLevel, 1), 1, 3);
  const slots = slotsForLevel(farmLevel);
  // GPU: override клампится к слотам уровня; дефолт — полный слот уровня.
  const gpu = clamp(gpuOverride ?? slots, 1, slots);
  const mgmtLevel = clamp(mgmtOverride ?? profileMgmtLevel, 0, 51);
  // Solar: override поверх профиля (гибрид C). До маунта false (гард в profileSolarBuilt).
  const solarActive = solarOverride ?? profileSolarBuilt;
  // Активный бак: override, иначе дешевейший по воронке (T03), иначе metal как безопасный дефолт.
  const tank: FuelTankKey = tankOverride ?? prices.cheapestTank ?? 'metal';
  // Эффективный уровень Генератора: override поверх профиля (гибрид C). Ёмкость = число топливных слотов.
  const generatorLevel = clamp(generatorOverride ?? profileGeneratorLevel, 0, 3);
  const fuelSlots = generatorFuelSlots(generatorLevel);
  // Число выбранных канистр — клампим в 1..максимум сетки (защита при смене профиля/маунте).
  const canisters = clamp(canisterCount, 1, FUEL_GRID_MAX);

  // Продажа — только Терапевт (венью/флиа из UI убраны; §8).
  const btcSellPrice = prices.btcTherapist;

  const tankMeta = FUEL_TANKS[tank];
  // Цена бака — perUnit по воронке (T03), НЕ старая плоская buyFor. Путь — для блока «что нужно купить».
  const tankPriceRub = prices.fuelFunnel[tank].perUnit;
  const fuelPath = prices.fuelFunnel[tank].path;
  // Доступен ли выбранный тип по воронке (perUnit>0) — для дизейбла триггера дропдауна.
  const tankAvailable = tankPriceRub > 0;

  // Экономика текущей конфигурации — через computeBtcEconomy (T1), в useMemo (§4.7, не в JSX).
  // Топливо учитывается ВСЕГДА (без него ферма не работает) → fuelEnabled: true.
  const eco: BtcEconomy = useMemo(
    () =>
      computeBtcEconomy({
        gpu,
        btcSellPrice,
        gpuPriceRub: prices.gpuCost,
        fuelEnabled: true,
        tankPriceRub,
        tankDurationMs: tankMeta.durationMs,
        hideoutMgmtLevel: mgmtLevel,
        solarActive,
      }),
    [gpu, btcSellPrice, prices.gpuCost, tankPriceRub, tankMeta, mgmtLevel, solarActive],
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
          fuelEnabled: true,
          tankPriceRub,
          tankDurationMs: tankMeta.durationMs,
          hideoutMgmtLevel: mgmtLevel,
          solarActive,
        }).netPerDay,
      }));
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
    return { rows, maxAbs };
  }, [slots, gpu, btcSellPrice, prices.gpuCost, tankPriceRub, tankMeta, mgmtLevel, solarActive]);

  // Автономность выбранного числа канистр (сутки) — чистый хелпер (§4.7), N НЕ входит в eco.
  const autonomyDays = useMemo(
    () => fuelAutonomyDays(canisters, tankMeta.durationMs, mgmtLevel, solarActive),
    [canisters, tankMeta, mgmtLevel, solarActive],
  );

  const noData = prices.btcTherapist <= 0;
  const verdict = verdictOf(eco.netPerDay);
  const monthNet = eco.netPerDay * 30;

  // ── Обработчики конфигуратора ──────────────────────────────────────────────
  // Клик по плитке уровня: выбрать уровень; GPU не трогаем, но клампим вниз, если новый потолок < gpu.
  const onSelectLevel = (lvl: number) => {
    setFarmLevelOverride(lvl);
    const cap = slotsForLevel(lvl);
    if (gpu > cap) setGpuOverride(cap);
  };
  // Клик по i-й ячейке грида → gpu = i+1. Если i выходит за потолок текущего уровня — авто-поднять
  // до минимального уровня, чьи слоты вмещают i+1.
  const onSelectGpuSlot = (idx: number) => {
    const count = idx + 1;
    if (count > slots) setFarmLevelOverride(minLevelForGpu(count));
    setGpuOverride(count);
  };
  // Клик по i-й ячейке сетки канистр → N = i+1. Если i за ёмкостью Генератора — авто-поднять
  // уровень Генератора до минимального, чья ёмкость вмещает i+1 (what-if, зеркало GPU-грида).
  const onSelectCanisterSlot = (idx: number) => {
    const count = idx + 1;
    if (count > fuelSlots) setGeneratorOverride(minLevelForGenerator(count));
    setCanisterCount(count);
  };
  // Выбор типа канистры из поповера.
  const onSelectTank = (k: FuelTankKey) => {
    setTankOverride(k);
    setTankMenuOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Заголовок/описание раздела — в SectionHubNav (headerConfig p-hideout-btc), не дублируем. */}

      {/* 1. КОНФИГУРАТОР — 3-колоночный ряд (Figma 3022:1901): 724 / 196 / 128, gap 28. */}
      <section className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-7">
        {/* Колонка 1 — УРОВЕНЬ ФЕРМЫ (724px@1920): плитки-уровни + кликабельный грид GPU.
            Фикс-rem растёт за глобальным пропорциональным root → 965px@2K, 1448px@4K = Figma. */}
        <div className="min-w-0 lg:w-[45.25rem] lg:shrink-0">
          <RuleLabel>Уровень фермы</RuleLabel>
          <div className="mt-3 flex flex-col gap-[1.125rem] sm:flex-row sm:items-center">
            {/* Плитки L1/L2/L3. */}
            <div className="flex h-[10.0625rem] shrink-0 flex-col justify-between">
              {[1, 2, 3].map((lvl) => {
                const isSel = farmLevel === lvl;
                const isBuilt = mounted && profileFarmLevel >= lvl;
                const lvlSlots = BTC_FARM_SLOTS[lvl];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onSelectLevel(lvl)}
                    title={`Биткоин-ферма, уровень ${lvl} — ${lvlSlots} слотов под видеокарты`}
                    className={`group relative flex h-12 w-40 select-none items-center justify-between rounded border px-3.5 transition-colors ${
                      isSel
                        ? 'border-(--primary) bg-(--primary)/10'
                        : 'border-lines-hover bg-card-menu hover:brightness-110'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(FARM_NN)} ${
                          isSel ? 'bg-(--primary)' : 'bg-text-secondary'
                        }`}
                      />
                      <span
                        className={`font-blender-medium text-2xl leading-none tabular-nums ${
                          isSel ? 'text-(--primary)' : 'text-text-secondary'
                        }`}
                      >
                        {String(lvl).padStart(2, '0')}
                      </span>
                      {isBuilt && (
                        <span
                          aria-hidden
                          title="Построен из профиля"
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSel ? 'bg-(--primary)' : 'bg-nvg-green'}`}
                        />
                      )}
                    </span>
                    <span className="flex flex-col items-end leading-none">
                      <span
                        className={`font-blender-medium text-lg leading-none tabular-nums ${
                          isSel ? 'text-(--primary)' : 'text-text-secondary'
                        }`}
                      >
                        {isSel ? `${gpu}/${lvlSlots}` : lvlSlots}
                      </span>
                      <span
                        className={`mt-0.5 font-blender-medium text-type-micro leading-none uppercase tracking-widest ${
                          isSel ? 'text-(--primary)' : 'text-text-muted'
                        }`}
                      >
                        видеокарт
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Грид GPU: 10×5=50 иконок (gpu-icon.svg как маска, 3 состояния). */}
            <div
              className="grid min-w-0 flex-1 gap-x-1.5 gap-y-1.5"
              style={{ gridTemplateColumns: `repeat(${GPU_COLS}, minmax(0, 1fr))` }}
              role="group"
              aria-label="Слоты видеокарт"
            >
              {Array.from({ length: GPU_COLS * GPU_ROWS }, (_, idx) => {
                const installed = idx < gpu; // залито
                const free = idx >= gpu && idx < slots; // свободно в пределах уровня
                const locked = idx >= slots; // заперто (за потолком уровня)
                const maskCls = installed
                  ? 'bg-(--primary)'
                  : free
                    ? 'bg-text-muted'
                    : 'bg-lines-hover/50';
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectGpuSlot(idx)}
                    title={
                      locked
                        ? `Слот ${idx + 1} — поднимет уровень фермы (будет ${idx + 1} ${plGpu(idx + 1)})`
                        : `Будет ${idx + 1} видеокарт`
                    }
                    aria-label={`Слот видеокарты ${idx + 1}`}
                    className="group flex aspect-[42/26] items-center justify-center rounded-xs transition-colors hover:bg-white/5"
                  >
                    <span
                      aria-hidden
                      className={`icon-mask h-[1.3125rem] w-[2.625rem] max-w-full transition-colors group-hover:bg-(--primary)/70 ${maskCls}`}
                      style={{ maskImage: GPU_MASK, WebkitMaskImage: GPU_MASK }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Колонка 2 — УБЕЖИЩЕ ЧВК (196px): навык УУ + учёт топлива. */}
        <div className="min-w-0 lg:w-[12.25rem] lg:shrink-0">
          <RuleLabel>Убежище ЧВК</RuleLabel>
          {/* Навык «Управление убежищем» + степперы — одна строка (как в Figma):
              иконка + подпись в 2 строки (принуд. перенос) слева, [− NN +] справа. */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {SKILL_ICONS.HideoutManagement && (
                <img
                  src={SKILL_ICONS.HideoutManagement.src}
                  alt=""
                  loading="lazy"
                  className="h-9 w-9 shrink-0 rounded-[0.1875rem] border border-lines-hover object-contain"
                />
              )}
              <span className="min-w-0 font-blender-medium text-type-micro uppercase leading-tight tracking-widest text-text-secondary">
                Управление
                <br />
                убежищем
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Stepper
                dir="down"
                disabled={mgmtLevel <= 0}
                onClick={() => setMgmtOverride(clamp(mgmtLevel - 1, 0, 51))}
              />
              <span className="w-7 text-center font-blender-medium text-2xl leading-none tabular-nums text-text-primary">
                {mounted ? mgmtLevel : '—'}
              </span>
              <Stepper
                dir="up"
                disabled={mgmtLevel >= 51}
                onClick={() => setMgmtOverride(clamp(mgmtLevel + 1, 0, 51))}
              />
            </div>
          </div>
          <p className="mt-1.5 text-center font-blender-book text-type-caption leading-tight text-text-muted">
            Режет расход топлива
            <br />
            (−25% на 50 уровне).
          </p>

          {/* Учёт топлива — Solar-тумблер + дропдаун ТИПА канистры + сетка КОЛИЧЕСТВА (зеркало GPU-грида). */}
          <div className="mt-4">
            <RuleLabel>Учёт топлива</RuleLabel>
            <div className="mt-3 flex flex-wrap items-start gap-3.5">
              {/* Тумблер Solar Power (первым) — ×2 длительность бака. */}
              <FuelCell
                active={solarActive}
                available
                onClick={() => setSolarOverride(!solarActive)}
                title={`Solar Power — удваивает время работы бака${solarActive ? ' (включено)' : ''}`}
              >
                <span
                  aria-hidden
                  className={`h-6 w-6 icon-mask ${stationIconClass(SOLAR_NN)} ${
                    solarActive ? 'bg-(--primary)' : 'bg-text-muted'
                  }`}
                />
              </FuelCell>

              {/* Дропдаун ТИПА канистры (node 3058-2875): триггер = выбранная канистра + бейдж кол-ва. */}
              <div ref={tankMenuRef} className="relative">
                <FuelCell
                  active={tankMenuOpen}
                  available={tankAvailable}
                  onClick={() => setTankMenuOpen((v) => !v)}
                  title={`Тип канистры: ${tankMeta.label}${tankAvailable ? '' : ' — цена по воронке недоступна'}`}
                  bgColor={getTarkovBackgroundColor('yellow')}
                  badge={mounted ? `x${canisters}` : undefined}
                >
                  <img
                    src={itemIconUrl(FUEL_ITEM_ID[tank])}
                    alt={tankMeta.label}
                    loading="lazy"
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain p-1.5"
                  />
                </FuelCell>
                {tankMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Тип канистры"
                    className="absolute left-0 top-full z-20 mt-1.5 flex gap-1.5 rounded border border-lines-hover bg-card-menu p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
                  >
                    {(Object.keys(FUEL_TANKS) as FuelTankKey[]).map((k) => {
                      const available = prices.fuelFunnel[k].perUnit > 0;
                      const active = tank === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="option"
                          aria-selected={active}
                          disabled={!available}
                          onClick={() => onSelectTank(k)}
                          title={`${FUEL_TANKS[k].label}${available ? '' : ' — цена по воронке недоступна'}`}
                          className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border transition-colors ${
                            active ? 'border-(--primary) bg-(--primary)/10' : 'border-lines-hover bg-card-menu'
                          } ${available ? 'hover:brightness-110' : 'opacity-25'}`}
                        >
                          <span
                            aria-hidden
                            className="absolute inset-0"
                            style={{ backgroundColor: getTarkovBackgroundColor('yellow') }}
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 shadow-[inset_0_-2.33px_11.67px_5.83px_rgba(0,0,0,0.7)]"
                          />
                          <img
                            src={itemIconUrl(FUEL_ITEM_ID[k])}
                            alt={FUEL_TANKS[k].label}
                            loading="lazy"
                            className="pointer-events-none absolute inset-0 h-full w-full object-contain p-1.5"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Сетка КОЛИЧЕСТВА (node 3054-933): 6 ячеек 2×3 (фрейм 26×16, gap 4px = квадрат 56×56),
                  full-tank-icon.svg, 3 состояния по цвету. */}
              <div
                className="grid h-14 w-14 grid-cols-2 grid-rows-3 gap-1"
                role="group"
                aria-label="Число канистр"
              >
                {Array.from({ length: FUEL_GRID_MAX }, (_, idx) => {
                  const installed = idx < canisters; // выбрано
                  const free = idx >= canisters && idx < fuelSlots; // свободно в пределах Генератора
                  const locked = idx >= fuelSlots; // за ёмкостью Генератора
                  const maskCls = installed
                    ? 'bg-(--primary)'
                    : free
                      ? 'bg-text-muted'
                      : 'bg-lines-hover/50';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectCanisterSlot(idx)}
                      title={
                        locked
                          ? `Слот ${idx + 1} — поднимет уровень Генератора (будет ${idx + 1} ${plCanister(idx + 1)})`
                          : `Будет ${idx + 1} ${plCanister(idx + 1)}`
                      }
                      aria-label={`Слот канистры ${idx + 1}`}
                      className="group flex h-full w-full items-center justify-center rounded-xs transition-colors hover:bg-white/5"
                    >
                      <span
                        aria-hidden
                        className={`icon-mask h-full w-full transition-colors group-hover:bg-(--primary)/70 ${maskCls}`}
                        style={{
                          maskImage: FUEL_MASK,
                          WebkitMaskImage: FUEL_MASK,
                          maskSize: 'contain',
                          WebkitMaskSize: 'contain',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Колонка 3 — ПРОДАЖА BITCOIN (128px): карточка Bitcoin + Терапевт + цена. */}
        <div className="min-w-0 lg:w-[8rem] lg:shrink-0">
          <RuleLabel>Продажа Bitcoin</RuleLabel>
          <div
            className="relative mt-3 flex h-32 w-32 items-center justify-center overflow-hidden rounded border border-(--color-base) shadow-[inset_0_-2.33px_11.67px_5.83px_rgba(0,0,0,0.7)]"
            style={{ backgroundColor: getTarkovBackgroundColor('violet') }}
          >
            <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/6 to-transparent" />
            <img
              src={itemIconUrl(BTC_ITEM_ID)}
              alt="Physical Bitcoin"
              loading="lazy"
              className="pointer-events-none relative h-full w-full object-contain p-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <img
              src={traderImg('therapist')}
              alt="Терапевт"
              loading="lazy"
              className="h-7 w-7 shrink-0 rounded-[0.14581rem] object-cover"
            />
            <span className="font-blender-medium text-lg tabular-nums text-text-primary">
              {fmt(prices.btcTherapist)} ₽
            </span>
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
          <section className="grid gap-4 lg:grid-cols-2">
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
                чистыми в сутки · {gpu} {plGpu(gpu)} · ферма, уровень {farmLevel}
              </span>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-blender-book text-type-caption text-text-secondary">
                <span>
                  Окупаемость видеокарт:{' '}
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
              <div className="flex flex-col gap-2.5">
                {scale.rows.map((row) => {
                  const isCurrent = row.gpu === gpu;
                  const pct = Math.round((Math.abs(row.net) / scale.maxAbs) * 100);
                  const rv = verdictOf(row.net);
                  return (
                    <div key={row.gpu} className="flex items-center gap-3">
                      <span
                        className={`w-24 shrink-0 text-right font-blender-medium text-type-caption tabular-nums ${
                          isCurrent ? 'text-(--primary)' : 'text-text-muted'
                        }`}
                      >
                        {row.gpu} {plGpu(row.gpu)}
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

          {/* 4. Метрики — иконки из набора + цветовая семантика (прибыль зелёная / убыток красный). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Добыча BTC / сутки"
              value={`${eco.coinsPerDay.toFixed(2)} BTC`}
              subtext={`${(eco.coinsPerDay * 30).toFixed(1)} BTC / месяц`}
              icon={<MaskIcon mask={IC_MINE} className="h-5 w-5 bg-(--primary)" />}
            />
            <Metric
              label="Время на 1 BTC"
              value={fmtHms(eco.secPerCoin)}
              subtext={`при ${gpu} ${gpu === 1 ? 'видеокарте' : 'видеокартах'}`}
              icon={<MaskIcon mask={IC_TIME} className="h-4 w-4 bg-text-muted" />}
            />
            <Metric
              label="Доход / сутки"
              value={`${fmt(eco.grossPerDay)} ₽`}
              subtext={`продажа ${fmt(btcSellPrice)} ₽ / BTC`}
              icon={<MaskIcon mask={IC_TIME} className="h-4 w-4 bg-text-muted" />}
            />
            <Metric
              label="Топливо / сутки"
              value={eco.fuelPerDay > 0 ? `−${fmt(eco.fuelPerDay)} ₽` : '—'}
              subtext={`${FUEL_BUY[tank].name}${solarActive ? ' · Solar ×2' : ''} · УУ ${mgmtLevel}`}
              subtextClass="text-type-micro uppercase leading-tight tracking-wide"
              tone={eco.fuelPerDay > 0 ? 'cost' : 'default'}
              icon={<MaskIcon mask={IC_FUEL} className={`h-5 w-5 ${eco.fuelPerDay > 0 ? 'bg-tactical-amber' : 'bg-text-muted'}`} />}
            />
            <Metric
              label="Чистая прибыль / сутки"
              value={`${fmtSigned(eco.netPerDay)} ₽`}
              subtext="доход − топливо"
              tone={gainLoss(eco.netPerDay)}
              icon={<MaskIcon mask={IC_PROFIT} className={`h-5 w-5 ${eco.netPerDay >= 0 ? 'bg-success' : 'bg-danger'}`} />}
            />
            <Metric
              label="Окупаемость видеокарт"
              value={Number.isFinite(eco.paybackDays) ? `${eco.paybackDays} дн` : '—'}
              subtext={`вложено ${fmt(eco.gpuInvest)} ₽`}
              icon={<MaskIcon mask={GPU_MASK} className="h-4 w-8 bg-text-secondary" />}
            />
            <Metric
              label="Прибыль с 1 видеокарты"
              value={`${fmtSigned(eco.netPerGpu)} ₽`}
              subtext="в сутки"
              tone={gainLoss(eco.netPerGpu)}
              icon={<MaskIcon mask={GPU_MASK} className={`h-4 w-8 ${eco.netPerGpu >= 0 ? 'bg-success' : 'bg-danger'}`} />}
            />
            <Metric
              label="Профит / месяц"
              value={`${fmtSigned(monthNet)} ₽`}
              subtext="чистыми за 30 дней"
              tone={gainLoss(monthNet)}
              icon={<MaskIcon mask={IC_PROFIT} className={`h-5 w-5 ${monthNet >= 0 ? 'bg-success' : 'bg-danger'}`} />}
            />
          </div>
        </>
      )}

      {/* 5. Что нужно купить (design-to-code Figma 3026:3372): карточка GPU + бак + сноска. */}
      <section className="flex flex-col gap-3.5">
        <RuleLabel>Что нужно купить</RuleLabel>
        <div className="flex flex-wrap items-start gap-7">
          {/* Видеокарты — покупка на барахолке (node 3054-1320): без строки-источника,
              монета-рубль слева от итога. */}
          <BuyCard
            iconUrl={itemIconUrl(GPU_ITEM_ID)}
            cellBg={GPU_CELL_BG}
            slug={GPU_SLUG}
            name="Видеокарта"
            sub="GPU"
            count={gpu}
            total={eco.gpuInvest}
            perUnit={`х${gpu} по ${fmt(prices.gpuCost)}`}
            totalIcon={
              <span
                aria-hidden
                className="icon-mask h-4 w-4 shrink-0 bg-(--primary)"
                style={{ maskImage: RUBLE_MASK, WebkitMaskImage: RUBLE_MASK }}
              />
            }
          />
          {/* Топливный бак — цена по воронке (perUnit), число = выбранное N канистр, источник из path.
              Автономность (~M дней) — строкой под карточкой; N не влияет на ₽/сут и профит. */}
          {tankPriceRub > 0 && fuelPath && (
            <div className="flex w-full flex-col gap-1.5 sm:w-87">
              <BuyCard
                iconUrl={itemIconUrl(FUEL_ITEM_ID[tank])}
                cellBg={FUEL_CELL_BG}
                slug={FUEL_BUY[tank].slug}
                name={FUEL_BUY[tank].name}
                sub="топливо"
                count={canisters}
                perUnit={`х${canisters} по ${fmt(tankPriceRub)}`}
                total={canisters * tankPriceRub}
                totalIcon={<SourceIcon node={fuelPath} />}
              />
              <p className="font-blender-book text-type-caption leading-tight text-text-muted">
                {autonomyDays < 1
                  ? 'Хватит меньше суток'
                  : `Хватит на ~${Math.round(autonomyDays)} ${plDay(Math.round(autonomyDays))}`}
                {solarActive ? ' (с Solar ×2)' : ''}.
              </p>
            </div>
          )}
          <p className="w-full font-blender-book text-type-caption leading-tight text-text-muted sm:w-87">
            Ферма копит максимум 3 биткоина и встаёт, пока не заберёшь — не забывай снимать (с элитой
            «Управление убежищем» влезает 5). Цена биткоина в игре скачет и обновляется каждую ночь —
            тут показана свежая на данный момент.
          </p>
        </div>
      </section>
    </div>
  );
}

/** Метка-заголовок блока с линией (rule-micro-labels). */
function RuleLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted ${className}`}>
      {children}
      <span aria-hidden className="h-px flex-1 bg-lines-hover" />
    </h3>
  );
}

/** Кнопка-степпер ± (16px, bg-lines-hover). */
function Stepper({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'up' ? 'Увеличить уровень' : 'Уменьшить уровень'}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-xs bg-lines-hover text-text-secondary transition-colors hover:bg-(--primary) hover:text-(--color-base) disabled:opacity-40 disabled:hover:bg-lines-hover disabled:hover:text-text-secondary"
    >
      {dir === 'up' ? <Plus className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}
    </button>
  );
}

/**
 * Ячейка учёта топлива 56×56 (EFT item-cell): рамка по активности; недоступный — тусклый.
 * `badge` (напр. «x4») — счётчик канистр в правом-нижнем углу: амбер (bg-primary, чёрный текст)
 * у активной, чёрный фон у неактивной. Solar-тумблер вызывается без badge (индикатор не нужен).
 */
function FuelCell({
  active,
  available,
  onClick,
  title,
  bgColor,
  badge,
  children,
}: {
  active: boolean;
  available: boolean;
  onClick: () => void;
  title: string;
  bgColor?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!available}
      title={title}
      aria-pressed={active}
      className={`relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border transition-colors ${
        active ? 'border-(--primary) bg-(--primary)/10' : 'border-lines-hover bg-card-menu'
      } ${available ? 'hover:brightness-110' : 'opacity-25'}`}
    >
      {bgColor && (
        <span aria-hidden className="absolute inset-0" style={{ backgroundColor: bgColor }} />
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_-2.33px_11.67px_5.83px_rgba(0,0,0,0.7)]" />
      {children}
      {badge !== undefined && (
        <span
          aria-hidden
          className={`absolute bottom-0 right-0 z-10 flex h-3 items-center justify-center rounded-br rounded-tl-xs px-1 font-blender-medium text-type-micro leading-none tabular-nums ${
            active ? 'bg-(--primary) text-(--color-base)' : 'bg-(--color-base) text-text-primary'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** Иконка-маска (перекрашивается через bg-*). */
function MaskIcon({ mask, className }: { mask: string; className: string }) {
  return (
    <span aria-hidden className={`icon-mask shrink-0 ${className}`} style={{ maskImage: mask, WebkitMaskImage: mask }} />
  );
}

/** Цветовая семантика значения метрики. */
const METRIC_TONE = {
  default: 'text-text-primary',
  primary: 'text-(--primary)',
  gain: 'text-success', // #8DE736 — прибыль
  loss: 'text-danger', // убыток
  cost: 'text-tactical-amber', // расход
} as const;
type MetricTone = keyof typeof METRIC_TONE;
const gainLoss = (n: number): MetricTone => (n > 0 ? 'gain' : n < 0 ? 'loss' : 'default');

/** Карточка метрики: лейбл + иконка (справа сверху) + значение с цветовой семантикой + подпись. */
function Metric({
  label,
  value,
  subtext,
  subtextClass,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  subtext?: string;
  subtextClass?: string;
  icon?: React.ReactNode;
  tone?: MetricTone;
}) {
  return (
    <div className="relative flex flex-col justify-between rounded-md border border-lines-hover bg-card-menu/40 p-3">
      {icon && <span className="absolute right-3 top-3 flex">{icon}</span>}
      <div className="mb-1 pr-8 text-type-caption uppercase leading-tight tracking-widest text-text-muted">{label}</div>
      <div className={`font-blender-medium text-lg tracking-tight ${METRIC_TONE[tone]}`}>{value}</div>
      {subtext && (
        <div className={`mt-1 font-blender-book text-text-secondary ${subtextClass ?? 'text-type-caption'}`}>{subtext}</div>
      )}
    </div>
  );
}

/**
 * Карточка «что нужно купить» (Figma 3026:3372): слева EFT item-ячейка 56px (рарити-фон + иконка +
 * опц. бейдж кол-ва) и имя/подпись; справа источник покупки, опц. цена за штуку и крупный итог.
 */
function BuyCard({
  iconUrl,
  cellBg,
  slug,
  name,
  sub,
  total,
  count,
  perUnit,
  totalIcon,
}: {
  iconUrl: string;
  cellBg: string;
  slug: string;
  name: string;
  sub: string;
  total: number;
  count?: number;
  perUnit?: string;
  /** Иконка типа источника перед общей суммой (node 3054-1320): рубль / бартер / торговец / крафт. */
  totalIcon?: React.ReactNode;
}) {
  return (
    <div className="flex w-full items-end justify-between gap-3 rounded-lg border border-lines-hover bg-card-menu p-3.5 sm:w-87">
      {/* Иконка + название — прямой переход на карточку предмета. */}
      <Link href={`/eft/items/item/${slug}`} title={`${name} — открыть карточку`} className="group flex min-w-0 items-center gap-3.5">
        <div className="relative size-14 shrink-0 overflow-hidden rounded border border-(--color-base) transition-[border-color] group-hover:border-(--primary)">
          <span aria-hidden className="absolute inset-0 rounded" style={{ backgroundImage: cellBg }} />
          <img src={iconUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-contain p-2" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded shadow-[inset_0_-2.33px_11.67px_5.83px_rgba(0,0,0,0.7)]"
          />
          {count !== undefined && (
            <span className="absolute bottom-0 right-0 rounded-tl-xs rounded-br bg-(--color-base) px-1 font-blender-medium text-type-micro text-text-primary tabular-nums">
              x{count}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1 uppercase leading-tight">
          <span className="font-blender-medium text-type-caption text-text-primary transition-colors group-hover:text-(--primary)">
            {name}
          </span>
          <span className="font-blender-medium text-type-micro text-text-secondary">{sub}</span>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {perUnit && (
          <span className="font-blender-medium text-xs text-text-secondary tabular-nums">{perUnit} ₽</span>
        )}
        <span className="flex items-center gap-2 font-blender-medium text-2xl leading-none text-text-primary tabular-nums">
          {totalIcon}
          {fmt(total)} ₽
        </span>
      </div>
    </div>
  );
}
