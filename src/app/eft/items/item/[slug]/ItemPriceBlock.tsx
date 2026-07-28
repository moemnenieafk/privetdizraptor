"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, PackageX } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useIsPve } from '@/hooks/useGameMode';
import { VendorImage } from './ItemImage';
import { traderImg } from '@/lib/trader-utils';
import type { VendorOffer } from './ItemModules';

interface ItemPriceBlockProps {
  buyFor?: VendorOffer[];
  sellFor?: VendorOffer[];
  slots: number;
  /** Требуемый уровень игрока для лучшей покупки у торговца */
  buyLevelRequired?: number | null;
  /** Курс валют торговцев в рублях: USD у Миротворца, EUR у Лыжника. */
  rates?: { usd: number | null; eur: number | null };
  /** Возраст зеркала цен в часах — показывается только у карточек барахолки. */
  pricesAgeHours?: number | null;
  /**
   * Свежая базовая цена ИЗ ЖУРНАЛА изменений (не из каталога — он отстаёт).
   * Второй строкой у «Продать торговцу»: торговая цена от базовой производная,
   * и у волатильных предметов вроде Биткоина это объясняет сдвиг цифры сверху.
   * null → строки и бейджа нет.
   */
  latestBasePrice?: number | null;
}

/**
 * Шкала выгодности. Красного нет намеренно: подсвечиваем только то, где игроку
 * лучше, невыгодное остаётся нейтральным.
 */
const GAIN_GREEN = 10_000;
const GAIN_SUPER = 100_000;

function gainClass(gain: number): string {
  if (gain >= GAIN_SUPER) return 'text-(--color-success)';
  if (gain >= GAIN_GREEN) return 'text-nvg-green';
  return 'text-text-secondary';
}

const CURRENCY_SIGN: Record<string, string> = { USD: '$', EUR: '€' };

function fmtAge(hours: number | null | undefined): string | null {
  if (hours == null || hours < 0) return null;
  if (hours < 1) return `Обновлено: ${Math.max(1, Math.round(hours * 60))} мин назад`;
  if (hours < 24) return `Обновлено: ${Math.round(hours)} ч назад`;
  return `Обновлено: ${Math.round(hours / 24)} д назад`;
}

const isFlea = (v: { normalizedName?: string; name: string }) =>
  v.normalizedName === 'flea-market' || v.name === 'Flea Market';

const rub = (o: VendorOffer) => o.priceRUB ?? o.price;
// Резолвер цены по режиму: PvE-поле, иначе фолбэк на обычную (PvP) цену.
const rubForMode = (o: VendorOffer, pve: boolean) => (pve ? (o.priceRUBPve ?? o.pricePve ?? rub(o)) : rub(o));

// Тег контекста цены барахолки в PvE: пока данных нет — показываем, что цифра из PvP-рынка.
function FleaModeTag({ isPve, hasPve }: { isPve: boolean; hasPve: boolean }) {
  if (!isPve) return null;
  return (
    <span className="ml-2 rounded-xs border border-edition-tue px-1.5 py-0.5 font-blender-medium text-type-caption uppercase tracking-widest text-edition-tue">
      {hasPve ? 'PvE' : 'PvP-рынок'}
    </span>
  );
}
const fmtRub = (value: number) => `${value.toLocaleString('ru-RU')} ₽`;

