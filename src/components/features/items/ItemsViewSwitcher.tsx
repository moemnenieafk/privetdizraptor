"use client";

import React, { useState, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { DataViewToggle, type ViewMode } from "@/components/ui/DataViewToggle";
import { ItemsTable } from "@/components/features/items/ItemsTable";
import { ItemTile } from "@/components/features/items/ItemTile";
import { TarkovItem } from "@/types/tarkov-items";

interface ItemsViewSwitcherProps {
  items: TarkovItem[];
  className?: string;
}

export function ItemsViewSwitcher({ items, className = "" }: ItemsViewSwitcherProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const parentRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(6);

  // Синхронизируем количество колонок с брейкпоинтами Tailwind для точного расчета строк
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      if (w >= 1280) setColumns(6);      // xl
      else if (w >= 1024) setColumns(5); // lg
      else if (w >= 768) setColumns(4);  // md
      else if (w >= 640) setColumns(3);  // sm
      else setColumns(2);                // default
    };
    
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 176, // 160px (h-40) + 16px (gap-4)
    overscan: 4, // Рендерим 4 невидимых строки сверху и снизу для плавности скролла
  });

  if (!items.length) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-lg border border-[var(--color-lines-hover)] bg-[color-mix(in_srgb,var(--color-card-menu)_20%,transparent)] p-12 text-center ${className}`}>
        <span className="font-blender-medium text-lg uppercase tracking-widest text-[var(--color-text-muted)]">
          Предметы не найдены
        </span>
      </div>
    );
  }

  // Извлекаем только видимые элементы на основе отрендеренных строк
  const virtualItems = virtualizer.getVirtualItems();
  const startIndex = virtualItems.length > 0 ? virtualItems[0].index * columns : 0;
  const endIndex = virtualItems.length > 0 ? (virtualItems[virtualItems.length - 1].index + 1) * columns : 0;
  const visibleItems = items.slice(startIndex, endIndex);
  const translateY = virtualItems.length > 0 ? virtualItems[0].start : 0;

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="sticky top-[72px] z-40 flex items-center justify-between rounded border border-[var(--color-lines-hover)] bg-[color-mix(in_srgb,var(--color-card-menu)_80%,transparent)] p-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300">
        <span className="font-blender-medium text-sm uppercase tracking-widest text-[var(--color-text-primary)]">
          Найдено предметов: <span className="text-[var(--primary)]">{items.length}</span>
        </span>
        <DataViewToggle view={view} onChange={setView} />
      </div>

      {view === "table" ? (
        <ItemsTable items={items} />
      ) : (
        <div 
          ref={parentRef}
          className="w-full max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-[var(--color-lines-hover)] bg-[color-mix(in_srgb,var(--color-card-menu)_10%,transparent)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--color-lines-hover)] hover:[&::-webkit-scrollbar-thumb]:bg-[var(--color-text-muted)]"
        >
          <div 
            style={{ 
              height: `${virtualizer.getTotalSize() + 32}px`, 
              position: 'relative', 
              width: '100%' 
            }}
          >
            <div 
              style={{ 
                position: 'absolute', 
                top: '16px', 
                left: '16px', 
                right: '16px', 
                transform: `translateY(${translateY}px)` 
              }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            >
              {visibleItems.map((item) => (
                <div key={item.id} className="flex justify-center">
                  <ItemTile item={item} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}