"use client";

import React from "react";
import Link from "next/link";
import { PackageX, Coins } from "lucide-react";
import { Badge } from "@/components/ui/kit";
import { Badge as SemanticBadge, getArmorClassColor } from "@/components/features/items/Badge";
import { ItemGridSize } from "@/components/ui/ItemGridSize";
import { getTarkovBackgroundColor } from "@/lib/tarkov-colors";
import { formatCompactNumber } from "@/lib/formatters";

interface Vendor { name: string; normalizedName?: string }

export interface ItemTileProps {
  item: {
    id: string;
    normalizedName: string;
    name: string;
    shortName: string;
    width?: number;
    height?: number;
    backgroundColor?: string;
    image512pxLink?: string;
    types?: string[];
     
    properties?: any;
    eco: {
      bestSell: { price: number; vendor?: Vendor };
      bestBuy?: { price?: number; priceRUB?: number; currency?: string; vendor?: Vendor };
      minPrice: number;
      vps: number;
      // Extended — available when rendered from ItemsCategoryClient
      fleaSell?: { price: number; vendor: Vendor };
      bestTraderSell?: { price: number; vendor: Vendor };
      fleaBuy?: { price: number; vendor: Vendor };
    };
  };
  categorySlug?: string;
}

function VendorAvatar({ vendor }: { vendor?: Vendor }) {
  if (!vendor || vendor.name === '-') return <span className="h-4 w-4 shrink-0" />;
   
  return <img
    src={`/images/traders/eft/${vendor.normalizedName || vendor.name.toLowerCase()}.webp`}
    alt={vendor.name}
    title={vendor.name}
    className="h-4 w-4 shrink-0 rounded-xs object-cover opacity-80"
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />;
}

