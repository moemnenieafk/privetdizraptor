import { BarterSlot, SlotDivider, Metric, cardStyle } from './BarterOfferCard';
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
  const accent = 'var(--primary)';

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
    <article className="flex flex-col gap-3 rounded-lg border border-transparent p-3.5" style={cardStyle(accent)}>
      {/* Шапка: модуль убежища · уровень · длительность */}
      <div className="flex h-12 items-center gap-2.5">
        <span
          className={`${stationIconClass(recipe.station.normalizedName)} h-12 w-12 shrink-0 bg-text-primary mask-contain mask-center mask-no-repeat`}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-blender-medium text-xs uppercase tracking-widest text-text-primary">
            {recipe.station.name}
          </span>
          <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
            Ур. {String(recipe.level).padStart(2, '0')}
          </span>
        </span>
        <span className="shrink-0 rounded-sm bg-(--color-base) px-2 py-1 font-blender-medium text-xs text-tactical-amber">
          {fmtDuration(recipe.duration)}
        </span>
      </div>

      {/* Метрики: прибыль и прибыль в час */}
      {known && (
        <div className="flex h-12 items-stretch gap-2">
          <Metric icon="icon-eft-profit" label="Прибыль" value={profit} />
          <Metric icon="icon-eft-prog-craft" label="Прибыль в час" value={perHour} />
        </div>
      )}

      <SlotDivider label="Отдать" />

      <div className="flex flex-wrap items-start justify-center gap-2">
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
          <SlotDivider label="Получить" />
          <div className="flex items-center justify-center gap-3.5">
            <BarterSlot item={recipe.reward.item} count={recipe.reward.count} tileOnly />
            {output > 0 && (
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  На барахолке
                </span>
                <span className="font-blender-medium text-xl leading-none text-text-primary">
                  {Math.round(output).toLocaleString('ru-RU')} ₽
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </article>
  );
}
