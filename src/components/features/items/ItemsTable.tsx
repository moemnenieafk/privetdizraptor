import { memo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TarkovItem } from "@/types/tarkov-items";
import { ItemTableRow } from "@/components/features/items/ItemTableRow";
import { ItemCard } from "@/components/features/items/ItemCard";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type EcoItem = TarkovItem & {
  eco?: { bestSell?: { price: number }; minPrice: number; vps: number };
};

const CATEGORY_MAP: Record<string, string> = {
  armor: "Броня",
  weapon: "Оружие",
  ammo: "Патроны",
  meds: "Медицина",
  container: "Контейнер",
  headset: "Гарнитура",
  common: "Предмет",
};

interface ItemsTableProps {
  items: TarkovItem[];
}

export const ItemsTable = memo(function ItemsTable({ items }: ItemsTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // Мобилка — card-reflow (карточка выше строки), десктоп — строка таблицы
    estimateSize: () => (isMobile ? 150 : 73),
    overscan: 5, // Рендерим по 5 элементов сверху и снизу для плавности без артефактов
  });

  // Смена раскладки строка↔карточка меняет высоту — сбрасываем замеры виртуализатора
  useEffect(() => {
    virtualizer.measure();
  }, [isMobile, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  
  // Вычисляем виртуальные отступы для сохранения геометрии скроллбара
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;
  const paddingBottom = virtualItems.length > 0 ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0) : 0;

  return (
    <div 
      ref={parentRef}
      className="w-full max-h-[calc(100dvh-280px)] overflow-auto rounded-lg border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] sm:max-h-[calc(100dvh-220px)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-lines-hover hover:[&::-webkit-scrollbar-thumb]:bg-text-muted"
    >
      {isMobile ? (
        <div className="relative">
          {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index] as EcoItem;
            const buyPrice = item.eco?.minPrice ?? item.fleaPrice ?? 0;
            const sellPrice = item.eco?.bestSell?.price ?? 0;
            const profitPerSlot =
              item.eco?.vps ??
              Math.round((item.fleaPrice ?? 0) / ((item.gridWidth || 1) * (item.gridHeight || 1)));
            return (
              <ItemCard
                key={item.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                href={`/eft/items/item/${item.normalizedName}`}
                iconLink={item.iconLink}
                shortName={item.shortName}
                name={item.name}
                backgroundColor={item.backgroundColor}
                stats={[
                  { label: "Покупка", value: buyPrice },
                  { label: "Продажа", value: sellPrice, tone: "positive" },
                  { label: "Выг/слот", value: profitPerSlot, tone: "accent" },
                ]}
                specs={[
                  { label: "Кат.", value: CATEGORY_MAP[item.category] ?? item.category },
                  { label: "Размер", value: `${item.gridWidth || 1}×${item.gridHeight || 1}` },
                ]}
              />
            );
          })}
          {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
        </div>
      ) : (
      <table className="w-full table-fixed border-collapse text-left relative font-blender-book">
        <thead className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--color-card-menu)_95%,transparent)] backdrop-blur-md shadow-md ring-1 ring-lines-hover">
          <tr>
            <th className="w-[35%] p-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:p-3 lg:w-[30%]">
              Предмет
            </th>
            <th className="hidden p-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:p-3 md:table-cell md:w-[15%]">
              Категория
            </th>
            <th className="hidden p-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:p-3 xl:table-cell xl:w-[20%]">
              Характеристики
            </th>
            <th className="hidden p-2 text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:p-3 lg:table-cell lg:w-[8%]">
              Размер
            </th>
            <th className="w-[20%] p-2 text-right text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:w-[15%] sm:p-3 lg:w-[10%]">
              Покупка
            </th>
            <th className="w-[20%] p-2 text-right text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:w-[15%] sm:p-3 lg:w-[10%]">
              Продажа
            </th>
            <th className="w-[25%] p-2 text-right text-type-caption font-blender-medium uppercase tracking-widest text-text-muted sm:w-[20%] sm:p-3 lg:w-[15%]">
              Выгода/Слот
            </th>
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: `${paddingTop}px` }} colSpan={7} />
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
              <td style={{ height: `${paddingBottom}px` }} colSpan={7} />
            </tr>
          )}
        </tbody>
      </table>
      )}
    </div>
  );
});