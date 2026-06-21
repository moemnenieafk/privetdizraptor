"use client";

import Link from 'next/link';
import { Lock } from 'lucide-react';

export function ProLockTooltip({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      className="w-48 rounded-sm border border-amber-500/30 bg-card-menu p-3 shadow-xl"
      style={style}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Lock className="h-3 w-3 shrink-0 text-amber-500" />
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-amber-500">
          PRO Функция
        </span>
      </div>
      <p className="mb-2.5 font-blender-book text-type-caption leading-snug text-text-secondary">
        Данные крафта, бартера и заданий доступны с PRO-статусом.
      </p>
      <Link
        href="/account"
        onClick={(e) => e.stopPropagation()}
        className="block rounded-xs border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center font-blender-medium text-type-caption uppercase tracking-widest text-amber-400 transition-colors hover:bg-amber-500/20"
      >
        Активировать PRO
      </Link>
    </div>
  );
}
