"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useItemsStore } from '@/store/useItemsStore';

/**
 * Возврат в каталог: ведёт в последний просмотренный раздел (из стора) с фокусом
 * на текущий предмет (?focus=<id>). Fallback — корневая база предметов.
 */
export function CatalogBackLink({ focusId }: { focusId: string }) {
  const returnPath = useItemsStore((s) => s.catalogReturnPath);
  const base = returnPath ?? '/eft/items';
  const sep = base.includes('?') ? '&' : '?';

  return (
    <Link
      href={`${base}${sep}focus=${encodeURIComponent(focusId)}`}
      className="inline-flex items-center text-xs uppercase tracking-widest font-blender-medium text-text-muted hover:text-(--primary) transition-colors"
    >
      <ArrowLeft className="w-4 h-4 mr-2" /> База предметов
    </Link>
  );
}
