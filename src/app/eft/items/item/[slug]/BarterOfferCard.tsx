import Link from 'next/link';
import { traderImg } from '@/lib/trader-utils';
import { TRADER_COLORS } from '@/data/traderColors';
import { calcFleaFee } from '@/lib/barter-calc';
import type { BarterOffer } from './ItemModules';

/**
 * Подложка карточки — тот же приём, что в нодах квестов: радиальный градиент
 * отдельным слоем под контентом плюс сплошная рамка цветом торговца.
 *
 * ВАЖНО: цвет берётся из JS-палитры, а не из var(--trader-*). Tailwind v4
 * вырезает неиспользуемые @theme-переменные из сборки, в рантайме они не
 * резолвятся, и color-mix отдаёт пустоту — градиент схлопывается в чёрный.
 * На эти грабли проект уже наступал в QuestNode.
 */
export function cardGradient(color: string): string {
  return `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${color} 56%, transparent), #000000)`;
}

export function cardBorder(color: string): React.CSSProperties {
  return {
    borderColor: color,
    boxShadow: `0 0 12px color-mix(in srgb, ${color} 30%, transparent)`,
  };
}

/** Пороги выгодности — та же шкала, что в ценовом блоке. */
const GAIN_GREEN = 10_000;
const GAIN_SUPER = 100_000;

export function gainClass(value: number): string {
  if (value >= GAIN_SUPER) return 'text-(--color-success)';
  if (value >= GAIN_GREEN) return 'text-nvg-green';
  return value > 0 ? 'text-text-secondary' : 'text-danger';
}

export const fmtRubShort = (v: number) => `${Math.round(v).toLocaleString('ru-RU')} ₽`;

/** Разделитель секции: линия · подпись · линия. */
export function SlotDivider({ label }: { label: string }) {
  return (
    <div className="flex h-7 items-center gap-2.5">
      <span className="h-px min-w-0 flex-1 bg-linear-to-r from-transparent to-lines-hover" />
      <span className="shrink-0 font-blender-medium text-[10px] uppercase leading-none text-text-primary">
        {label}
      </span>
      <span className="h-px min-w-0 flex-1 bg-linear-to-l from-transparent to-lines-hover" />
    </div>
  );
}

/** Минимум, который нужен слоту. Бартер и крафт описывают предметы по-разному,
 *  поэтому слот принимает только то, что реально рисует. */
export interface SlotItem {
  id: string;
  name: string;
  shortName: string;
  image512pxLink: string;
  normalizedName?: string;
  marketPrice?: number;
}

/** Слот 96px: тайл 48 со счётчиком в углу, под ним имя, итог и цена за штуку. */
export function BarterSlot({
  item,
  count,
  highlight = false,
  tileOnly = false,
}: {
  item: SlotItem;
  count: number;
  /** Тот самый предмет, чью карточку смотрим. В чужом рецепте он главный. */
  highlight?: boolean;
  /** Только тайл со счётчиком: в ряду «получить» название и цены стоят рядом. */
  tileOnly?: boolean;
}) {
  const unit = item.marketPrice ?? 0;
  const total = unit * count;
  const body = (
    <>
      <span
        className={`relative flex h-12 w-12 items-center justify-end rounded border bg-(--color-base) p-[3px] ${
          highlight ? 'border-tactical-amber shadow-[0_0_10px_color-mix(in_srgb,var(--color-tactical-amber)_35%,transparent)]' : 'border-lines-hover'
        }`}
      >
        {item.image512pxLink && (
          <img src={item.image512pxLink} alt="" className="absolute inset-0 h-full w-full object-contain" />
        )}
        <span className="relative z-10 self-end font-blender-medium text-[10px] leading-none text-tactical-amber">
          x{count}
        </span>
      </span>
      {!tileOnly && (
        <span
          className={`w-full truncate text-center font-blender-medium text-xs leading-none ${
            highlight ? 'text-tactical-amber' : 'text-text-primary'
          }`}
        >
          {item.shortName || item.name}
        </span>
      )}
      {!tileOnly && unit > 0 && (
        <>
          <span className="w-full truncate text-center font-blender-medium text-xs leading-none text-text-secondary">
            {fmtRubShort(total)}
          </span>
          <span className="w-full truncate text-center font-blender-medium text-[10px] leading-none text-text-muted">
            {Math.round(unit).toLocaleString('ru-RU')} × {count}
          </span>
        </>
      )}
    </>
  );

  return item.normalizedName ? (
    <Link
      href={`/eft/items/item/${item.normalizedName}`}
      className={`flex shrink-0 flex-col items-center gap-1.5 rounded-xs transition-colors hover:bg-white/4 ${tileOnly ? '' : 'w-24'}`}
    >
      {body}
    </Link>
  ) : (
    <span className={`flex shrink-0 flex-col items-center gap-1.5 ${tileOnly ? '' : 'w-24'}`}>{body}</span>
  );
}

