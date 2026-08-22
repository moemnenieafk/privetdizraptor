'use client';

// Карточка рецепта крафта — 4 состояния + трекинг производства (спека craft-production-tracker).
// Эталон — Figma-нода 2990-584 (Заблокировано · В производство · Производится · Готово) + «занята».
// Самодостаточна по пропсам (в страницу вшивает T7): чистый ввод — ProcessedCraft + разрешённые
// уровни навыков/убежища; «в схроне» и активное производство читает сама из сторов (mounted-гард).
// Доменная математика — computeCraftEconomy (T2) + хелперы таймера стора; в JSX только форматирование.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, Paperclip, Percent, ShoppingCart } from 'lucide-react';
import { TrackCell } from '@/components/ui/kit';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { itemIconUrl } from '@/lib/item-icon';
import { traderImg } from '@/lib/trader-utils';
import { TRADER_COLORS } from '@/data/traderColors';
import { useInventoryStore } from '@/store/useInventoryStore';
import {
  useCraftProductionStore,
  remainingSec,
  productionStatus,
} from '@/store/useCraftProductionStore';
import { useCraftPinStore } from '@/store/useCraftPinStore';
import { computeCraftEconomy } from '@/lib/craft-profit';
import { stationIconClass } from '@/components/features/hideout/HideoutBuildTracker';
import { RequirementChip } from '@/components/features/hideout/RequirementChip';
import type { ProcessedCraft, CraftInput } from '@/app/eft/progress/hideout/craft-profit/CraftProfitClient';

export interface RecipeCardProps {
  /** Рецепт из ридера страницы (CraftProfitClient). */
  craft: ProcessedCraft;
  /** Построенный уровень станции с учётом издания (родитель: useHideoutStore + editionFloor). */
  builtStationLevel: number;
  /** Навык «Ручное производство» — режет время. */
  craftingLevel: number;
  /** Навык «Управление убежищем» — усиливает скидку налога через Разведцентр. */
  hideoutMgmtLevel: number;
  /** Разведцентр ур.3+ построен — включает скидку налога барахолки. */
  intelCenterBuilt: boolean;
  /** Глобальный тумблер «Пустой бак»: топливные входы по 10% от продажи трейдеру. */
  emptyFuel: boolean;
  /** Квест-анлок пройден (резолв клиента). Чип рисуется по наличию `craft.taskUnlock`. */
  questDone: boolean;
  /** Издание, дающее крафт, есть (резолв клиента). Чип — по наличию `craft.gameEditions`. */
  editionOwned: boolean;
}

// Коды изданий tarkov.dev → короткий рус-лейбл чипа. Несколько кодов / неизвестный → «Издание».
const EDITION_LABEL: Record<string, string> = {
  edge_of_darkness: 'EOD',
  unheard_edition: 'Unheard',
  eod_tue_edition: 'EOD / Unheard',
  left_behind: 'Left Behind',
  prepare_for_escape: 'Prepare for Escape',
  prepare_to_escape: 'Prepare for Escape',
  standard: 'Standard',
};

/** Лейбл чипа издания: один известный код → его имя; иначе нейтральное «Издание». */
function editionLabel(codes: string[] | undefined): string {
  if (codes?.length === 1) return EDITION_LABEL[codes[0]] ?? 'Издание';
  return 'Издание';
}

/** Полный ₽: «177 362 ₽», знак «−»/«+» опционален. Пробел-разделитель тысяч (ru-RU). */
function fmtRubFull(n: number, opts?: { sign?: boolean }): string {
  const rounded = Math.round(n);
  const grouped = Math.abs(rounded).toLocaleString('ru-RU').replace(/ /g, ' ');
  const sign = rounded < 0 ? '−' : opts?.sign ? '+' : '';
  return `${sign}${grouped} ₽`;
}

