'use client';

// Карточка рецепта крафта в духе EFT Item Card (§5 спеки craft-profit-rework).
// Самодостаточна по пропсам (в страницу вшивает T7): чистый ввод — ProcessedCraft + разрешённые
// уровни навыков/убежища из стора родителя; «в схроне» читает сама из useInventoryStore.
// Доменная математика — computeCraftEconomy (T2), в JSX только форматирование (§4.7 CLAUDE).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { TrackCell } from '@/components/ui/kit';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { itemIconUrl } from '@/lib/item-icon';
import { useInventoryStore } from '@/store/useInventoryStore';
import { computeCraftEconomy } from '@/lib/craft-profit';
import { stationIconClass } from '@/components/features/hideout/HideoutBuildTracker';
import { RequirementChip } from '@/components/features/hideout/RequirementChip';
import type { ProcessedCraft } from '@/app/eft/progress/hideout/craft-profit/CraftProfitClient';

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
  /** Квест-анлок пройден (T1, опц.): true/false задаёт тон чипа, undefined — чипа нет. */
  questDone?: boolean;
  /** Издание, дающее крафт, куплено (T1, опц.): аналогично questDone. */
  editionOwned?: boolean;
}

function fmtRub(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1_000_000) return `${sign}${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}М`;
  if (a >= 1_000) return `${sign}${Math.round(a / 1_000)}к`;
  return `${sign}${a}`;
}

