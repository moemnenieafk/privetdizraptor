'use client';

// Клиент «Мой схрон»: берёт владение из useInventoryStore (localStorage), тянет мету предметов
// из нашего зеркала (/api/eft/items/meta, §4.11 — наружу не ходим), раскладывает футпринты
// паккером (§4.7 — расчёт в useMemo, не в JSX) и рисует абсолютно спозиционированную 56px-сетку
// из StashCell. Ёмкость сетки — по изданию активного профиля (stashCapacityCells).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PackageOpen } from 'lucide-react';
import { useInventoryStore } from '@/store/useInventoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { packStash, type StashEntry } from '@/lib/stash-packer';
import { stashCapacityCells } from '@/lib/stash-capacity';
import { StashCell } from '@/components/features/stash/StashCell';
import type { StashItemMeta } from '@/lib/stash-types';

const CELL_PX = 56; // одна клетка = 56px (кратно 4)
const COLUMNS = 10;
const GRID_WIDTH_PX = COLUMNS * CELL_PX; // 560px — фикс ширина внутренней сетки (моб. скролл)
const STASH_MAX = 9999; // как в «важных предметах» (needed)
// Задел на виртуализацию при очень больших схронах (не реализуем в этой итерации).
const VIRTUALIZE_THRESHOLD = 400;

type MetaMap = Record<string, StashItemMeta>;

interface MetaResponse {
  items: MetaMap;
}

export function StashClient() {
  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const bumpCount = useInventoryStore((s) => s.bumpCount);

  const activeProfile = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId));
  const capacity = stashCapacityCells(activeProfile?.edition);

  // Стабильный список id владения (count>0) для запроса меты. Сорт — для стабильного ключа мемо.
  const ownedIds = useMemo(
    () =>
      Object.entries(ownedItems)
        .filter(([, count]) => count > 0)
        .map(([id]) => id)
        .sort(),
    [ownedItems],
  );

  const idsKey = ownedIds.join(',');

  // Фетч меты кешируем по ключу запрошенных id (fetchedKey), чтобы НЕ звать setState
  // синхронно в эффекте: сам меж-состояние (пусто/загрузка) выводим в рендере ниже.
  const [fetched, setFetched] = useState<{ key: string; items: MetaMap } | null>(null);

  useEffect(() => {
    if (!ownedIds.length) return; // пустой схрон — фетч не нужен, meta выводится как {}
    let cancelled = false;
    fetch(`/api/eft/items/meta?ids=${encodeURIComponent(idsKey)}`)
      .then((res) => (res.ok ? (res.json() as Promise<MetaResponse>) : Promise.reject(new Error('meta fetch failed'))))
      .then((data) => {
        if (!cancelled) setFetched({ key: idsKey, items: data.items ?? {} });
      })
      .catch(() => {
        if (!cancelled) setFetched({ key: idsKey, items: {} });
      });
    return () => {
      cancelled = true;
    };
    // idsKey — производная ownedIds; ownedIds в депсах для линтера.
  }, [idsKey, ownedIds]);

  // Актуальная мета без setState-в-эффекте: пустой схрон → {}, иначе результат под текущий
  // ключ (устаревший при смене владения = null = скелетон). Мемо — стабильная ссылка для packing.
  const meta = useMemo<MetaMap | null>(
    () => (!ownedIds.length ? {} : fetched?.key === idsKey ? fetched.items : null),
    [ownedIds.length, fetched, idsKey],
  );

  // Раскладка футпринтов паккером. Только предметы, чья мета уже пришла.
  const packed = useMemo(() => {
    if (!meta) return null;
    const entries: StashEntry[] = ownedIds
      .filter((id) => meta[id])
      .map((id) => {
        const m = meta[id];
        // packStash не читает count (раскладка по футпринту+редкости) → count здесь фиксируем 1,
        // чтобы клик по счётчику не перепаковывал сетку. Живое количество берётся из ownedItems
        // при рендере ячейки, вне этого мемо.
        return {
          id,
          count: 1,
          gridWidth: m.gridWidth,
          gridHeight: m.gridHeight,
          ...(m.backgroundColor ? { rarity: m.backgroundColor } : {}),
        };
      });
    return packStash(entries, COLUMNS);
  }, [meta, ownedIds]);

  const loading = meta === null || packed === null;
  const occupied = packed?.occupied ?? 0;
  // Число «Занято X / Y» показываем как есть (X>Y — честный сигнал переполнения),
  // а процент заполнения клампим к 100, чтобы не было «137%».
  const fillPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;
  const gridHeightPx = packed ? Math.max(packed.rows, 1) * CELL_PX : 0;

  return (
    <section className="flex flex-col gap-6">
      {/* Индикатор-стат «Занято X / Y ячеек» */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-lines-hover pb-4">
        <div>
          <p className="font-blender-medium text-2xl tabular-nums text-text-primary">
            {occupied}
            <span className="text-text-muted"> / {capacity}</span>
          </p>
          <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Занято ячеек · схрон {activeProfile?.edition ?? 'Standard'}
          </p>
        </div>
        <p className="font-blender-medium text-sm tabular-nums text-text-muted">
          Заполнено {fillPct}%
        </p>
      </div>

      {loading ? (
        <StashSkeleton />
      ) : packed && packed.cells.length > 0 && meta ? (
        <div className="overflow-x-auto">
          <div
            className="relative"
            style={{ width: GRID_WIDTH_PX, height: gridHeightPx }}
          >
            {packed.cells.map((cell) => {
              const m = meta[cell.id];
              if (!m) return null;
              return (
                <div
                  key={cell.id}
                  className="absolute"
                  style={{ left: cell.col * CELL_PX, top: cell.row * CELL_PX }}
                >
                  <StashCell
                    meta={m}
                    count={ownedItems[cell.id] ?? 0}
                    onInc={(delta) => bumpCount(cell.id, delta, STASH_MAX)}
                    {...(m.slug ? { href: `/eft/items/item/${m.slug}` } : {})}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyStash />
      )}
    </section>
  );
}

/** Скелетон формы будущей сетки (§4.8) — ряд плиток, а не спиннер. */
function StashSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-10 gap-0" style={{ width: GRID_WIDTH_PX }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="h-14 w-14 animate-pulse border border-lines-hover bg-card-menu" />
        ))}
      </div>
    </div>
  );
}

/** Пустое состояние — щадящее, с путём к «Важным предметам». */
function EmptyStash() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-lines-hover py-16 text-center">
      <PackageOpen aria-hidden strokeWidth={1.5} className="h-12 w-12 text-text-muted" />
      <div className="flex flex-col gap-1">
        <p className="font-blender-medium text-base text-text-primary">Схрон пуст</p>
        <p className="font-blender-book text-sm text-text-muted">
          Добавляйте предметы кнопкой «В схрон» — они разложатся по ячейкам, как в игре.
        </p>
      </div>
      <Link
        href="/eft/progress/needed"
        className="font-blender-medium text-sm uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
      >
        Важные предметы
      </Link>
    </div>
  );
}
