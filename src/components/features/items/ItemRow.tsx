import { memo, forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";
import Image from "next/image";
import { MinusCircle } from "lucide-react";
import { TarkovItem } from "@/types/tarkov-items";
import { Badge, getArmorClassColor } from "@/components/features/items/Badge";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";
import { ItemGridSize } from "@/components/ui/ItemGridSize";

type ItemRowItem = TarkovItem & {
  eco?: {
    bestSell?: { price: number; vendor?: { name: string; normalizedName?: string } };
    bestBuy?: { vendor?: { name: string; normalizedName?: string } };
    minPrice?: number;
    vps?: number;
  };
};

interface ItemRowProps extends HTMLAttributes<HTMLAnchorElement> {
  item: ItemRowItem;
}

const CATEGORY_MAP: Record<string, string> = {
  armor: "Броня",
  weapon: "Оружие",
  ammo: "Патроны",
  meds: "Медицина",
  container: "Контейнер",
  headset: "Гарнитура",
  common: "Предмет",
};

/**
 * Сетка row-раскладки. Порядок треков = DOM-порядку ВИДИМЫХ ячеек на каждом пороге
 * (metrics виден с @4xl, size — с @3xl). Экспортируется, чтобы шапка `ItemsTable`
 * использовала тот же шаблон и колонки не разъезжались. Контейнер — `@container/items-table`.
 */
export const ITEM_ROW_TEMPLATE =
  "@2xl/items-table:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] " +
  "@3xl/items-table:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] " +
  "@4xl/items-table:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)]";

/**
 * Унифицированная строка предмета. Одна DOM-единица, две раскладки, переключаемые
 * НАТИВНЫМ контейнер-запросом (`@container/items-table` на скролл-контейнере `ItemsTable`):
 *   • узкий контейнер → карточка (стат-грид + чипы);
 *   • широкий → строка-таблица с колонками.
 * Заменяет пару `ItemTableRow` + `ItemCard` — без `useMediaQuery` и без дубля DOM.
 * Тап-таргет — вся строка.
 */
export const ItemRow = memo(
  forwardRef<HTMLAnchorElement, ItemRowProps>(function ItemRow({ item, className = "", ...props }, ref) {
    const effectivePrice = item.fleaPrice ?? 0;
    const buyPrice = item.eco?.minPrice ?? effectivePrice;
    const sellPrice = item.eco?.bestSell?.price ?? 0;
    const profitPerSlot =
      item.eco?.vps ?? Math.round(effectivePrice / ((item.gridWidth || 1) * (item.gridHeight || 1)));
    const categoryLabel = CATEGORY_MAP[item.category] ?? item.category;

    return (
      <Link
        ref={ref}
        href={`/eft/items/item/${item.normalizedName}`}
        className={`group block border-b border-lines-hover transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--color-card-menu)_30%,transparent)] active:bg-[color-mix(in_srgb,var(--color-card-menu)_30%,transparent)] ${className}`}
        {...props}
      >
        {/* ─── КАРТОЧКА (узкий контейнер) ─── */}
        <div className="flex flex-col gap-3 p-3 @2xl/items-table:hidden">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover transition-colors duration-300 group-active:border-(--primary)"
              style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
            >
              <Image src={item.iconLink} alt={item.shortName} fill sizes="48px" className="object-contain p-1" loading="lazy" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-blender-medium uppercase tracking-widest text-text-primary transition-colors group-active:text-(--primary)" title={item.name}>
                {item.shortName}
              </span>
              <span className="truncate text-xs text-text-secondary font-blender-book" title={item.name}>
                {item.name}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Покупка" value={buyPrice} tone="default" />
            <StatTile label="Продажа" value={sellPrice} tone="positive" />
            <StatTile label="Выг/слот" value={profitPerSlot} tone="accent" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <SpecChip label="Кат." value={categoryLabel} />
            <SpecChip label="Размер" value={`${item.gridWidth || 1}×${item.gridHeight || 1}`} />
          </div>
        </div>

        {/* ─── СТРОКА (широкий контейнер) ─── */}
        <div className={`hidden items-center gap-2 p-3 @2xl/items-table:grid ${ITEM_ROW_TEMPLATE}`}>
          {/* Иконка + название */}
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-lines-hover transition-colors duration-300 group-hover:border-(--primary)"
              style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
            >
              <Image src={item.iconLink} alt={item.shortName} fill sizes="48px" className="object-contain p-1" loading="lazy" />
            </div>
            <div className="flex min-w-0 flex-col">
              <h3 className="truncate text-sm font-blender-medium uppercase tracking-widest text-text-primary transition-colors group-hover:text-(--primary)" title={item.name}>
                {item.shortName}
              </h3>
              <span className="truncate text-xs text-text-secondary font-blender-book" title={item.name}>
                {item.name}
              </span>
            </div>
          </div>

          {/* Категория */}
          <div className="min-w-0">
            <span className="inline-block truncate rounded border border-lines-hover bg-(--color-base) px-2 py-1 font-blender-medium text-type-caption uppercase text-text-muted">
              {categoryLabel}
            </span>
          </div>

          {/* Характеристики (метрики) — с @4xl */}
          <div className="hidden flex-wrap items-center gap-2 @4xl/items-table:flex">
            <ItemMetrics item={item} />
          </div>

          {/* Размер — с @3xl */}
          <div className="hidden @3xl/items-table:block">
            <ItemGridSize width={item.gridWidth || 1} height={item.gridHeight || 1} />
          </div>

          {/* Покупка */}
          <PriceCell value={buyPrice} tone="default" emptyLabel="Нет в продаже" />
          {/* Продажа */}
          <PriceCell value={sellPrice} tone="positive" emptyLabel="Недоступно" />
          {/* Выгода / Слот */}
          <PriceCell value={profitPerSlot} tone="accentHover" emptyLabel="—" emptyPlain />
        </div>
      </Link>
    );
  }),
);

type StatTone = "default" | "positive" | "accent";
const STAT_TONE_CLASS: Record<StatTone, string> = {
  default: "text-text-primary",
  positive: "text-nvg-green",
  accent: "text-(--primary)",
};

function StatTile({ label, value, tone }: { label: string; value: number; tone: StatTone }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xs border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] px-2 py-1.5">
      <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{label}</span>
      {value > 0 ? (
        <span className={`font-blender-medium text-xs ${STAT_TONE_CLASS[tone]}`} title={`${value.toLocaleString("ru-RU")} ₽`}>
          {formatCompactNumber(value)} ₽
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-type-caption text-text-muted">
          <MinusCircle className="h-3 w-3 shrink-0" />—
        </span>
      )}
    </div>
  );
}

function SpecChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-xs border border-lines-hover/60 px-1.5 py-0.5">
      <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{label}</span>
      <span className="font-blender-medium text-xs text-text-primary">{value}</span>
    </span>
  );
}

type PriceTone = "default" | "positive" | "accentHover";
const PRICE_TONE_CLASS: Record<PriceTone, string> = {
  default: "text-text-primary",
  positive: "text-nvg-green",
  accentHover: "text-text-primary transition-colors group-hover:text-(--primary)",
};
const PRICE_UNDERLINE: Record<PriceTone, string> = {
  default: "border-text-muted/50",
  positive: "border-nvg-green/30",
  accentHover: "border-text-muted/50",
};

function PriceCell({
  value,
  tone,
  emptyLabel,
  emptyPlain = false,
}: {
  value: number;
  tone: PriceTone;
  emptyLabel: string;
  emptyPlain?: boolean;
}) {
  return (
    <div className="text-right">
      <span className={`whitespace-nowrap font-blender-medium text-xs ${PRICE_TONE_CLASS[tone]}`}>
        {value > 0 ? (
          <span title={`${value.toLocaleString("ru-RU")} ₽`} className={`cursor-help border-b border-dotted ${PRICE_UNDERLINE[tone]}`}>
            {formatCompactNumber(value)} ₽
          </span>
        ) : emptyPlain ? (
          <span className="text-type-caption text-text-muted">{emptyLabel}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-type-caption text-text-muted">
            <MinusCircle className="h-3.5 w-3.5 shrink-0" />
            {emptyLabel}
          </span>
        )}
      </span>
    </div>
  );
}

const ItemMetrics = ({ item }: { item: TarkovItem }) => {
  switch (item.category) {
    case "armor":
      return (
        <>
          <Badge color={getArmorClassColor(item.armorClass!)} label={`Класс ${item.armorClass}`} iconClass={`icon-eft-armor-class-${item.armorClass}`} iconSizeClass="w-5.5 h-5.5" />
          <Badge color="gray" label={`Прочн: ${item.durability}/${item.maxDurability}`} title="Максимальная прочность" />
          {item.effectiveDurability && <Badge color="gray" label={`Эфф: ${item.effectiveDurability}`} title="Эффективная прочность" />}
          {item.repairability && <Badge color="gray" label={`Ремонт: ${item.repairability}`} title="Ремонтопригодность" />}
          {item.weight && <Badge color="gray" label={`${item.weight} кг`} title="Вес" />}
          {(item.speedPenalty && item.speedPenalty > 0) ? <Badge color="red" label={`Скор: -${item.speedPenalty}%`} title="Штраф скорости (Движение)" /> : null}
          {(item.turnPenalty && item.turnPenalty > 0) ? <Badge color="red" label={`Повор: -${item.turnPenalty}%`} title="Штраф поворота" /> : null}
          {(item.ergoPenalty && item.ergoPenalty > 0) ? <Badge color="red" label={`Эрго: -${item.ergoPenalty}`} title="Штраф эргономики" /> : null}
        </>
      );
    case "ammo": {
      const isFragBlocked = item.penetrationPower < 20;
      return (
        <>
          <Badge color="emerald" label={`Пробитие: ${item.penetrationPower}`} title="Бронепробиваемость" />
          <Badge color="red" label={`Урон: ${item.damage}`} title="Урон по телу" />
          <Badge
            color={isFragBlocked ? "gray" : "amber"}
            label={`Фрагм: ${isFragBlocked ? "Блок." : item.fragmentationChance + "%"}`}
            title={isFragBlocked ? "Фрагментация невозможна из-за пробития < 20" : "Шанс фрагментации"}
            isStrike={isFragBlocked}
          />
        </>
      );
    }
    case "weapon": {
      const controlIndex = Math.round(
        (item.convergence * 100) / ((item.verticalRecoil + item.horizontalRecoil) * 0.1 + item.recoilDispersion * 0.05),
      );
      return (
        <>
          <Badge color="gray" label={`Эрго: ${item.ergonomics}`} />
          <Badge color="gray" label={`Отдача: ${item.verticalRecoil}/${item.horizontalRecoil}`} />
          <Badge color="amber" label={`Индекс контроля: ${controlIndex}`} title={`Скрытые параметры: Конвергенция (${item.convergence}) / Дисперсия (${item.recoilDispersion})`} />
        </>
      );
    }
    case "headset":
      return (
        <>
          <Badge color="emerald" label={`Слух: +${Math.round((item.distanceModifier - 1) * 100)}%`} title="Множитель дистанции слуха" />
          <Badge color="gray" label={`Шум: ${item.ambientVolume}`} title="Громкость окружения (ветра/дождя)" />
        </>
      );
    default:
      return <span className="text-xs text-text-muted">—</span>;
  }
};
