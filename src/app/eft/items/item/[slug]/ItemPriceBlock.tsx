"use client";

import { useEffect, useRef, useState } from 'react';
import { PackageX } from 'lucide-react';
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
  children,
}: {
  label: string;
  note?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-card-menu p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="font-blender-medium text-xs uppercase tracking-[0.08em] text-text-secondary">
          {label}
        </span>
        {note && (
          <span className="ml-auto shrink-0 font-blender-medium text-[8px] text-text-muted">{note}</span>
        )}
      </div>
      <div className="flex min-h-12 items-center gap-4">{children}</div>
    </div>
  );
}

// ─── Курс валют торговцев ───────────────────────────────────────────────────
function RateRow({ rates }: { rates?: { usd: number | null; eur: number | null } }) {
  if (!rates || (rates.usd == null && rates.eur == null)) return null;

  const entries: { trader: string; label: string; value: number }[] = [];
  if (rates.usd != null) entries.push({ trader: 'peacekeeper', label: 'USD', value: rates.usd });
  if (rates.eur != null) entries.push({ trader: 'skier', label: 'EUR', value: rates.eur });

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
}: ItemPriceBlockProps) {
  const isPve = useIsPve();
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

  return (
    <div className="flex flex-col gap-2">
      <RateRow rates={rates} />

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
        <PriceCard label="Купить на барахолке" note={age}>
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
        <PriceCard label="Продать торговцу">
          {bestTraderSell ? (
            <>
              <VendorImage
                normalizedName={bestTraderSell.vendor.normalizedName}
                name={bestTraderSell.vendor.name}
                className="h-12 w-12 shrink-0 rounded object-cover"
              />
              <span className="ml-auto flex min-w-0 flex-col items-end gap-1 text-right">
                <BigPrice value={rub(bestTraderSell)} className={traderSellClass} />
                <CurrencyNote offer={bestTraderSell} />
              </span>
            </>
          ) : (
            <EmptyValue />
          )}
        </PriceCard>

        {/* Продать на барахолке */}
        <PriceCard label="Продать на барахолке" note={age}>
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
