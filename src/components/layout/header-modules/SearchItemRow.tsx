"use client";

import Link from "next/link";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";
import { itemIconUrl } from "@/lib/item-icon";
import { getTraderPortraitPath } from "@/lib/item-indicators.util";
import { getCategoryIcon } from "@/lib/item-category";
import type { SearchItemResult } from "@/types/search";

interface SearchItemRowProps {
  item: SearchItemResult;
  onSelect: () => void;
}

const RUBLE_ICON = "/icons/eft/03-items/currency-ruble.svg";

// Компактная ячейка цены для строки: подпись сверху, иконка + значение снизу.
// accent — барахолка выгоднее лучшего торговца → зелёный.
const PriceCell = ({
  label,
  icon,
  value,
  isImage,
  accent,
}: {
  label: string;
  icon: string | null;
  value: string;
  isImage?: boolean;
  accent?: boolean;
}) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-type-micro font-blender-medium tracking-widest uppercase text-text-muted">
      {label}
    </span>
    <div className="flex items-center gap-1">
      {icon && isImage ? (
        <img src={icon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-xs object-cover" />
      ) : icon ? (
        <div
          className={`icon-mask h-3 w-3 shrink-0 ${accent ? "text-success" : "text-text-secondary"}`}
          style={{
            WebkitMaskImage: `url(${icon})`,
            maskImage: `url(${icon})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
          }}
        />
      ) : (
        <div className="h-3.5 w-3.5 shrink-0" />
      )}
      <span
        className={`truncate font-blender-medium text-xs ${accent ? "text-success" : "text-text-primary"}`}
      >
        {value}
      </span>
    </div>
  </div>
);

export const SearchItemRow = ({ item, onSelect }: SearchItemRowProps) => {
  const traderPortrait = item.traderSell
    ? getTraderPortraitPath(item.traderSell.vendorNormalizedName)
    : null;
  const category = getCategoryIcon(item.types, item.bsgCategoryId);

  const fleaSellProfitable =
    !!item.fleaSell && !!item.traderSell && item.fleaSell.price > item.traderSell.price;

  return (
    <Link
      href={`/eft/items/item/${item.normalizedName}`}
      onClick={onSelect}
      className="group/row flex items-center gap-3 rounded-md border border-lines-hover bg-linear-to-r from-card-menu to-(--color-base) px-2 py-1.5 transition-colors duration-200 hover:border-(--primary)"
    >
      {/* Иконка на подложке редкости — компактная, слева */}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-lines-hover">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
        />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]" />
        <img
          src={itemIconUrl(item.id)}
          alt={item.shortName}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-10 h-full w-full object-contain p-1 drop-shadow-md"
          onError={(e) => {
            const t = e.currentTarget;
            if (!t.dataset.triedApi) {
              t.dataset.triedApi = "true";
              t.src = item.gridImageLink || "/images/placeholder.webp";
            } else if (!t.dataset.triedPlaceholder) {
              t.dataset.triedPlaceholder = "true";
              t.src = "/images/placeholder.webp";
            }
          }}
        />
      </div>

      {/* Название + категория */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-blender-medium text-sm uppercase tracking-wider text-text-primary">
          {item.shortName}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`${category?.iconClass ?? (category?.iconUrl ? "" : "icon-eft-items-equipment")} h-3 w-3 shrink-0 bg-text-muted mask-contain mask-center mask-no-repeat`}
            style={
              category?.iconUrl
                ? { WebkitMaskImage: `url(${category.iconUrl})`, maskImage: `url(${category.iconUrl})` }
                : undefined
            }
          />
          <span className="truncate font-blender-book text-xs text-text-muted">
            {category?.label ?? item.name}
          </span>
        </div>
      </div>

      {/* Цены: торговец + барахолка, компактно справа */}
      <div className="flex shrink-0 items-center gap-3">
        <PriceCell
          label="Продажа"
          icon={traderPortrait ?? RUBLE_ICON}
          isImage={!!traderPortrait}
          value={item.traderSell ? `${formatCompactNumber(item.traderSell.price)} ₽` : "—"}
        />
        <PriceCell
          label="Барахолка"
          icon={RUBLE_ICON}
          accent={fleaSellProfitable}
          value={item.fleaSell ? `${formatCompactNumber(item.fleaSell.price)} ₽` : "—"}
        />
      </div>
    </Link>
  );
};
