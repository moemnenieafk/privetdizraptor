"use client";

import type { ReactNode } from 'react';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { useEftItemTile } from './context';

interface EftMediaProps {
  children?: ReactNode;
}

export function EftMedia({ children }: EftMediaProps) {
  const { item } = useEftItemTile();

  return (
    <div className="relative mb-3 h-24 w-full overflow-hidden rounded-sm border border-lines-hover">
      {/* Rarity tint */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: getTarkovBackgroundColor(item.backgroundColor) }}
      />
      {/* Inner shadow */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]" />

      {/* Item image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/images/items/eft/${item.id}.webp`}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 z-10 h-full w-full object-contain p-2 drop-shadow-lg transition-transform duration-300 group-hover:scale-105"
        onError={(e) => {
          const t = e.currentTarget;
          if (!t.dataset.triedApi) {
            t.dataset.triedApi = 'true';
            t.src = item.image512pxLink || '/images/placeholder.webp';
          } else if (!t.dataset.triedPlaceholder) {
            t.dataset.triedPlaceholder = 'true';
            t.src = '/images/placeholder.webp';
          }
        }}
      />

      {/* Indicators (z-20, rendered above image) */}
      {children}
    </div>
  );
}
