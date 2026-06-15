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
  children: React.ReactNode;
}

function EftRoot({ item, categorySlug, children }: EftRootProps) {
  return (
    <EftItemTileContext.Provider value={{ item, categorySlug }}>
      <Link
        href={`/eft/items/item/${item.normalizedName}`}
        className="group flex w-[254px] flex-col cursor-pointer rounded-lg border border-lines-hover bg-card-menu p-4 transition-all duration-300 ease-out hover:border-(--primary) hover:scale-[1.02]"
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
