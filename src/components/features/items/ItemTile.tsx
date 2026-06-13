"use client";

import React from "react";
import Link from "next/link";
import { PackageX } from "lucide-react";
import { Badge } from "@/components/ui/kit";
import { Badge as SemanticBadge, getArmorClassColor } from "@/components/features/items/Badge";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";

export interface ItemTileProps {
  item: {
    id: string;
    name: string;
    shortName: string;
    width: number;
    height: number;
    backgroundColor?: string;
    image512pxLink: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties?: any;
    eco: {
      bestSell: { price: number; vendor?: { name: string; normalizedName?: string } };
      minPrice: number;
      vps: number;
    };
  };
  categorySlug?: string;
}

export function ItemTile({ item, categorySlug }: ItemTileProps) {
  return (
    <Link href={`/eft/items/item/${item.id}`} className="tactical-card-base group p-4 flex flex-col hover:border-[var(--primary)] cursor-pointer">
      {/* Хедер карточки */}
      <div className="flex justify-between items-start mb-4">
        <Badge variant="default" className="group-hover:bg-primary/10 group-hover:text-[var(--primary)] group-hover:border-[var(--primary)] transition-colors">
          {item.shortName}
        </Badge>
        <span className="font-mono text-[10px] text-text-muted">{item.width}x{item.height} Слот</span>
      </div>
      
      {/* Изображение */}
      <div className="relative w-full h-24 mb-4 flex items-center justify-center bg-gradient-to-b from-[#2c2c2c] to-[#121212] border border-[#444] shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden">
        {/* Цветная подложка редкости */}
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }} 
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={`/images/items/eft/${item.id}.webp`} 
          alt={item.name} 
          className="absolute inset-0 z-10 w-full h-full p-2 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300" 
          onError={(e) => {
            if (!e.currentTarget.dataset.triedApi) {
              e.currentTarget.dataset.triedApi = 'true';
              e.currentTarget.src = item.image512pxLink || '/images/placeholder.webp';
            } else if (!e.currentTarget.dataset.triedPlaceholder) {
              e.currentTarget.dataset.triedPlaceholder = 'true';
              e.currentTarget.src = '/images/placeholder.webp';
            }
          }}
        />
      </div>
      
      {/* Название */}
      <h3 className="font-blender-medium text-[16px] uppercase text-text-primary leading-tight mb-3 truncate" title={item.name}>
        {item.name}
      </h3>

      {/* Специфичные характеристики (Патроны) */}
      {categorySlug === 'ammo' && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <SemanticBadge color="red" label={`Урон: ${item.properties?.damage || 0}`} />
          <SemanticBadge color="emerald" label={`Проб: ${item.properties?.penetrationPower || 0}`} />
        </div>
      )}
      
      {/* Специфичные характеристики (Броня, Шлемы, Разгрузки) */}
      {(categorySlug === 'armor' || categorySlug === 'helmets' || categorySlug === 'rigs') && item.properties?.class && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <SemanticBadge 
            color={getArmorClassColor(item.properties.class)} 
            label={`Класс ${item.properties.class}`} 
            iconClass={`icon-eft-armor-class-${item.properties.class}`} 
            iconSizeClass="w-[22px] h-[22px]" 
          />
          {item.properties.durability && <SemanticBadge color="gray" label={`Прочность: ${item.properties.durability}`} />}
        </div>
      )}

      {/* Экономика */}
      <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-lines-hover">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-blender-medium tracking-widest text-[var(--color-text-muted)]">Продажа</span>
            {item.eco.bestSell.price > 0 ? <span className="font-mono text-sm font-bold text-[var(--color-text-primary)]">{item.eco.bestSell.price.toLocaleString('ru-RU')} ₽</span> : <div className="flex items-center gap-1 text-[var(--color-text-muted)] opacity-50 pt-0.5"><PackageX className="w-3 h-3" /><span className="font-blender-medium text-[10px] uppercase tracking-widest">Нет</span></div>}
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase font-blender-medium tracking-widest text-[var(--color-text-muted)]">Покупка</span>
            {item.eco.minPrice > 0 ? <span className="font-mono text-sm font-bold text-[var(--color-nvg-green)]">{item.eco.minPrice.toLocaleString('ru-RU')} ₽</span> : <div className="flex items-center justify-end gap-1 text-[var(--color-text-muted)] opacity-50 pt-0.5"><PackageX className="w-3 h-3" /><span className="font-blender-medium text-[10px] uppercase tracking-widest">Нет</span></div>}
          </div>
        </div>
        
        {/* Выгода на слот */}
        <div className="mt-1 flex items-center justify-between rounded bg-[color-mix(in_srgb,var(--color-card-menu)_40%,transparent)] px-2 py-1.5 border border-lines-hover/50">
          <span className="text-[10px] uppercase font-blender-medium tracking-widest text-[var(--color-text-muted)]">Цена / Слот</span>
          {item.eco.vps > 0 ? (
            <span className={`font-mono text-xs font-bold ${item.eco.vps > 10000 ? 'text-[var(--color-nvg-green)]' : item.eco.vps > 5000 ? 'text-yellow-500' : 'text-[var(--color-text-primary)]'}`}>
              {item.eco.vps.toLocaleString('ru-RU')} ₽
            </span>
          ) : (
            <div className="flex items-center gap-1 text-[var(--color-text-muted)] opacity-50">
              <PackageX className="w-3 h-3" />
              <span className="font-blender-medium text-[9px] uppercase tracking-widest">Нет</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}