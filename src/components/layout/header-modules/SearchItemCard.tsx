"use client";

import Link from "next/link";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";
import { itemIconUrl } from "@/lib/item-icon";
import { getTraderPortraitPath } from "@/lib/item-indicators.util";
import { getCategoryIcon } from "@/lib/item-category";
import type { SearchItemResult } from "@/types/search";

interface SearchItemCardProps {
  item: SearchItemResult;
  onSelect: () => void;
}

const RUBLE_ICON = "/icons/eft/03-items/currency-ruble.svg";
const PER_SLOT_ICON = "/icons/eft/03-items/price-per-slot.svg";

// Строка цены: иконка (аватарка-картинка ИЛИ моно-маска) + значение.
// accent — выгодная цена (барахолка выгоднее торговца) → зелёный.
const PriceRow = ({
  icon,
  value,
  isImage,
  accent,
}: {
  icon: string | null;
  value: string;
  isImage?: boolean;
  accent?: boolean;
}) => (
  <div className="flex items-center gap-1.5">
    {icon && isImage ? (
      <img src={icon} alt="" className="h-4 w-4 shrink-0 rounded-xs object-cover" />
    ) : icon ? (
      <div
        className={`icon-mask h-3.5 w-3.5 shrink-0 ${accent ? "text-success" : "text-text-secondary"}`}
        style={{
          WebkitMaskImage: `url(${icon})`,
          maskImage: `url(${icon})`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        }}
      />
    ) : (
      <div className="h-4 w-4 shrink-0" />
    )}
    <span className={`font-blender-medium text-xs ${accent ? "text-success" : "text-text-primary"}`}>
      {value}
    </span>
  </div>
);

export const SearchItemCard = ({ item, onSelect }: SearchItemCardProps) => {
  const traderPortrait = item.traderSell
    ? getTraderPortraitPath(item.traderSell.vendorNormalizedName)
    : null;
  // Иконка категории из раздела «Предметы» (бартер уточняется по bsgCategoryId).
  const category = getCategoryIcon(item.types, item.bsgCategoryId);

  // Выгодная цена: подсвечиваем барахолку, когда она выгоднее лучшего торговца
  // (логика идентична EftItemTile/Pricing).
  const fleaSellProfitable =
    !!item.fleaSell && !!item.traderSell && item.fleaSell.price > item.traderSell.price;
  const fleaVpsProfitable =
    !!item.fleaSell && !!item.traderSell && item.fleaSell.perSlot > item.traderSell.perSlot;

  return (
    <Link
      href={`/eft/items/item/${item.normalizedName}`}
      onClick={onSelect}
      className="group/card flex w-full flex-col overflow-hidden rounded-md border border-lines-hover bg-linear-to-b from-card-menu to-(--color-base) transition-colors duration-200 hover:border-(--primary)"
    >
      {/* Шапка: shortName + иконка категории (из раздела «Предметы») */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-2 pt-1.5 pb-0.5">
        <span className="truncate font-blender-medium text-xs uppercase tracking-wider text-text-primary">
          {item.shortName}
        </span>
        <span
          aria-label={category?.label ?? "Категория"}
          title={category?.label}
          className={`${category?.iconClass ?? (category?.iconUrl ? "" : "icon-eft-items-equipment")} h-4 w-4 shrink-0 bg-text-muted mask-contain mask-center mask-no-repeat transition-colors group-hover/card:bg-(--primary)`}
          style={
            category?.iconUrl
              ? { WebkitMaskImage: `url(${category.iconUrl})`, maskImage: `url(${category.iconUrl})` }
              : undefined
          }
        />
      </div>

      {/* Изображение на подложке редкости — компактная высота, не растягиваем на всю карточку */}
      <div className="relative mx-2 mt-0.5 aspect-4/3 overflow-hidden rounded-sm border border-lines-hover">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
        />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]" />
        <img
          src={itemIconUrl(item.id)}
          alt={item.shortName}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-10 h-full w-full object-contain p-1.5 drop-shadow-lg transition-transform duration-300 group-hover/card:scale-105"
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

      {/* Две колонки цен — без разделителей */}
      <div className="grid shrink-0 grid-cols-2 gap-2 px-2 pt-1 pb-2">
        {/* ПРОДАЖА (лучший торговец) */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-type-micro font-blender-medium tracking-widest uppercase text-text-muted">
            Продажа
          </span>
          <PriceRow
            icon={traderPortrait ?? RUBLE_ICON}
            isImage={!!traderPortrait}
            value={item.traderSell ? `${formatCompactNumber(item.traderSell.price)} ₽` : "—"}
          />
          <PriceRow
            icon={PER_SLOT_ICON}
            value={item.traderSell ? `${formatCompactNumber(item.traderSell.perSlot)} ₽` : "—"}
          />
        </div>

        {/* БАРАХОЛКА */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-type-micro font-blender-medium tracking-widest uppercase text-text-muted">
            Барахолка
          </span>
          <PriceRow
            icon={RUBLE_ICON}
            accent={fleaSellProfitable}
            value={item.fleaSell ? `${formatCompactNumber(item.fleaSell.price)} ₽` : "—"}
          />
          <PriceRow
            icon={PER_SLOT_ICON}
            accent={fleaVpsProfitable}
            value={item.fleaSell ? `${formatCompactNumber(item.fleaSell.perSlot)} ₽` : "—"}
          />
        </div>
      </div>
    </Link>
  );
};