/** Длительность «02 ч 24 мин» / «45 мин» (ведущий ноль часов, как в макете). */
function fmtDurLong(sec: number): string {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${String(h).padStart(2, '0')} ч ${String(m).padStart(2, '0')} мин`;
  return `${m} мин`;
}

/** Разбор остатка секунд на группы таймера с ведущими нулями (дни:часы:минуты:секунды). */
function timerParts(totalSec: number): { d: string; h: string; m: string; s: string } {
  const t = Math.max(0, Math.floor(totalSec));
  const d = Math.floor(t / 86_400);
  const h = Math.floor((t % 86_400) / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return {
    d: String(d).padStart(2, '0'),
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
  };
}

/** Освобождение станции «ЧЧ:ММ» из остатка секунд — для тултипа «СТАНЦИЯ ЗАНЯТА». */
function fmtHhMm(sec: number): string {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Стоимость строки входа с учётом «пустого бака»: топливо → sellTrader·0.1, иначе cash-закупка. */
function inputLineCost(r: CraftInput, emptyFuel: boolean): number {
  const unit = emptyFuel && r.isFuel ? r.sellTrader * 0.1 : r.unitBuy;
  return Math.round(unit * r.count);
}

/** Цвет ₽/час по величине (нейтральный→зелёный градиент). */
function pphColor(pph: number): string {
  if (pph > 20_000) return 'text-nvg-green';
  if (pph > 5_000) return 'text-nvg-green';
  if (pph > 0) return 'text-text-secondary';
  return 'text-text-muted';
}

// Акцент «крафта» — семантика цвета блока «Производство» (CraftOfferCard): фон-градиент +
// обводка со свечением на карточке, когда крафт МОЖНО запустить (состояние can-craft).
// Литерал (не var(--…)): @theme-переменные Tailwind вырезает, color-mix в рантайме отдаёт
// пустоту — тот же приём, что в BarterOfferCard/QuestNode.
const CRAFT_ACCENT = '#9A8866';
function craftAccentStyle(): React.CSSProperties {
  return {
    borderColor: CRAFT_ACCENT,
    boxShadow: `0 0 12px color-mix(in srgb, ${CRAFT_ACCENT} 30%, transparent)`,
    background: [
      `radial-gradient(ellipse 50% 100% at 100% 100%, color-mix(in srgb, ${CRAFT_ACCENT} 14%, transparent), transparent 72%)`,
      `radial-gradient(ellipse 50% 100% at 0% 0%, color-mix(in srgb, ${CRAFT_ACCENT} 28%, transparent), transparent 72%)`,
      '#000000',
    ].join(', '),
  };
}

/** Состояние карточки — приоритет по спеке §1. */
type CardState = 'locked' | 'can-craft' | 'busy' | 'producing' | 'done';

/** Ряд-разделитель с центральным лейблом (ВХОД / ВЫРУЧКА). */
function DividerLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="h-px flex-1 bg-lines-hover" />
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-lines-hover" />
    </div>
  );
}

/** Одна строка метрики: иконка + лейбл слева, значение + цвет справа. */
function MetricRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex h-4 items-center justify-between">
      <span className="flex items-center gap-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
        {icon}
        {label}
      </span>
      <span className={`font-blender-medium text-type-caption tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * Чип квеста-анлока в стиле квест-нод «Важных предметов» (SourceChip): цвет торговца, его
 * квадрат-аватар, имя квеста + «УР. N+». Пройден → зелёная галочка. Оборачивается в ссылку на карту.
 */
function QuestNodeChip({
  name,
  traderNn,
  minLevel,
  done,
}: {
  name: string;
  traderNn?: string;
  minLevel?: number;
  done: boolean;
}) {
  const color = TRADER_COLORS[traderNn ?? ''] ?? TRADER_COLORS.stories;
  return (
    <span
      className="flex w-full items-center gap-2 rounded-sm border p-1.5"
      style={{
        borderColor: color,
        background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${color} 38%, transparent), #000000)`,
      }}
    >
      {traderNn && (
        <img src={traderImg(traderNn)} alt="" loading="lazy" className="h-7 w-7 shrink-0 rounded-xs object-cover" />
      )}
      <span className="min-w-0 flex-1 truncate font-blender-medium text-type-micro uppercase tracking-wide text-text-primary">
        {name}
      </span>
      {done && <Check className="h-4 w-4 shrink-0 text-nvg-green" strokeWidth={3} aria-hidden />}
      {minLevel != null && minLevel > 0 && (
        <span className="shrink-0 font-blender-medium text-type-caption tabular-nums" style={{ color }}>
          Ур. {minLevel}+
        </span>
      )}
    </span>
  );
}