export const ItemTile = React.memo(function ItemTile({ item, categorySlug }: ItemTileProps) {
  const { eco } = item;
  const w = item.width || 1;
  const h = item.height || 1;

  // Determine sell prices
  const traderSell = eco.bestTraderSell ?? (
    eco.bestSell.vendor?.name !== 'Flea Market' ? eco.bestSell : undefined
  );
  const fleaSell = eco.fleaSell ?? (
    eco.bestSell.vendor?.name === 'Flea Market' || eco.bestSell.vendor?.normalizedName === 'flea-market'
      ? eco.bestSell
      : undefined
  );
  const bestSellPrice = fleaSell?.price || eco.bestSell.price || 0;
  const traderSellPrice = traderSell?.price || 0;

  // Buy price
  const buyPrice = eco.minPrice || 0;
  const buyIsFlea = eco.fleaBuy != null || eco.bestBuy?.vendor?.normalizedName === 'flea-market';

  return (
    <Link
      href={`/eft/items/item/${item.normalizedName}`}
      className="group flex flex-col cursor-pointer rounded-lg border border-lines-hover bg-card-menu p-4 transition-all duration-300 ease-out hover:border-(--primary) hover:scale-[1.02]"
    >
      {/* Хедер: shortName + ItemGridSize */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <Badge
          variant="default"
          className="shrink-0 group-hover:border-(--primary) group-hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] group-hover:text-(--primary) transition-colors"
        >
          {item.shortName}
        </Badge>
        <div className="shrink-0">
          <ItemGridSize width={w} height={h} showLabel />
        </div>
      </div>

      {/* Изображение */}
      <div className="relative mb-4 flex h-24 w-full items-center justify-center overflow-hidden rounded-sm border border-lines-hover bg-linear-to-b from-lines-hover to-(--color-base) shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">

        {/* Урон / Пробитие (патроны) */}
        {categorySlug === 'ammo' && (
          <>
            <div className="absolute bottom-1.5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
              <div className="rounded-xs bg-red-950/80 px-1.5 py-0.5 backdrop-blur-sm">
                <span className="font-blender-medium text-xs text-red-400">{item.properties?.damage ?? 0}</span>
              </div>
              <div className="rounded-xs bg-emerald-950/80 px-1.5 py-0.5 backdrop-blur-sm">
                <span className="font-blender-medium text-xs text-emerald-400">{item.properties?.penetrationPower ?? 0}</span>
              </div>
            </div>
          </>
        )}

        {/* Бейдж "Бартер" */}
        {item.types?.includes("barter") && (
          <div
            className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1 rounded-xs border border-lines-hover/50 bg-(--color-base)/80 px-1.5 py-0.5 shadow-sm backdrop-blur-md"
            title="Получение путем обмена (Бартер)"
          >
            <span className="icon-eft-prog-barter h-2.5 w-2.5 bg-nvg-green mask-contain mask-center mask-no-repeat" />
            <span className="mt-px font-blender-medium text-[8px] uppercase leading-none tracking-widest text-nvg-green">Бартер</span>
          </div>
        )}

        {/* Цветная подложка редкости */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
        />
        { }
        <img
          src={`/images/items/eft/${item.id}.webp`}
          alt={item.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-10 h-full w-full object-contain p-2 drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
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
      <h3
        className="mb-3 truncate font-blender-medium text-base uppercase leading-tight text-text-primary"
        title={item.name}
      >
        {item.name}
      </h3>

      {/* Специфичные характеристики (Броня, Шлемы, Разгрузки) */}
      {(categorySlug === 'armor' || categorySlug === 'helmets' || categorySlug === 'rigs') && item.properties?.class && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <SemanticBadge
            color={getArmorClassColor(item.properties.class)}
            label={`Класс ${item.properties.class}`}
            iconClass={`icon-eft-armor-class-${item.properties.class}`}
            iconSizeClass="w-[22px] h-[22px]"
          />
          {item.properties.durability && (
            <SemanticBadge color="gray" label={`${item.properties.durability} HP`} />
          )}
        </div>
      )}

      {/* ─── Экономика (3 строки) ─── */}
      <div className="mt-auto flex flex-col gap-1 border-t border-lines-hover pt-3">

        {/* Строка 1: Продать */}
        <div className="flex items-center gap-2">
          <VendorAvatar vendor={traderSell?.vendor} />
          {/* Trader sell (small, muted) */}
          {traderSellPrice > 0 && fleaSell && (
            <span className="font-blender-medium text-[10px] text-text-muted">
              {formatCompactNumber(traderSellPrice)} ₽
            </span>
          )}
          {/* Best/Flea sell (large, prominent) */}
          {bestSellPrice > 0 ? (
            <span
              title={`${bestSellPrice.toLocaleString('ru-RU')} ₽`}
              className="ml-auto cursor-help font-blender-medium text-sm text-(--primary)"
            >
              {formatCompactNumber(bestSellPrice)} ₽
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-text-muted/50">
              <PackageX className="h-3 w-3" />
              <span className="font-blender-medium text-[10px] uppercase tracking-widest">Нет</span>
            </span>
          )}
        </div>

        {/* Строка 2: Купить */}
        <div className="flex items-center gap-2">
          {buyIsFlea
            ? <Coins className="h-4 w-4 shrink-0 text-yellow-500/70" />
            : <VendorAvatar vendor={eco.bestBuy?.vendor} />
          }
          {buyPrice > 0 ? (() => {
            const isUSD = eco.bestBuy?.currency === 'USD' && eco.bestBuy?.price;
            return (
              <span
                title={`${buyPrice.toLocaleString('ru-RU')} ₽`}
                className="cursor-help font-blender-medium text-[11px] text-nvg-green"
              >
                {isUSD ? `$${formatCompactNumber(eco.bestBuy!.price!)}` : `${formatCompactNumber(buyPrice)} ₽`}
              </span>
            );
          })() : (
            <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted/60">
              Нельзя купить
            </span>
          )}
        </div>

        {/* Строка 3: Цена / Слот */}
        <div className="mt-0.5 flex items-center justify-between rounded border border-lines-hover/50 bg-[color-mix(in_srgb,var(--color-card-menu)_40%,transparent)] px-2 py-1.5">
          <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
            Цена / Слот
          </span>
          {eco.vps > 0 ? (
            <span
              title={`${eco.vps.toLocaleString('ru-RU')} ₽`}
              className={`cursor-help font-blender-medium text-xs ${
                eco.vps > 10000 ? 'text-nvg-green' : eco.vps > 5000 ? 'text-yellow-500' : 'text-text-primary'
              }`}
            >
              {formatCompactNumber(eco.vps)} ₽
            </span>
          ) : (
            <span className="flex items-center gap-1 text-text-muted/50">
              <PackageX className="h-3 w-3" />
              <span className="font-blender-medium text-[9px] uppercase tracking-widest">Нет</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});
