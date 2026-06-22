"use client";

import React from 'react';
import Link from 'next/link';
import { EftItemTileContext } from './context';
import { EftHeader } from './Header';
import { EftMedia } from './Media';
import { EftName } from './Name';
import { EftIndicator } from './Indicator';
import { EftPricing } from './Pricing';
import type { EftItemData } from './types';

interface EftRootProps {
  item: EftItemData;
  categorySlug?: string;
  /** DOM id для скролл-якоря при возврате со страницы предмета. */
  anchorId?: string;
  /** Подсветка плитки (визуальный фокус после возврата). */
  highlighted?: boolean;
  children: React.ReactNode;
}

function EftRoot({ item, categorySlug, anchorId, highlighted, children }: EftRootProps) {
  return (
    <EftItemTileContext.Provider value={{ item, categorySlug }}>
      <Link
        id={anchorId}
        href={`/eft/items/item/${item.normalizedName}`}
        className={`group flex w-full scroll-mt-32 flex-col cursor-pointer rounded-lg border bg-card-menu p-4 transition-all duration-300 ease-out hover:border-(--primary) hover:shadow-[0_6px_28px_rgba(0,0,0,0.45)] ${
          highlighted
            ? 'border-(--primary) ring-2 ring-(--primary) shadow-[0_0_28px_color-mix(in_srgb,var(--primary)_45%,transparent)]'
            : 'border-lines-hover'
        }`}
      >
        {children}
      </Link>
    </EftItemTileContext.Provider>
  );
}

export const EftItemTile = {
  Root:      EftRoot,
  Header:    EftHeader,
  Media:     EftMedia,
  Name:      EftName,
  Indicator: EftIndicator,
  Pricing:   EftPricing,
} as const;
