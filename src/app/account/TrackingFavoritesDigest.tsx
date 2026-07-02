'use client';

// Домен «Избранное» вкладки «Трекинг» — личный «прайс-борд»: предметы, отмеченные ★
// в каталоге (useFavoritesStore, localStorage), полноценными плитками EftItemTile
// с живыми ценами из НАШЕГО зеркала через GET /api/eft/prices?ids= (сервер ids
// избранного не знает). Загрузка — скелеты animate-pulse (канон: никаких спиннеров).
// Звезда в Header плитки — тот же стор: снятие ★ прямо тут убирает плитку живьём.
// Облачный синк избранного — отложен (см. заметку tracking-favorite-items).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, ArrowRight } from 'lucide-react';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { EftItemTile, type EftItemData } from '@/components/features/items/EftItemTile';
import { ResetControl } from '@/components/features/tracking/ResetControl';

// Метка-заголовок блока с линией (rule-micro-labels).
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
      <span className="h-px w-6 bg-lines-hover" />
      {children}
    </h3>
  );
}

function SkeletonTile() {
  return (
    <div className="w-full animate-pulse rounded-lg border border-lines-hover bg-card-menu p-4">
      <div className="mb-3 h-4 w-2/3 rounded-xs bg-lines-hover" />
      <div className="mb-3 h-30 w-full rounded-sm bg-lines-hover/60" />
      <div className="mb-3 h-4 w-1/2 rounded-xs bg-lines-hover" />
      <div className="h-10 w-full rounded-xs bg-lines-hover/60" />
    </div>
  );
}

export function TrackingFavoritesDigest() {
  // mounted-гард: persist-стор только на клиенте (иначе hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const favoriteIds = useFavoritesStore((s) => s.favoriteIds);
  const clearFavorites = useFavoritesStore((s) => s.clearFavorites);

  const idsKey = useMemo(() => (mounted ? [...favoriteIds].sort().join(',') : ''), [mounted, favoriteIds]);
  const [tiles, setTiles] = useState<EftItemData[] | null>(null);

  // Цены из нашего зеркала по ids избранного. Плитки уже загруженных предметов
  // не перезапрашиваем при снятии ★ — фильтруем локально; фетч только при появлении новых.
  useEffect(() => {
    if (!mounted) return;
    if (idsKey === '') {
      setTiles([]);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await fetch(`/api/eft/prices?ids=${idsKey}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { items: EftItemData[] };
        if (active) setTiles(json.items);
      } catch {
        if (active) setTiles([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [mounted, idsKey]);

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const visible = (tiles ?? []).filter((t) => favSet.has(t.id));
  const loading = mounted && favoriteIds.length > 0 && tiles === null;

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          Избранных: <span className="text-text-primary/70">{mounted ? favoriteIds.length : 0}</span>
        </span>
        <div className="flex items-center gap-2">
          <ResetControl
            buttonLabel="СБРОС ИЗБРАННОГО"
            buttonTitle="Очистить список избранных предметов"
            modalTitle="Подтверждение сброса избранного"
            onConfirm={clearFavorites}
          >
            <p>Вы действительно хотите очистить избранное?</p>
            <p>
              Все отмеченные ★ предметы будут убраны из списка. Прогресс заданий, убежища и
              достижений не затрагивается.
            </p>
          </ResetControl>
          <Link
            href="/eft/items"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-lines-hover px-2.5 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            Каталог
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <SectionLabel>Прайс-борд · цены из зеркала ЦТА</SectionLabel>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 max-sm:justify-items-center sm:grid-cols-2 xl:grid-cols-3 [&>*]:max-sm:max-w-64">
          {Array.from({ length: Math.min(favoriteIds.length, 6) }, (_, i) => (
            <SkeletonTile key={i} />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 max-sm:justify-items-center sm:grid-cols-2 xl:grid-cols-3 [&>*]:max-sm:max-w-64">
          {visible.map((it) => (
            <EftItemTile.Root key={it.id} item={it}>
              <EftItemTile.Header />
              <EftItemTile.Media />
              <EftItemTile.Name />
              <EftItemTile.Pricing />
            </EftItemTile.Root>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-lines-hover bg-(--color-base) p-8 text-center">
          <Star className="h-6 w-6 text-text-muted" />
          <p className="max-w-90 text-sm text-text-secondary">
            Избранное пусто. Отмечайте предметы звёздочкой в каталоге — они соберутся здесь с
            актуальными ценами.
          </p>
          <Link
            href="/eft/items"
            className="inline-flex items-center gap-2 rounded border border-lines-hover px-4 py-2 font-blender-medium text-type-label uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            К каталогу
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
