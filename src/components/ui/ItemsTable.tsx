import React, { memo } from "react";
import { ItemGridSize } from "./ItemGridSize";
import { RarityBadge, type RarityTier } from "./RarityBadge";
import { Badge, getArmorClassColor } from "@/components/features/items/Badge";
import { formatCompactNumber } from "@/lib/formatters";

export interface TableItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string;
  width: number;
  height: number;
  basePrice: number;
  avg24hPrice?: number;
  rarity?: RarityTier;
  armorClass?: number;
}

interface ItemsTableProps {
  items: TableItem[];
  className?: string;
}

export const ItemsTable = memo(function ItemsTable({ items, className = "" }: ItemsTableProps) {
  if (!items.length) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-lg border border-[var(--color-lines-hover)] bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] p-12 text-center ${className}`}>
        <span className="font-blender-medium text-lg uppercase tracking-widest text-[var(--color-text-muted)]">
          Предметы не найдены
        </span>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-lg border border-[var(--color-lines-hover)] bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] ${className}`}>
      <table className="w-full text-left text-sm text-[var(--color-text-primary)] font-blender-book">
        <thead className="bg-[color-mix(in_srgb,var(--color-card-menu)_50%,transparent)] text-[10px] font-blender-medium uppercase tracking-widest text-[var(--color-text-muted)]">
          <tr>
            <th className="px-4 py-3 w-[180px] max-w-[180px] sm:w-[250px] sm:max-w-[250px] md:w-[300px] md:max-w-[300px] lg:w-[400px] lg:max-w-[400px]">Предмет</th>
            <th className="px-4 py-3 text-center">Размер</th>
            <th className="px-4 py-3 text-right">Цена/Слот</th>
            <th className="px-4 py-3 text-right">Средняя Цена</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-lines-hover)]">
          {items.map((item) => {
            const effectivePrice = item.avg24hPrice || item.basePrice;
            const profitPerSlot = Math.round(effectivePrice / (item.width * item.height));

            return (
              <tr
                key={item.id}
                className="group transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--color-card-menu)_30%,transparent)]"
              >
                <td className="px-4 py-3 w-[180px] max-w-[180px] sm:w-[250px] sm:max-w-[250px] md:w-[300px] md:max-w-[300px] lg:w-[400px] lg:max-w-[400px]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-[var(--color-lines-hover)] bg-[var(--color-base)] p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.iconLink} alt={item.shortName} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex min-w-0 w-full flex-col gap-1 overflow-hidden">
                      <span className="block w-full truncate font-blender-medium text-[15px] uppercase tracking-wide transition-colors group-hover:text-[var(--primary)]" title={item.name}>
                        {item.name}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 overflow-hidden">
                        <span className="truncate text-xs text-[var(--color-text-muted)]" title={item.shortName}>{item.shortName}</span>
                        {item.rarity && <RarityBadge rarity={item.rarity} />}
                    {item.armorClass && (
                      <Badge 
                        color={getArmorClassColor(item.armorClass)} 
                        label={`Класс ${item.armorClass}`} 
                        iconClass={`icon-eft-armor-class-${item.armorClass}`} 
                        iconSizeClass="w-[22px] h-[22px]"
                      />
                    )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle">
                  <div className="flex justify-center">
                    <ItemGridSize width={item.width} height={item.height} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-[var(--color-nvg-green)]">
                  <span title={`${profitPerSlot.toLocaleString("ru-RU")} ₽`} className="cursor-help border-b border-dotted border-[var(--color-nvg-green)]/30">
                    {formatCompactNumber(profitPerSlot)} ₽
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">
                  <span title={`${effectivePrice.toLocaleString("ru-RU")} ₽`} className="cursor-help border-b border-dotted border-[var(--color-text-muted)]/50">
                    {formatCompactNumber(effectivePrice)} ₽
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});