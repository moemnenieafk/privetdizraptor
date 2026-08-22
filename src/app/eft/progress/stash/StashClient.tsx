'use client';

// Клиент «Мой схрон»: берёт владение из useInventoryStore (localStorage), тянет мету предметов
// из нашего зеркала (/api/eft/items/meta, §4.11 — наружу не ходим), раскладывает футпринты
// паккером (§4.7 — расчёт в useMemo, не в JSX) и рисует АДАПТИВНУЮ 56px-сетку в два слоя:
// фон из пустых ячеек StashEmptyCell (сам схрон, как в игре) + предметы StashCell поверх.
// Ширина сетки динамическая: число колонок = floor(ширины контейнера / 56), пересчёт на ресайзе.
// Ёмкость сетки — по изданию активного профиля (stashCapacityCells).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useInventoryStore } from '@/store/useInventoryStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { packStash, type StashEntry } from '@/lib/stash-packer';
import { expandToStacks, type OwnedStackInput } from '@/lib/stash-stacks';
import { stashCapacityCells } from '@/lib/stash-capacity';
import { stackMaxOverride } from '@/lib/stash-stack-overrides';
import { StashCell } from '@/components/features/stash/StashCell';
import { StashEmptyCell } from '@/components/features/stash/StashEmptyCell';
import type { StashItemMeta } from '@/lib/stash-types';

const CELL = 56; // одна клетка = 56px (кратно 4)
const DEFAULT_COLUMNS = 10; // разумный дефолт до первого измерения контейнера
const STASH_MAX = 9999; // как в «важных предметах» (needed)

type MetaMap = Record<string, StashItemMeta>;

interface MetaResponse {
  items: MetaMap;
}

