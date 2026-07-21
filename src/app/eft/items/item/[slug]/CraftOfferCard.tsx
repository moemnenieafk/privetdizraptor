import { BarterSlot, SlotDivider, gainClass, fmtRubShort } from './BarterOfferCard';
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

export function CraftOfferCard({ recipe }: { recipe: CraftRecipe }) {
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
    <article
      className="flex flex-col gap-3.5 overflow-hidden rounded-lg p-3.5"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: accent,
        background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${accent} 12%, transparent), #000000)`,
      }}
    >
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
        <div className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="icon-eft-profit h-4 w-4 shrink-0 bg-text-muted mask-contain mask-center mask-no-repeat" />
            <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
              Прибыль
            </span>
            <span className={`ml-auto font-blender-medium text-xl leading-none ${gainClass(profit)}`}>
              {fmtRubShort(profit)}
            </span>
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="icon-eft-profit h-4 w-4 shrink-0 bg-text-muted mask-contain mask-center mask-no-repeat" />
            <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
              Прибыль в час
            </span>
            <span className={`ml-auto font-blender-medium text-xl leading-none ${gainClass(perHour)}`}>
              {fmtRubShort(perHour)}
            </span>
          </span>
        </div>
      )}

      <SlotDivider label="Отдаю" />

      <div className="flex flex-wrap items-start gap-2">
        {recipe.requiredItems.map((req) => (
          <BarterSlot key={req.item.id} item={req.item} count={req.count} />
        ))}
      </div>

      {recipe.reward && (
        <>
          <SlotDivider label="Получаю" />
          <div className="flex items-center gap-3.5">
            <BarterSlot item={recipe.reward.item} count={recipe.reward.count} />
            {output > 0 && (
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-blender-medium text-xs uppercase tracking-widest text-text-muted">
                  На барахолке
                </span>
                <span className="font-blender-medium text-xl leading-none text-text-primary">
                  {fmtRubShort(output)}
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </article>
  );
}