// ─── Бокс 48px для иконок — фон в цвет иконки (10%), без обводки ──────────────
function IconFrame({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded ${tint}`}>
      {children}
    </div>
  );
}

// ─── Гексагон требуемого уровня игрока (как LevelBadge в EftItemTile) ─────────
function LevelHex({ required }: { required: number }) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  const profile = profiles.find((p) => p.id === activeId);
  const playerLvl = profile ? parseInt(profile.level, 10) : 0;
  // Показываем только пока игрок не дорос: достигнутый порог — не информация,
  // а шум. Уровень неизвестен (профиль не загружен) → считаем, что не дорос.
  if (playerLvl >= required) return null;
  const color = 'var(--color-danger)';

  return (
    <span
      title={`Требуемый уровень игрока: ${required}`}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center"
    >
      <svg width="28" height="28" viewBox="0 0 16 16" aria-hidden="true">
        <polygon points="8,1.5 14,4.75 14,11.25 8,14.5 2,11.25 2,4.75" fill="none" stroke={color} strokeWidth="1.2" />
        <text x="8" y="10.4" textAnchor="middle" fontSize="6.5" fill={color} fontFamily="var(--font-blender-medium)">
          {required}
        </text>
      </svg>
    </span>
  );
}

// Плавный переход числа при смене режима PvP↔PvE: обе цены уже в payload,
// грузить нечего — поэтому не скелетон, а честный tween значения + короткий поп.
// Первый рендер без анимации (не крутим счётчик на загрузке страницы);
// prefers-reduced-motion → мгновенная подстановка.
const TWEEN_MS = 220;

function useAnimatedNumber(target: number): { shown: number; pop: boolean } {
  const [shown, setShown] = useState(target);
  const [pop, setPop] = useState(false);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const popRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      fromRef.current = target;
      setShown(target);
      return;
    }
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduce) {
      fromRef.current = to;
      setShown(to);
      return;
    }

    setPop(true);
    if (popRef.current) clearTimeout(popRef.current);
    popRef.current = setTimeout(() => setPop(false), TWEEN_MS);

    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min((now - start) / TWEEN_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setShown(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (popRef.current) clearTimeout(popRef.current);
    };
  }, [target]);

  return { shown, pop };
}

function BigPrice({ value, className }: { value: number; className: string }) {
  const { shown, pop } = useAnimatedNumber(value);
  return (
    <span
      className={`font-blender-medium text-3xl leading-none transition-transform duration-200 ease-out ${pop ? 'scale-105' : 'scale-100'} ${className}`}
    >
      {fmtRub(shown)}
    </span>
  );
}

function EmptyValue() {
  return (
    <>
      <IconFrame tint="bg-red-500/10">
        <PackageX className="h-5 w-5 text-red-500/70" />
      </IconFrame>
      <span className="ml-auto text-right font-blender-medium text-2xl leading-none uppercase tracking-widest text-danger">НЕТ</span>
    </>
  );
}

// ─── Карточка цены: подпись сверху, значение снизу ──────────────────────────
function PriceCard({
  label,
  note,
  noteIcon,
  noteAccent,
  children,
}: {
  label: string;
  note?: string | null;
  /** Иконка компаньона рядом с note (метка «цена из живого зеркала барахолки»). */
  noteIcon?: boolean;
  /** Янтарная подпись с пульсом вместо приглушённой — метка «недавно изменено». */
  noteAccent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-card-menu p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="font-blender-medium text-xs uppercase tracking-[0.08em] text-text-secondary">
          {label}
        </span>
        {note && (
          <span
            className={`ml-auto flex shrink-0 items-center gap-2 font-blender-medium text-[8px] uppercase tracking-widest ${noteAccent ? 'text-(--primary)' : 'text-text-muted'}`}
          >
            {note}
            {noteAccent && <Activity className="h-3 w-3 shrink-0" aria-hidden="true" />}
            {noteIcon && (
              <Link
                href="/eft/companion"
                title="Открыть Компаньон цен"
                aria-label="Открыть Компаньон цен"
                className="group inline-flex shrink-0 items-center"
              >
                <span
                  className="icon-eft-fleamarker-companion h-3 w-3 shrink-0 bg-text-muted mask-contain mask-center mask-no-repeat transition-colors group-hover:bg-(--primary)"
                  aria-hidden="true"
                />
              </Link>
            )}
          </span>
        )}
      </div>
      <div className="flex min-h-12 items-center gap-4">{children}</div>
    </div>
  );
}

// ─── Курс валют торговцев ───────────────────────────────────────────────────
// Показываем курс только той валюты, в которой реально торгуется предмет:
// продаётся/покупается за $ → USD, за € → EUR, только за ₽ → ничего.
function RateRow({
  rates,
  currencies,
}: {
  rates?: { usd: number | null; eur: number | null };
  currencies: Set<string>;
}) {
  if (!rates) return null;

  const entries: { trader: string; label: string; value: number }[] = [];
  if (rates.usd != null && currencies.has('USD')) entries.push({ trader: 'peacekeeper', label: 'USD', value: rates.usd });
  if (rates.eur != null && currencies.has('EUR')) entries.push({ trader: 'skier', label: 'EUR', value: rates.eur });
  if (entries.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      {entries.map((e) => (
        <span key={e.label} className="flex items-center gap-2">
          <img src={traderImg(e.trader)} alt="" width={16} height={16} className="h-4 w-4 rounded-xs" />
          <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
            КУРС {e.label}
          </span>
          <span className="font-blender-medium text-xs text-text-secondary">{fmtRub(e.value)}</span>
        </span>
      ))}
    </div>
  );
}

// Вторичная цена в валюте торговца под рублёвой — для наглядности, главная всё равно в ₽.
function CurrencyNote({ offer }: { offer: VendorOffer }) {
  const sign = offer.currency ? CURRENCY_SIGN[offer.currency] : undefined;
  if (!sign || !offer.price) return null;
  return (
    <span className="font-blender-medium text-xs text-text-muted">
      {offer.price.toLocaleString('ru-RU')} {sign}
    </span>
  );
}

export function ItemPriceBlock({
  buyFor = [],
  sellFor = [],
  slots,
  buyLevelRequired,
  rates,
  pricesAgeHours,
  latestBasePrice,
}: ItemPriceBlockProps) {
  const isPve = useIsPve();
  const showBaseLine = Boolean(latestBasePrice && latestBasePrice > 0);
  const traderBuys = buyFor.filter((b) => !isFlea(b.vendor));
  const fleaBuy = buyFor.find((b) => isFlea(b.vendor));
  const traderSells = sellFor.filter((s) => !isFlea(s.vendor));
  const fleaSell = sellFor.find((s) => isFlea(s.vendor));

  const bestTraderBuy = traderBuys.length
    ? traderBuys.reduce((min, c) => (rub(c) < rub(min) ? c : min))
    : null;
  const bestTraderSell = traderSells.length
    ? traderSells.reduce((max, c) => (rub(c) > rub(max) ? c : max))
    : null;

  const safeSlots = slots > 0 ? slots : 1;
  const traderSellVps = bestTraderSell ? Math.floor(rub(bestTraderSell) / safeSlots) : 0;
  const fleaSellVps = fleaSell ? Math.floor(rubForMode(fleaSell, isPve) / safeSlots) : 0;

  // Зелёным подсвечивается сторона, где игроку выгоднее: дешевле купить,
  // дороже продать. Проигравшая сторона остаётся нейтральной, красного нет.
  const buyGap = bestTraderBuy && fleaBuy ? rub(bestTraderBuy) - rubForMode(fleaBuy, isPve) : 0;
  const sellGap = bestTraderSell && fleaSell ? rubForMode(fleaSell, isPve) - rub(bestTraderSell) : 0;

  const traderBuyClass = buyGap < 0 ? gainClass(-buyGap) : 'text-text-secondary';
  const fleaBuyClass = buyGap > 0 ? gainClass(buyGap) : 'text-text-secondary';
  const traderSellClass = sellGap < 0 ? gainClass(-sellGap) : 'text-text-secondary';
  const fleaSellClass = sellGap > 0 ? gainClass(sellGap) : 'text-text-secondary';

  const age = fmtAge(pricesAgeHours);

  // Валюты, в которых реально торгуется предмет (для показа только нужного курса).
  const usedCurrencies = new Set<string>();
  for (const o of [...buyFor, ...sellFor]) {
    if (o.currency === 'USD' || o.currency === 'EUR') usedCurrencies.add(o.currency);
  }

  return (
    <div className="flex flex-col gap-2">
      <RateRow rates={rates} currencies={usedCurrencies} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {/* Купить у торговца */}
        <PriceCard label="Купить у торговца">
          {bestTraderBuy ? (
            <>
              <div className="flex shrink-0 items-center gap-2">
                <VendorImage
                  normalizedName={bestTraderBuy.vendor.normalizedName}
                  name={bestTraderBuy.vendor.name}
                  className="h-12 w-12 shrink-0 rounded object-cover"
                />
              </div>
              <span className="ml-auto flex min-w-0 flex-col items-end gap-1 text-right">
                <BigPrice value={rub(bestTraderBuy)} className={traderBuyClass} />
                <CurrencyNote offer={bestTraderBuy} />
              </span>
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>

        {/* Купить на барахолке */}
        <PriceCard label="Купить на барахолке" note={age} noteIcon>
          {fleaBuy ? (
            <>
              <IconFrame tint="bg-tactical-amber/10">
                <span className="icon-eft-currency-ruble h-7 w-7 bg-tactical-amber mask-contain mask-center mask-no-repeat" />
              </IconFrame>
              {buyLevelRequired != null && buyLevelRequired > 0 && <LevelHex required={buyLevelRequired} />}
              <BigPrice value={rubForMode(fleaBuy, isPve)} className={`ml-auto text-right ${fleaBuyClass}`} />
              <FleaModeTag isPve={isPve} hasPve={fleaBuy.priceRUBPve != null} />
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>

        {/* Продать торговцу */}
        <PriceCard
          label="Продать торговцу"
          note={showBaseLine ? 'Недавно изменено' : null}
          noteAccent={showBaseLine}
        >
          {bestTraderSell ? (
            <>
              <VendorImage
                normalizedName={bestTraderSell.vendor.normalizedName}
                name={bestTraderSell.vendor.name}
                className="h-12 w-12 shrink-0 rounded object-cover"
              />
              <span className="ml-auto flex min-w-0 flex-col items-end gap-2 text-right">
                <BigPrice value={rub(bestTraderSell)} className={traderSellClass} />
                {/* Базовая цена: торговая от неё производная, поэтому при свежей
                    правке показываем причину сдвига прямо под ценой. */}
                {showBaseLine && (
                  <span className="font-blender-medium text-lg leading-none text-(--primary)">
                    {fmtRub(latestBasePrice!)}
                  </span>
                )}
                <CurrencyNote offer={bestTraderSell} />
              </span>
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>

        {/* Продать на барахолке */}
        <PriceCard label="Продать на барахолке" note={age} noteIcon>
          {fleaSell ? (
            <>
              <IconFrame tint="bg-tactical-amber/10">
                <span className="icon-eft-currency-ruble h-7 w-7 bg-tactical-amber mask-contain mask-center mask-no-repeat" />
              </IconFrame>
              {buyLevelRequired != null && buyLevelRequired > 0 && <LevelHex required={buyLevelRequired} />}
              <BigPrice value={rubForMode(fleaSell, isPve)} className={`ml-auto text-right ${fleaSellClass}`} />
              <FleaModeTag isPve={isPve} hasPve={fleaSell.priceRUBPve != null} />
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>

        {/* Цена / слот у торговца */}
        <PriceCard label="Цена / слот у торговца">
          {traderSellVps > 0 ? (
            <>
              <IconFrame tint="bg-text-secondary/10">
                <span className="icon-eft-items-price-slot h-6 w-6 bg-text-secondary mask-contain mask-center mask-no-repeat" />
              </IconFrame>
              <BigPrice value={traderSellVps} className="ml-auto text-right text-text-secondary" />
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>

        {/* Цена / слот на барахолке */}
        <PriceCard label="Цена / слот на барахолке" note={`${safeSlots} ${safeSlots === 1 ? 'ячейка' : 'ячеек'}`}>
          {fleaSellVps > 0 ? (
            <>
              <IconFrame tint="bg-nvg-green/10">
                <span className="icon-eft-items-price-slot h-6 w-6 bg-nvg-green mask-contain mask-center mask-no-repeat" />
              </IconFrame>
              <BigPrice value={fleaSellVps} className="ml-auto text-right text-nvg-green" />
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>
      </div>
    </div>
  );
}