export function StashClient() {
  const ownedItems = useInventoryStore((s) => s.ownedItems);
  const bumpCount = useInventoryStore((s) => s.bumpCount);

  const activeProfile = usePlayerStore((s) => s.profiles.find((p) => p.id === s.activeProfileId));
  const capacity = stashCapacityCells(activeProfile?.edition);

  // Адаптивная ширина: измеряем контейнер сетки и пересчитываем число колонок.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setColumns(Math.max(1, Math.floor(width / CELL)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Раскладка НАСТОЯЩИХ СТЕКОВ под текущую ширину. Зависит от количества (новый юнит может
  // породить новый стек), меты и числа колонок (ширина динамическая) — всё в депсах (§4.7, вне JSX).
  const layout = useMemo(() => {
    if (!meta) return null;

    // Владение (count>0) + мета → входы для стек-хелпера.
    const inputs: OwnedStackInput[] = ownedIds
      .filter((id) => meta[id] && (ownedItems[id] ?? 0) > 0)
      .map((id) => {
        const m = meta[id];
        // Стек-лимит: сперва из зеркала (ammo), иначе известный оверрайд денег, иначе 1.
        const stackMax = m.stackMaxSize ?? stackMaxOverride(m.inGameId);
        const input: OwnedStackInput = {
          itemId: id,
          count: ownedItems[id] ?? 0,
          gridWidth: m.gridWidth,
          gridHeight: m.gridHeight,
        };
        if (m.backgroundColor != null) input.rarity = m.backgroundColor;
        if (stackMax !== undefined) input.stackMaxSize = stackMax;
        return input;
      });

    const units = expandToStacks(inputs);

    // Карта key → данные для рендера ячейки. key уникален (`${itemId}#${i}`).
    const cellByKey = new Map<
      string,
      { itemId: string; stackCount: number; meta: StashItemMeta }
    >();
    // Агрегат непоместившихся юнитов (обрезка по MAX_STACKS_PER_ITEM) для ненавязчивой заметки.
    let overflowTotal = 0;

    const entries: StashEntry[] = units.map((unit) => {
      cellByKey.set(unit.key, {
        itemId: unit.itemId,
        stackCount: unit.stackCount,
        meta: meta[unit.itemId],
      });
      if (unit.overflowRemaining && unit.overflowRemaining > 0) {
        overflowTotal += unit.overflowRemaining;
      }
      const entry: StashEntry = {
        id: unit.key,
        count: unit.stackCount,
        gridWidth: unit.gridWidth,
        gridHeight: unit.gridHeight,
      };
      if (unit.rarity !== undefined) entry.rarity = unit.rarity;
      return entry;
    });

    return { packed: packStash(entries, columns), cellByKey, overflowTotal };
  }, [meta, ownedIds, ownedItems, columns]);

  const loading = meta === null || layout === null;
  const packed = layout?.packed ?? null;
  const occupied = packed?.occupied ?? 0;
  const overflowTotal = layout?.overflowTotal ?? 0;
  const isEmpty = !loading && packed !== null && packed.cells.length === 0;

  // Число «Занято X / Y» показываем как есть (X>Y — честный сигнал переполнения),
  // а процент заполнения клампим к 100, чтобы не было «137%».
  const fillPct = capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0;

  // Ряды сетки: до ёмкости издания (под текущую ширину), но растём под контент.
  const capacityRows = Math.ceil(capacity / columns);
  const packedRows = packed?.rows ?? 0;
  const displayRows = Math.max(capacityRows, packedRows, 1);

  const gridWidthPx = columns * CELL;
  const gridHeightPx = displayRows * CELL;

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
        <div className="flex flex-col items-end gap-0.5">
          <p className="font-blender-medium text-sm tabular-nums text-text-muted">
            Заполнено {fillPct}%
          </p>
          {overflowTotal > 0 ? (
            <p className="text-type-micro font-blender-book tabular-nums text-text-muted">
              часть юнитов не показана: +{overflowTotal}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <StashSkeleton />
      ) : (
        // Один relative-контейнер: измеряется под ширину контента, ограничивает 2 слоя.
        <div ref={gridRef} className="w-full">
          <div className="relative" style={{ width: gridWidthPx, height: gridHeightPx }}>
            {/* Слой 1 — ФОН: пустая сетка схрона (сам схрон, как в игре). */}
            <div
              aria-hidden
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${columns}, ${CELL}px)`,
                gridAutoRows: `${CELL}px`,
              }}
            >
              {Array.from({ length: columns * displayRows }).map((_, i) => (
                <StashEmptyCell key={i} />
              ))}
            </div>

            {/* Слой 2 — ПРЕДМЕТЫ: абсолютно поверх фона по px-координатам ячеек. */}
            <div className="absolute inset-0">
              {packed?.cells.map((cell) => {
                // cell.id = key стека (`${itemId}#${i}`) → достаём предмет/стек/мету из карты.
                const unit = layout?.cellByKey.get(cell.id);
                if (!unit) return null;
                const m = unit.meta;
                const { itemId } = unit;
                return (
                  <div
                    key={cell.id}
                    className="absolute"
                    style={{ left: cell.col * CELL, top: cell.row * CELL }}
                  >
                    <StashCell
                      meta={m}
                      count={unit.stackCount}
                      onInc={(delta) => bumpCount(itemId, delta, STASH_MAX)}
                      {...(m.slug ? { href: `/eft/items/item/${m.slug}` } : {})}
                    />
                  </div>
                );
              })}
            </div>

            {/* Пустой схрон — ненавязчивый оверлей-хинт поверх самой пустой сетки. */}
            {isEmpty ? <EmptyHint /> : null}
          </div>
        </div>
      )}
    </section>
  );
}

/** Скелетон формы будущей сетки (§4.8) — ряд плиток, а не спиннер. */
function StashSkeleton() {
  return (
    <div
      className="grid gap-0"
      style={{
        gridTemplateColumns: `repeat(${DEFAULT_COLUMNS}, ${CELL}px)`,
        gridAutoRows: `${CELL}px`,
      }}
    >
      {Array.from({ length: DEFAULT_COLUMNS * 4 }).map((_, i) => (
        <div key={i} className="animate-pulse border border-lines-hover bg-card-menu" />
      ))}
    </div>
  );
}

/** Пустое состояние — щадящий оверлей поверх пустой сетки, с путём к «Важным предметам». */
function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-8">
      <div className="pointer-events-auto flex flex-col items-center gap-2 rounded-lg border border-lines-hover bg-(--color-darkbase)/85 px-6 py-4 text-center backdrop-blur-sm">
        <p className="font-blender-book text-sm text-text-muted">
          Добавляйте предметы кнопкой «В схрон» — они разложатся по ячейкам, как в игре.
        </p>
        <Link
          href="/eft/progress/needed"
          className="font-blender-medium text-sm uppercase tracking-widest text-(--primary) transition-opacity hover:opacity-80"
        >
          Важные предметы
        </Link>
      </div>
    </div>
  );
}
