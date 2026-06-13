"use client";

import Image from "next/image";
import Link from "next/link";
import { TarkovItem } from "@/types/tarkov-items";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";

interface SearchItemCardProps {
  item: TarkovItem;
  onSelect: () => void;
}

export const SearchItemCard = ({ item, onSelect }: SearchItemCardProps) => {
  return (
    <Link href={`/eft/items/item/${item.id}`} onClick={onSelect}>
      <div className="flex items-center gap-3 rounded p-2 transition-colors duration-200 hover:bg-card-menu">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-[#444] bg-gradient-to-b from-[#2c2c2c] to-[#121212] shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Цветная подложка редкости */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }} 
          />
          <Image src={item.iconLink} alt={item.shortName} width={40} height={40} className="relative z-10 object-contain p-1" />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="truncate font-blender-medium text-sm uppercase tracking-wider text-text-primary">
            {item.shortName}
          </span>
          <span className="truncate font-mono text-xs text-text-muted">
          {item.fleaPrice ? (
            <span title={`${item.fleaPrice.toLocaleString("ru-RU")} ₽`} className="cursor-help border-b border-dotted border-current/50">
              {formatCompactNumber(item.fleaPrice)} ₽
            </span>
          ) : (
            "Нет данных"
          )}
          </span>
        </div>
      </div>
    </Link>
  );
};