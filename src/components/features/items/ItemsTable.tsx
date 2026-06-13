import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TarkovItem } from "@/types/tarkov-items";
import { ItemTableRow } from "@/components/features/items/ItemTableRow";

interface ItemsTableProps {
  items: TarkovItem[];
}

export const ItemsTable = memo(function ItemsTable({ items }: ItemsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Базовая высота строки с картинкой (48px картинка + 24px паддинг + 1px бордер)
    overscan: 5, // Рендерим по 5 элементов сверху и снизу для плавности без артефактов
  });

  const virtualItems = virtualizer.getVirtualItems();
  
  // Вычисляем виртуальные отступы для сохранения геометрии скроллбара
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0 ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

  return (
    <div 
      ref={parentRef}
      className="w-full max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lines-hover hover:[&::-webkit-scrollbar-thumb]:bg-text-muted"
    >
      <table className="w-full table-fixed border-collapse text-left relative font-blender-book">
        <thead className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--color-card-menu)_95%,transparent)] backdrop-blur-md shadow-md ring-1 ring-lines-hover">
          <tr>
            <th className="w-[35%] p-3 text-[10px] font-blender-medium uppercase tracking-widest text-text-muted lg:w-[30%]">
              Предмет
            </th>
            <th className="hidden p-3 text-[10px] font-blender-medium uppercase tracking-widest text-text-muted md:table-cell md:w-[15%]">
              Категория
            </th>
            <th className="hidden p-3 text-[10px] font-blender-medium uppercase tracking-widest text-text-muted xl:table-cell xl:w-[20%]">
              Характеристики
            </th>
            <th className="w-[20%] p-3 text-right text-[10px] font-blender-medium uppercase tracking-widest text-text-muted sm:w-[15%] lg:w-[10%]">
              Покупка
            </th>
            <th className="w-[20%] p-3 text-right text-[10px] font-blender-medium uppercase tracking-widest text-text-muted sm:w-[15%] lg:w-[10%]">
              Продажа
            </th>
            <th className="w-[25%] p-3 text-right text-[10px] font-blender-medium uppercase tracking-widest text-text-muted sm:w-[20%] lg:w-[15%]">
              Выгода/Слот
            </th>
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={6} />
            </tr>
          )}
          
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            return (
              <ItemTableRow 
                key={item.id} 
                item={item} 
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
              />
            );
          })}

          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: `${paddingBottom}px` }} colSpan={6} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});