export function RecipeCard({
  craft,
  builtStationLevel,
  craftingLevel,
  hideoutMgmtLevel,
  intelCenterBuilt,
  emptyFuel,
  questDone,
  editionOwned,
}: RecipeCardProps) {
  // mounted-гард: «в схроне» и производство — persist-сторы (localStorage), читаем на клиенте.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const stashCount = (id: string) => (mounted ? (ownedItems[id] ?? 0) : 0);

  const active = useCraftProductionStore((s) => s.active);
  const start = useCraftProductionStore((s) => s.start);
  const cancel = useCraftProductionStore((s) => s.cancel);
  const collect = useCraftProductionStore((s) => s.collect);
  const pinnedIds = useCraftPinStore((s) => s.pinned);
  const togglePin = useCraftPinStore((s) => s.toggle);

  const reward = craft.reward[0];
  const stationKey = craft.stationNormalized;
  const entry = mounted ? active[stationKey] : undefined;

  // Экономика крафта — чистый хелпер T2 (§4.7). Числовая математика вне JSX.
  const eco = useMemo(() => {
    return computeCraftEconomy({
      inputs: craft.required.map((r) => ({
        unitBuy: r.unitBuy,
        count: r.count,
        isFuel: r.isFuel,
        sellTrader: r.sellTrader,
        isTool: r.isTool,
      })),
      output: {
        basePrice: reward?.basePrice ?? 0,
        bestTraderSell: reward?.bestTraderSell ?? 0,
        fleaPrice: reward?.fleaPrice ?? 0,
        count: reward?.count ?? 1,
        buyBest: reward?.buyBest ?? 0,
      },
      baseDurationSec: craft.duration,
      craftingLevel,
      hideoutMgmtLevel,
      intelCenterBuilt,
      emptyFuel,
    });
  }, [craft, reward, craftingLevel, hideoutMgmtLevel, intelCenterBuilt, emptyFuel]);

  const stationMet = builtStationLevel >= craft.level;
  const questGated = Boolean(craft.taskUnlock);
  const editionGated = Boolean(craft.gameEditions?.length);
  const available = stationMet && (!questGated || questDone) && (!editionGated || editionOwned);

  // Живой тик — только когда станция что-то производит (наш крафт ИЛИ сестринский занят).
  const isOwnActive = Boolean(entry && entry.craftId === craft.id);
  const isSiblingBusy = Boolean(entry && entry.craftId !== craft.id);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!entry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [entry]);

  // Разрешение состояния (приоритет §1): наш крафт → producing/done; сестра → busy; иначе доступность.
  const state: CardState = isOwnActive
    ? productionStatus(entry!, now)
    : isSiblingBusy
      ? 'busy'
      : available
        ? 'can-craft'
        : 'locked';

  const ownRemaining = isOwnActive ? remainingSec(entry!, now) : 0;
  const siblingRemaining = isSiblingBusy ? remainingSec(entry!, now) : 0;

  // Скрепка: закрепить/открепить крафт (показывается секцией «Закреплённые» сверху страницы).
  const isPinned = mounted && pinnedIds.includes(craft.id);
  const onClip = () => togglePin(craft.id);

  const onStart = () => {
    start(stationKey, {
      craftId: craft.id,
      durationSec: eco.effDurationSec,
      label: reward?.item.shortName ?? craft.stationName,
      stationName: craft.stationName,
    });
  };

  const rewardBg = getTarkovBackgroundColor(reward?.item.backgroundColor);
  const isTimerState = state === 'producing' || state === 'done';
  const isDone = state === 'done';

  // Обводка/акцент карточки: готово → зелёная рамка+свечение; иначе базовая линия.
  const cardBorder = isDone
    ? 'border-nvg-green shadow-[0_0_0_1px_var(--color-nvg-green),0_0_18px_-6px_var(--color-nvg-green)]'
    : 'border-lines-hover';
  const cardDim = state === 'producing' ? 'opacity-60' : '';
  // Можно запустить крафт → перекрашиваем карточку в акцент «крафта» (фон+обводка).
  const isCanCraft = state === 'can-craft';

  const timer = timerParts(ownRemaining);

  return (
    <article
      className={`flex flex-col gap-2 rounded-lg border p-4 ${cardDim} ${isCanCraft ? '' : `bg-card-menu ${cardBorder}`}`}
      style={isCanCraft ? craftAccentStyle() : undefined}
    >
      {/* 1. Шапка: иконка станции + имя · справа «02» + (locked) «ТРЕБУЕТСЯ ПОСТРОИТЬ NN» + молоток */}
      <header className="flex h-7 items-center gap-2">
        {stationKey && (
          <span
            aria-hidden
            className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(stationKey)} ${isDone ? 'bg-nvg-green' : state === 'locked' ? 'bg-tactical-amber' : isCanCraft ? '' : 'bg-text-secondary'}`}
            style={isCanCraft ? { backgroundColor: CRAFT_ACCENT } : undefined}
          />
        )}
        <span
          className={`min-w-0 flex-1 truncate font-blender-medium text-type-caption uppercase tracking-widest ${isDone ? 'text-nvg-green' : state === 'locked' ? 'text-tactical-amber' : isCanCraft ? '' : 'text-text-secondary'}`}
          style={isCanCraft ? { color: CRAFT_ACCENT } : undefined}
        >
          {craft.stationName}
        </span>

        {state === 'locked' && (
          <span className="flex shrink-0 items-center gap-1.5 font-blender-medium text-type-caption uppercase leading-none tracking-widest text-tactical-amber">
            Дострой
            <span className="text-base tabular-nums">{String(craft.level).padStart(2, '0')}</span>
            <span
              aria-hidden
              className="h-4 w-4 shrink-0 bg-tactical-amber"
              style={{
                maskImage: 'url(/icons/eft/04-progression/hideout-modules/hideout-build-icon.svg)',
                WebkitMaskImage: 'url(/icons/eft/04-progression/hideout-modules/hideout-build-icon.svg)',
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
              }}
            />
          </span>
        )}

        {/* Индикатор уровня справа — во всех стейтах КРОМЕ locked (там уровень уже в «требуется построить NN»). */}
        {state !== 'locked' && (
          <span
            className={`shrink-0 font-blender-medium text-xl tabular-nums ${isDone ? 'text-nvg-green' : isCanCraft ? '' : 'text-text-secondary'}`}
            style={isCanCraft ? { color: CRAFT_ACCENT } : undefined}
          >
            {String(craft.level).padStart(2, '0')}
          </span>
        )}
      </header>

      {/* 2. Герой — предмет-ВЫХОД (компакт): ячейка ×N + shortName + строка «ПРОДАЖА <flea> ₽» */}
      {reward && (
        <div className="flex h-14 items-center gap-3">
          <TrackCell
            iconSrc={reward.item.image512pxLink ?? itemIconUrl(reward.item.id)}
            alt={reward.item.name}
            have={0}
            need={0}
            onInc={() => {}}
            sizeClass="h-14 w-14"
            bgColor={rewardBg}
            noFill
            badge={`×${reward.count}`}
          />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            {reward.item.slug ? (
              <Link
                href={`/eft/items/item/${reward.item.slug}`}
                className="line-clamp-1 font-blender-medium text-type-caption uppercase tracking-wide text-text-primary transition-colors hover:text-(--primary)"
              >
                {reward.item.shortName}
              </Link>
            ) : (
              <span className="line-clamp-1 font-blender-medium text-type-caption uppercase tracking-wide text-text-primary">
                {reward.item.shortName}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="h-4 w-4 shrink-0 icon-mask icon-eft-currency-ruble bg-tactical-amber" />
              <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">Продажа</span>
              <span className="ml-auto font-blender-medium text-type-caption tabular-nums text-text-primary">
                {fmtRubFull(reward.fleaPrice)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ветвление: таймер-состояния заменяют входы+метрики обратным отсчётом; иначе — полный блок. */}
      {isTimerState ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
          <div className="flex items-end gap-1.5">
            {[
              { v: timer.d, l: 'дней' },
              { v: timer.h, l: 'часов' },
              { v: timer.m, l: 'минут' },
              { v: timer.s, l: 'секунд' },
            ].map((g, i) => (
              <div key={g.l} className="flex items-end gap-1.5">
                {i > 0 && <span className={`pb-4 text-2xl leading-none ${isDone ? 'text-nvg-green' : 'text-text-muted'}`}>:</span>}
                <div className="flex flex-col items-center gap-1">
                  <span className={`text-2xl font-blender-medium leading-none tabular-nums ${isDone ? 'text-nvg-green' : 'text-text-secondary'}`}>
                    {g.v}
                  </span>
                  <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">{g.l}</span>
                </div>
              </div>
            ))}
          </div>
          {isDone ? (
            <span className="font-blender-medium text-type-caption uppercase tracking-widest text-nvg-green">
              Производство завершено
            </span>
          ) : (
            <button
              type="button"
              onClick={() => cancel(stationKey)}
              className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary"
            >
              отменить крафт
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 3. Входы: лейбл-линия «ВХОД» → ряд ячеек (0/N read-only) + цена под каждой */}
          {craft.required.length > 0 && (
            <>
              <DividerLabel label="Вход" />
              <div className="flex flex-wrap justify-center gap-3">
                {craft.required.map((r, i) => (
                  <div key={`${r.item.id}-${i}`} className="flex flex-col items-center gap-1">
                    <TrackCell
                      iconSrc={r.item.image512pxLink ?? itemIconUrl(r.item.id)}
                      alt={r.item.name}
                      have={stashCount(r.item.id)}
                      need={r.count}
                      bgColor={getTarkovBackgroundColor(r.item.backgroundColor)}
                      onInc={() => {}}
                      sizeClass="h-12 w-12"
                    />
                    <span className="font-blender-medium text-type-micro tabular-nums text-text-secondary">
                      {fmtRubFull(inputLineCost(r, emptyFuel))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 4. Требования КРАФТА: квест/издание/квест-предметы. Станцию НЕ дублируем — она в шапке
              («требуется построить NN» / уровень). Ряд рисуем только если есть что показать. */}
          {(questGated || editionGated || (craft.requiredQuestItems?.length ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {questGated && (
              <Link
                href={`/eft/questmap?quest=${craft.taskUnlock}`}
                title={questDone ? 'Квест пройден — открыть на карте квестов' : 'Требуется пройти квест — открыть на карте квестов'}
                className="block w-full rounded-sm transition-opacity hover:opacity-80"
              >
                <QuestNodeChip
                  name={craft.taskUnlockName ?? 'Квест-анлок'}
                  traderNn={craft.taskUnlockTrader}
                  minLevel={craft.taskUnlockMinLevel}
                  done={questDone}
                />
              </Link>
            )}
            {editionGated && (
              <RequirementChip
                label={editionLabel(craft.gameEditions)}
                met={editionOwned}
                title={editionOwned ? 'Издание есть' : 'Крафт открывается изданием игры'}
              />
            )}
            {craft.requiredQuestItems && craft.requiredQuestItems.length > 0 && (
              <RequirementChip
                label={`Нужны квест-предметы · ${craft.requiredQuestItems.length}`}
                met={null}
                title="На входе есть квест-предметы (не покупаются на барахолке)"
              />
            )}
          </div>
          )}

          {/* 5. Метрики: лейбл-линия «ВЫРУЧКА» → список строк с иконками и цветом по знаку */}
          <DividerLabel label="Выручка" />
          <div className="flex flex-col gap-2">
            <MetricRow
              icon={<Clock className="h-4 w-4 shrink-0" aria-hidden />}
              label="Время"
              value={fmtDurLong(eco.effDurationSec)}
              valueClass="text-text-secondary"
            />
            <MetricRow
              icon={<span aria-hidden className="h-4 w-4 shrink-0 icon-mask icon-eft-currency-ruble bg-text-secondary" />}
              label="Выручка"
              value={fmtRubFull(eco.outputValue)}
              valueClass="text-text-secondary"
            />
            <MetricRow
              icon={<ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />}
              label="Покупка"
              value={fmtRubFull(-eco.totalCost)}
              valueClass="text-danger"
            />
            <MetricRow
              icon={<Percent className="h-4 w-4 shrink-0" aria-hidden />}
              label="Комиссия"
              value={fmtRubFull(-eco.fleaFeeTotal)}
              valueClass="text-danger"
            />
            <MetricRow
              icon={<span aria-hidden className="h-4 w-4 shrink-0 icon-mask icon-eft-savings bg-nvg-green" />}
              label="Экономия"
              value={fmtRubFull(eco.savings, { sign: true })}
              valueClass="text-nvg-green"
            />
            <MetricRow
              icon={<span aria-hidden className="h-4 w-4 shrink-0 icon-mask icon-eft-profit bg-nvg-green" />}
              label="Прибыль"
              value={fmtRubFull(eco.profit, { sign: true })}
              valueClass="text-nvg-green"
            />
            <MetricRow
              icon={<span aria-hidden className={`h-4 w-4 shrink-0 icon-mask icon-eft-currency-ruble ${pphColor(eco.profitPerHour).replace('text-', 'bg-')}`} />}
              label="Р/час"
              value={fmtRubFull(eco.profitPerHour)}
              valueClass={pphColor(eco.profitPerHour)}
            />
          </div>
        </>
      )}

      {/* 6. Подвал: кнопка по стейту + скрепка «в список нужного» */}
      <div className="mt-auto flex h-7 items-center gap-2 pt-1">
        {state === 'locked' && (
          <button
            type="button"
            disabled
            className="flex h-7 flex-1 items-center justify-center rounded-sm border border-lines-hover bg-card-menu/40 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted"
          >
            Заблокировано
          </button>
        )}
        {state === 'busy' && (
          <button
            type="button"
            disabled
            title={`Верстак освободится через ${fmtHhMm(siblingRemaining)}`}
            className="flex h-7 flex-1 items-center justify-center rounded-sm border border-lines-hover bg-card-menu/40 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted"
          >
            Станция занята
          </button>
        )}
        {state === 'can-craft' && (
          <button
            type="button"
            onClick={onStart}
            className="flex h-7 flex-1 items-center justify-center rounded-sm border border-tactical-amber bg-[color-mix(in_srgb,var(--color-tactical-amber)_12%,transparent)] font-blender-medium text-type-caption uppercase tracking-widest text-tactical-amber transition-colors hover:bg-[color-mix(in_srgb,var(--color-tactical-amber)_20%,transparent)]"
          >
            В производство
          </button>
        )}
        {state === 'producing' && (
          <button
            type="button"
            disabled
            className="flex h-7 flex-1 items-center justify-center rounded-sm border border-lines-hover bg-card-menu/40 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted"
          >
            Производится…
          </button>
        )}
        {state === 'done' && (
          <button
            type="button"
            onClick={() => collect(stationKey)}
            className="flex h-7 flex-1 items-center justify-center rounded-sm border border-nvg-green bg-[color-mix(in_srgb,var(--color-nvg-green)_12%,transparent)] font-blender-medium text-type-caption uppercase tracking-widest text-nvg-green transition-colors hover:bg-[color-mix(in_srgb,var(--color-nvg-green)_20%,transparent)]"
          >
            Забрать крафт
          </button>
        )}

        <button
          type="button"
          onClick={onClip}
          title={isPinned ? 'Открепить крафт' : 'Закрепить крафт сверху'}
          aria-label={isPinned ? 'Открепить крафт' : 'Закрепить крафт'}
          aria-pressed={isPinned}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border transition-colors ${
            isPinned
              ? 'border-(--primary) text-(--primary)'
              : 'border-lines-hover text-text-muted hover:text-text-secondary'
          }`}
        >
          <Paperclip className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}
