import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TarkovItem } from "@/types/tarkov-items";
import { ItemRow, ITEM_ROW_TEMPLATE } from "@/components/features/items/ItemRow";

interface ItemsTableProps {
  items: TarkovItem[];
}

const HEAD_CLASS = "text-type-caption font-blender-medium uppercase tracking-widest text-text-muted";

export const ItemsTable = memo(function ItemsTable({ items }: ItemsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // Средняя оценка; measureElement уточняет по факту (карточка выше строки).
    // Раскладку строка↔карточка теперь решает контейнер-запрос, не JS — ветка isMobile убрана.
    estimateSize: () => 96,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  return (
    <div
      ref={parentRef}
      className="@container/items-table w-full max-h-[calc(100dvh-280px)] overflow-auto rounded-lg border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] sm:max-h-[calc(100dvh-220px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lines-hover hover:[&::-webkit-scrollbar-thumb]:bg-text-muted"
    >
      {/* Шапка — только в row-раскладке (широкий контейнер). Тот же шаблон, что у строк. */}
      <div
        className={`sticky top-0 z-20 hidden items-center gap-2 border-b border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_95%,transparent)] px-3 py-2 shadow-md ring-1 ring-lines-hover backdrop-blur-md @2xl/items-table:grid ${ITEM_ROW_TEMPLATE}`}
      >
        <span className={HEAD_CLASS}>Предмет</span>
        <span className={HEAD_CLASS}>Категория</span>
        <span className={`hidden @4xl/items-table:block ${HEAD_CLASS}`}>Характеристики</span>
        <span className={`hidden @3xl/items-table:block ${HEAD_CLASS}`}>Размер</span>
        <span className={`text-right ${HEAD_CLASS}`}>Покупка</span>
        <span className={`text-right ${HEAD_CLASS}`}>Продажа</span>
        <span className={`text-right ${HEAD_CLASS}`}>Выгода/Слот</span>
      </div>

      <div className="relative">
        {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <ItemRow
              key={item.id}
              item={item}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
            />
          );
        })}
        {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
      </div>
    </div>
  );
});
