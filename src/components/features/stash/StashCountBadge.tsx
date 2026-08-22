'use client';

import { Boxes } from 'lucide-react';
import { useInventoryStore } from '@/store/useInventoryStore';

/**
 * Ненавязчивый бейдж «в схроне N»: подсказывает, сколько единиц предмета уже лежит
 * в едином пуле владения (ownedItems). При N===0 не рендерится (чище, чем «0»).
 * className прокидывается на корень — для позиционирования вызывающим.
 */
export function StashCountBadge({ itemId, className }: { itemId: string; className?: string }) {
  const count = useInventoryStore((s) => s.ownedItems[itemId] ?? 0);

  if (count === 0) return null;

  return (
    <span
      title={`В схроне: ${count}`}
      className={`inline-flex items-center gap-1 rounded border border-lines-hover bg-card-menu px-1.5 py-0.5 font-blender-medium text-type-micro tabular-nums text-text-muted ${className ?? ''}`}
    >
      <Boxes className="size-3 shrink-0" aria-hidden />
      <span>{count}</span>
    </span>
  );
}
