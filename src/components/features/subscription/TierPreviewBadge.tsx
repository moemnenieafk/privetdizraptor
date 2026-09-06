'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useEntitlements } from './GatingProvider';

/**
 * Плашка «смотрю от лица тира». Без неё легко забыть, что включено превью, и принять
 * урезанный интерфейс за баг — а на общей боевой базе такая ошибка стоит дорого:
 * админ пойдёт «чинить» замок, который работает правильно.
 *
 * Ничего не рендерит в обычном режиме (previewTier === null), то есть для всех, кроме
 * админа с включённым превью.
 */
export function TierPreviewBadge() {
  const snapshot = useEntitlements();
  const preview = snapshot?.previewTier ?? null;
  if (!preview) return null;

  const name = snapshot?.tiers.find((t) => t.slug === preview)?.name ?? preview;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <Link
        href="/admin/billing"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-(--primary)/50 bg-[color-mix(in_srgb,var(--primary)_16%,var(--color-base))] px-4 py-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary) shadow-lg transition-colors hover:border-(--primary)"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Просмотр от лица: {name}
      </Link>
    </div>
  );
}