/** Половина ряда метрик: плитка 48 · подпись · значение справа. */
export function Metric({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-text-muted/10">
        <span className={`${icon} h-6 w-6 bg-text-muted mask-contain mask-center mask-no-repeat`} />
      </span>
      <span className="shrink-0 font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className={`ml-auto truncate font-blender-medium text-xl leading-none ${gainClass(value)}`}>
        {fmtRubShort(value)}
      </span>
    </span>
  );
}

/** Колонка разложения в ряду «получить»: подпись сверху, число под ней. */
function Breakdown({
  label,
  value,
  tone,
  big = false,
}: {
  label: string;
  value: number;
  tone: string;
  big?: boolean;
}) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-1 text-right">
      <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span className={`font-blender-medium leading-none ${big ? 'text-2xl' : 'text-xl'} ${tone}`}>
        {fmtRubShort(value)}
      </span>
    </span>
  );
}

export function BarterOfferCard({ offer }: { offer: BarterOffer }) {
  const traderColor = TRADER_COLORS[offer.trader.normalizedName] ?? TRADER_COLORS.stories;

  // Вход — по рыночным ценам, а не по basePrice: последний игровая условность.
  const input = offer.requiredItems.reduce(
    (sum, r) => sum + (r.item.marketPrice ?? 0) * r.count,
    0,
  );
  const rewardUnit = offer.reward?.item.marketPrice ?? 0;
  const rewardCount = offer.reward?.count ?? 1;
  const output = rewardUnit * rewardCount;

  const known = input > 0 && output > 0;
  const fee = known ? calcFleaFee(offer.reward?.item.basePrice ?? 0, output, rewardCount) : 0;
  // Единственная метрика карточки. Экономия отсюда убрана намеренно: она равна
  // выходу минус вход, а оба числа и так показаны в ряду «получить» — строка
  // дублировала бы то, что уже на экране.
  const profit = output - fee - input;

  return (
    <article
      className="relative flex flex-col gap-3 overflow-hidden rounded-lg border p-3.5"
      style={{ borderWidth: 1, borderStyle: 'solid', ...cardBorder(traderColor) }}
    >
      <div className="absolute inset-0 z-0" style={{ background: cardGradient(traderColor) }} />
      {/* Шапка: торговец · уровень · лимит */}
      <div className="relative z-10 flex h-12 items-center gap-2.5">
        <img
          src={traderImg(offer.trader.normalizedName)}
          alt={offer.trader.name}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xs"
        />
        <span className="min-w-0 flex-1 truncate font-blender-medium text-xs uppercase tracking-widest text-text-primary">
          {offer.trader.name} LL{offer.level}
        </span>
        {offer.buyLimit != null && offer.buyLimit > 0 && (
          // Сколько игрок уже выкупил, портал знать не может — этих данных нет
          // ни в API, ни в profile.json. Показываем сам лимит, без счётчика.
          <span className="shrink-0 rounded-sm bg-(--color-base) px-2 py-1 font-blender-medium text-xs text-tactical-amber">
            Лимит {offer.buyLimit}
          </span>
        )}
      </div>

      {/* Слева квест-гейт, если бартер закрыт заданием; справа единственная метрика. */}
      {(known || offer.taskUnlock) && (
        <div className="relative z-10 flex h-12 items-stretch gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {offer.taskUnlock && (
              <>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-tactical-amber/10">
                  <span className="icon-eft-quest-lock h-6 w-6 bg-tactical-amber mask-contain mask-center mask-no-repeat" />
                </span>
                <Link
                  href="/eft/questmap"
                  className="flex min-w-0 flex-col gap-1 transition-colors hover:text-(--primary)"
                >
                  <span className="w-fit rounded-xs border border-tactical-amber/40 px-2 py-0.5 font-blender-medium text-[10px] uppercase tracking-widest text-tactical-amber">
                    Задание
                  </span>
                  <span className="truncate font-blender-medium text-xs uppercase text-text-primary">
                    {offer.taskUnlock.name ?? 'Требуется задание'}
                  </span>
                </Link>
              </>
            )}
          </span>
          {known && <Metric icon="icon-eft-profit" label="Прибыль" value={profit} />}
        </div>
      )}

      <div className="relative z-10"><SlotDivider label="Отдать" /></div>

      <div className="relative z-10 flex flex-wrap items-start justify-center gap-1">
        {offer.requiredItems.map((req) => (
          <BarterSlot key={req.item.id} item={req.item} count={req.count} />
        ))}
      </div>

      {offer.reward && (
        <>
          <div className="relative z-10"><SlotDivider label="Получить" /></div>
          <div className="relative z-10 flex items-center gap-3.5">
            <BarterSlot item={offer.reward.item} count={offer.reward.count} tileOnly />
            <span className="min-w-0 flex-1 truncate font-blender-medium text-xs uppercase text-text-primary">
              {offer.reward.item.name}
            </span>
            {known && (
              <>
                <Breakdown label="Покупка" value={-input} tone="text-danger" />
                <Breakdown label="Комиссия" value={-fee} tone="text-danger" />
                <Breakdown label="Продажа на барахолке" value={output} tone="text-text-primary" big />
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
}
