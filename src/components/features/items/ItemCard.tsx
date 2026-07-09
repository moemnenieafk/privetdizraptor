import { forwardRef, type HTMLAttributes } from "react";
import Link from "next/link";
import { MinusCircle } from "lucide-react";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";

export type ItemCardStatTone = "default" | "positive" | "accent";

export interface ItemCardStat {
  label: string;
  /** Значение в ₽. 0 или меньше рендерится как прочерк. */
  value: number;
  tone?: ItemCardStatTone;
}

export interface ItemCardSpec {
  label: string;
  value: string;
}

export interface ItemCardProps extends HTMLAttributes<HTMLDivElement> {
  href: string;
  iconLink: string;
  shortName: string;
  name: string;
  backgroundColor?: string;
  /** Компактная раскладка: до 3 статов в ряд. */
  stats: ItemCardStat[];
  /** Профильные (нецены) характеристики — чипами под ценами. */
  specs?: ItemCardSpec[];
}

const TONE_CLASS: Record<ItemCardStatTone, string> = {
  default: "text-text-primary",
  positive: "text-nvg-green",
  accent: "text-(--primary)",
};

/**
 * Мобильная карточка предмета (card-reflow дата-таблиц на `<sm`).
 * Тап-таргет — вся карточка. Кормится из ItemsTable и ItemsCategoryClient.
 */
export const ItemCard = forwardRef<HTMLDivElement, ItemCardProps>(function ItemCard(
  { href, iconLink, shortName, name, backgroundColor, stats, specs, ...props },
  ref,
) {
  return (
    <div ref={ref} {...props} className="border-b border-lines-hover">
      <Link
        href={href}
        className="group flex flex-col gap-3 p-3 transition-colors duration-300 active:bg-[color-mix(in_srgb,var(--color-card-menu)_30%,transparent)]"
      >
        <div className="flex items-center gap-3">
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-lines-hover transition-colors duration-300 group-active:border-(--primary)"
            style={{ backgroundColor: getTarkovBackgroundColor(backgroundColor) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconLink} alt={shortName} loading="lazy" className="h-full w-full object-contain p-1" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span
              className="truncate text-sm font-blender-medium uppercase tracking-widest text-text-primary transition-colors group-active:text-(--primary)"
              title={name}
            >
              {shortName}
            </span>
            <span className="truncate text-xs text-text-secondary font-blender-book" title={name}>
              {name}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-0.5 rounded-xs border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] px-2 py-1.5"
            >
              <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
                {stat.label}
              </span>
              {stat.value > 0 ? (
                <span
                  className={`font-blender-medium text-xs ${TONE_CLASS[stat.tone ?? "default"]}`}
                  title={`${stat.value.toLocaleString("ru-RU")} ₽`}
                >
                  {formatCompactNumber(stat.value)} ₽
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-type-caption text-text-muted">
                  <MinusCircle className="h-3 w-3 shrink-0" />—
                </span>
              )}
            </div>
          ))}
        </div>

        {specs && specs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {specs.map((spec) => (
              <span
                key={spec.label}
                className="inline-flex items-center gap-1 rounded-xs border border-lines-hover/60 px-1.5 py-0.5"
              >
                <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">
                  {spec.label}
                </span>
                <span className="font-blender-medium text-xs text-text-primary">{spec.value}</span>
              </span>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
});
