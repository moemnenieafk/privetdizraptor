"use client";

import { X } from 'lucide-react';
import Link from 'next/link';
import { useItemsStore } from '@/store/useItemsStore';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { formatCompactNumber } from '@/lib/formatters';
import type { CategoryItem } from '@/app/eft/items/[...category]/ItemsCategoryClient';
import { itemIconUrl } from '@/lib/item-icon';

interface CompareDrawerProps {
  items: CategoryItem[];
  categorySlug?: string;
  getSpecs?: (item: CategoryItem) => { label: string; value: string }[];
}

export function CompareDrawer({ items, categorySlug, getSpecs }: CompareDrawerProps) {
  const compareIds = useItemsStore((s) => s.compareIds);
  const clearCompare = useItemsStore((s) => s.clearCompare);
  const toggleCompare = useItemsStore((s) => s.toggleCompare);

  const visible = compareIds.length >= 2;
  const compareItems = compareIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is CategoryItem => item !== undefined);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-hidden={!visible}
    >
      <div className="mx-auto max-w-275 border-t border-lines-hover bg-[color-mix(in_srgb,var(--color-base)_94%,transparent)] backdrop-blur-md shadow-[0_-8px_40px_rgba(0,0,0,0.7)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-lines-hover px-4 py-2.5">
          <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary">
            Сравнение {compareIds.length} предметов
          </span>
          <button
            onClick={clearCompare}
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:text-(--primary)"
            aria-label="Закрыть сравнение"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items columns */}
        <div className="flex gap-px overflow-x-auto">
          {compareItems.map((item) => {
            const bestSell = item.sellFor?.reduce<{ price: number; vendor: string } | null>(
              (best, curr) => {
                const p = curr.priceRUB ?? curr.price;
                return !best || p > best.price ? { price: p, vendor: curr.vendor.name } : best;
              },
              null
            );
            const fleaBuy = item.buyFor?.find(
              (b) => b.vendor.name === 'Flea Market' || b.vendor.normalizedName === 'flea-market'
            );

            return (
              <div
                key={item.id}
                className="flex min-w-36 flex-1 flex-col gap-2 p-3"
              >
                {/* Image */}
                <Link href={`/eft/items/item/${item.normalizedName}`} className="group block">
                  <div
                    className="relative h-16 w-full overflow-hidden rounded-xs border border-lines-hover"
                    style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
                  >
                    <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.7)]" />
                    <img
                      src={itemIconUrl(item.id)}
                      alt={item.name}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-contain p-1 transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        const t = e.currentTarget;
                        if (!t.dataset.tried) {
                          t.dataset.tried = 'true';
                          t.src = item.image512pxLink || '/images/placeholder.webp';
                        }
                      }}
                    />
                  </div>
                </Link>

                {/* Name */}
                <div className="min-w-0">
                  <p className="truncate font-blender-medium text-type-caption uppercase tracking-wider text-text-primary">
                    {item.shortName}
                  </p>
                </div>

                {/* Профильные характеристики категории */}
                <div className="space-y-0.5">
                  {(getSpecs?.(item) ?? []).map((sp) => (
                    <div key={sp.label} className="flex items-center justify-between gap-1">
                      <span className="font-blender-book text-type-caption text-text-muted">{sp.label}</span>
                      <span className="truncate font-blender-medium text-type-caption text-text-secondary">{sp.value}</span>
                    </div>
                  ))}
                  {bestSell && (
                    <div className="flex items-center justify-between gap-1 border-t border-lines-hover/50 pt-0.5">
                      <span className="font-blender-book text-type-caption text-text-muted">Продажа</span>
                      <span className="font-blender-medium text-type-caption text-(--primary)">
                        {formatCompactNumber(bestSell.price)} ₽
                      </span>
                    </div>
                  )}
                  {fleaBuy && (
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-blender-book text-type-caption text-text-muted">Барахолка</span>
                      <span className="font-blender-medium text-type-caption text-text-secondary">
                        {formatCompactNumber(fleaBuy.priceRUB ?? fleaBuy.price)} ₽
                      </span>
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <button
                  onClick={() => toggleCompare(item.id, categorySlug ?? '')}
                  className="mt-auto font-blender-medium text-type-caption uppercase tracking-wider text-text-muted transition-colors hover:text-red-400"
                >
                  Убрать
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