function fmtDur(sec: number): string {
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}ч ${m ? `${m}м` : ''}`.trim() : `${m}м`;
}

function pphColor(pph: number): string {
  if (pph > 20_000) return 'text-success';
  if (pph > 5_000) return 'text-(--primary)';
  if (pph > 0) return 'text-text-secondary';
  return 'text-text-muted';
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
  // mounted-гард: «в схроне» — persist-стор (localStorage), читаем только на клиенте (hydration).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const stashCount = (id: string) => (mounted ? (ownedItems[id] ?? 0) : 0);

  const reward = craft.reward[0];

  // Экономика крафта — чистый хелпер T2. Выход: базовая цена = unitPrice выхода (для налога),
  // продажа трейдеру/флиа приходят из totalValue ридера (v1: unitPrice = лучшая продажа за штуку).
  const eco = useMemo(() => {
    const outUnit = reward?.unitPrice ?? 0;
    return computeCraftEconomy({
      inputs: craft.required.map((r) => ({ unitBuy: r.unitPrice, count: r.count })),
      output: {
        basePrice: outUnit,
        bestTraderSell: outUnit,
        fleaPrice: outUnit,
        count: reward?.count ?? 1,
      },
      baseDurationSec: craft.duration,
      craftingLevel,
      hideoutMgmtLevel,
      intelCenterBuilt,
      emptyFuel,
    });
  }, [craft, reward, craftingLevel, hideoutMgmtLevel, intelCenterBuilt, emptyFuel]);

  const stationMet = builtStationLevel >= craft.level;
  // «Доступно сейчас» = станция построена ≥ уровня И (квест пройден | нет данных) И (издание | нет данных).
  const available = stationMet && questDone !== false && editionOwned !== false;

  const rewardBg = getTarkovBackgroundColor(reward?.item.backgroundColor);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-lines-hover bg-card-menu p-4">
      {/* 1. Шапка: иконка станции + имя + чип «УР. N» + статус */}
      <header className="flex items-center gap-2.5">
        {craft.stationNormalized && (
          <span aria-hidden className={`h-7 w-7 shrink-0 icon-mask ${stationIconClass(craft.stationNormalized)} bg-text-secondary`} />
        )}
        <span className="min-w-0 flex-1 truncate font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary">
          {craft.stationName}
        </span>
        <span className="shrink-0 rounded-xs border border-lines-hover px-1.5 py-0.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
          Ур. {craft.level}
        </span>
        {available ? (
          <span title="Доступно сейчас" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs bg-nvg-green/10 text-nvg-green">
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <span title="Заблокировано" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs bg-card-menu/60 text-text-muted">
            <Lock className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </header>

      {/* 2. Герой — предмет-ВЫХОД: крупная рарити-иконка + имя (ссылка) + ×N + цена продажи */}
      {reward && (
        <div className="flex items-center gap-3">
          <span
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-(--color-base)"
            style={{ backgroundColor: rewardBg }}
          >
            <img
              src={reward.item.image512pxLink ?? itemIconUrl(reward.item.id)}
              alt={reward.item.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            />
            <span className="absolute bottom-0 right-0 rounded-tl-xs bg-(--color-darkbase)/90 px-1 py-0.5 font-blender-medium text-type-micro leading-none text-text-primary">
              ×{reward.count}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            {reward.item.slug ? (
              <Link
                href={`/eft/items/item/${reward.item.slug}`}
                className="line-clamp-2 font-blender-medium text-sm uppercase leading-tight tracking-wide text-text-primary transition-colors hover:text-(--primary)"
              >
                {reward.item.name}
              </Link>
            ) : (
              <span className="line-clamp-2 font-blender-medium text-sm uppercase leading-tight tracking-wide text-text-primary">
                {reward.item.name}
              </span>
            )}
            <p className="mt-1.5 font-blender-medium text-type-caption tabular-nums text-text-secondary">
              {fmtRub(eco.outputValue)} {eco.usedFlea ? '(барахолка)' : '(торговец)'}
            </p>
          </div>
        </div>
      )}

      {/* 3. Входы: ряд TrackCell в режиме display + «в схроне» (read-only) */}
      {craft.required.length > 0 && (
        <div>
          <p className="mb-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">Входы</p>
          <div className="flex flex-wrap gap-2">
            {craft.required.map((r, i) => (
              <div key={`${r.item.id}-${i}`} className="flex w-14 flex-col items-center gap-1">
                <TrackCell
                  iconSrc={r.item.image512pxLink ?? itemIconUrl(r.item.id)}
                  alt={r.item.name}
                  have={stashCount(r.item.id)}
                  need={r.count}
                  bgColor={getTarkovBackgroundColor(r.item.backgroundColor)}
                  onInc={() => {}}
                />
                <span className="w-full text-center font-blender-medium text-type-micro tabular-nums text-text-secondary">
                  ×{r.count} · {fmtRub(r.unitPrice * r.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Требования: nvg-green чипы (станция всегда; квест/издание — если поля заданы) */}
      <div className="flex flex-wrap items-center gap-2">
        <RequirementChip
          iconClass={craft.stationNormalized ? stationIconClass(craft.stationNormalized) : undefined}
          label={`${craft.stationName} · Ур. ${craft.level}`}
          met={stationMet}
          title={`${craft.stationName} — нужен уровень ${craft.level}, у вас ${builtStationLevel}`}
        />
        {questDone !== undefined && (
          <RequirementChip label="Квест-анлок" met={questDone} title={questDone ? 'Квест пройден' : 'Требуется пройти квест'} />
        )}
        {editionOwned !== undefined && (
          <RequirementChip label="Издание" met={editionOwned} title={editionOwned ? 'Издание есть' : 'Требуется издание'} />
        )}
      </div>

      {/* 5. Метрики (подвал): время база→эфф · стоимость→выручка · налог барахолки · профит · ₽/час */}
      <dl className="mt-auto flex flex-col gap-1 border-t border-lines-hover pt-3 text-type-caption tabular-nums">
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Время</dt>
          <dd className="text-text-secondary">
            {fmtDur(craft.duration)} <span className="text-text-muted">→</span> {fmtDur(eco.effDurationSec)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-text-muted">Вход → выручка</dt>
          <dd className="text-text-secondary">
            {fmtRub(eco.totalCost)} <span className="text-text-muted">→</span> {fmtRub(eco.outputValue)}
          </dd>
        </div>
        {eco.fleaFeeTotal > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Налог барахолки</dt>
            <dd className="text-danger">−{fmtRub(eco.fleaFeeTotal)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="font-blender-medium uppercase tracking-widest text-text-muted">Профит</dt>
          <dd className={`font-blender-medium ${eco.profit > 0 ? 'text-text-primary' : 'text-text-muted'}`}>
            {eco.profit > 0 ? '+' : ''}
            {fmtRub(eco.profit)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-blender-medium uppercase tracking-widest text-text-muted">₽/час</dt>
          <dd className={`font-blender-medium ${pphColor(eco.profitPerHour)}`}>{fmtRub(eco.profitPerHour)}/ч</dd>
        </div>
      </dl>
    </article>
  );
}
