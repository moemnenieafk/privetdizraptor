"use client";

import type { ReactNode } from 'react';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { useEftItemTile } from './context';

export function EftMedia({ children }: { children?: ReactNode }) {
  const { item } = useEftItemTile();

  return (
    <div className="relative mb-3 h-24 w-full">
      {/* Inner clip — overflow-hidden applied only here so absolute indicators & portal tooltips escape */}
      <div className="absolute inset-0 overflow-hidden rounded-sm border border-lines-hover">
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
      </div>

      {/* Ammo overlay: damage (top-left) + penetration (bottom-right) — outside clip */}
      {item.ammoOverlay && (
        <>
          <div className="absolute top-2 left-2 z-20 flex h-6 w-6 items-center justify-center rounded bg-red-500/20 outline-1 -outline-offset-1 outline-red-500/30 backdrop-blur-sm">
            <span className="font-blender-medium text-[10px] leading-none text-red-500">
              {item.ammoOverlay.damage}
            </span>
          </div>
          <div className="absolute bottom-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded bg-orange-400/20 outline-1 -outline-offset-1 outline-orange-400/30 backdrop-blur-sm">
            <span className="font-blender-medium text-[10px] leading-none text-orange-400">
              {item.ammoOverlay.penetration}
            </span>
          </div>
        </>
      )}

      {/* Zone A: corner indicators — passed as children, outside clip so tooltips aren't clipped */}
      {children}
    </div>
  );
}
