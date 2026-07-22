import { Clock } from 'lucide-react';
import { BarterSlot, SlotDivider, Metric, RewardRow, cardGradient, cardBorder } from './BarterOfferCard';
import { calcFleaFee } from '@/lib/barter-calc';
import { stationIconClass, type CraftRecipe } from './ItemModules';

/** Длительность крафта в человеческом виде: «40 мин», «2 ч 15 мин», «1 д 3 ч». */
function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return h > 0 ? `${d} д ${h} ч` : `${d} д`;
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  return `${m} мин`;
}

export function CraftOfferCard({
  recipe,
  highlightItemId,
}: {
  recipe: CraftRecipe;
  /** Подсветить этот ингредиент: на странице предмета в чужом рецепте важен именно он. */
  highlightItemId?: string;
}) {
  // Фирменный цвет карточки производства по макету — #9A8866 (ДС «Tactical PvP»):
  // иконка модуля, название, уровень, рамка и градиент фона. Литерал, а не
  // var(--…): @theme-переменные Tailwind вырезает, color-mix отдал бы пустоту.
  const accent = '#9A8866';

  const input = recipe.requiredItems.reduce(
    (sum, r) => sum + (r.item.marketPrice ?? 0) * r.count,
    0,
  );
  const rewardUnit = recipe.reward?.item.marketPrice ?? 0;
  const rewardCount = recipe.reward?.count ?? 1;
  const output = rewardUnit * rewardCount;

  const known = input > 0 && output > 0;
  const fee = known ? calcFleaFee(recipe.reward?.item.basePrice ?? 0, output, rewardCount) : 0;
  const profit = output - fee - input;
  // Крафт занимает время, поэтому рубли в час — честная мера, а не просто прибыль.
  const perHour = recipe.duration > 0 ? (profit / recipe.duration) * 3600 : 0;

  return (
    <article
      className="relative flex flex-col gap-3 overflow-hidden rounded-lg border p-3.5"
      style={{ borderWidth: 1, borderStyle: 'solid', ...cardBorder(accent) }}
    >
      <div className="absolute inset-0 z-0" style={{ background: cardGradient(accent) }} />
      {/* Шапка: модуль убежища · уровень · длительность */}
      <div className="relative z-10 flex h-12 items-center gap-2.5">
        <span
          className={`${stationIconClass(recipe.station.normalizedName)} h-12 w-12 shrink-0 mask-contain mask-center mask-no-repeat`}
          style={{ backgroundColor: accent }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-blender-medium text-xs uppercase tracking-widest" style={{ color: accent }}>
            {recipe.station.name}
          </span>
          <span className="font-blender-medium text-[10px] uppercase tracking-widest" style={{ color: accent }}>
            Ур. {String(recipe.level).padStart(2, '0')}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-sm bg-(--color-base) px-2 py-1 font-blender-medium text-xs text-tactical-amber">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {fmtDuration(recipe.duration)}
        </span>
      </div>

      {/* Метрики: прибыль и прибыль в час */}
      {known && (
        <div className="relative z-10 flex h-12 items-stretch gap-2 lg:gap-25">
          <Metric icon="icon-eft-profit" label="Прибыль" value={profit} />
          <Metric icon="icon-eft-prog-craft" label="Прибыль в час" value={perHour} />
        </div>
      )}

      <div className="relative z-10"><SlotDivider label="Отдаю" /></div>

      <div className="relative z-10 flex flex-wrap items-start justify-center gap-2 lg:flex-nowrap">
        {recipe.requiredItems.map((req) => (
          <BarterSlot
            key={req.item.id}
            item={req.item}
            count={req.count}
            highlight={req.item.id === highlightItemId}
          />
        ))}
      </div>

      {recipe.reward && (
        <>
          <div className="relative z-10"><SlotDivider label="Получаю" /></div>
          <RewardRow
            item={recipe.reward.item}
            count={recipe.reward.count}
            input={input}
            fee={fee}
            output={output}
            known={known}
          />
        </>
      )}
    </article>
  );
}
