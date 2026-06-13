"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { HubCard } from "@/components/ui/HubCard";

export interface CategoryTabConfig {
  id: string;      // Идентификатор иконки (напр. 'gear', 'guns', 'meds')
  title: string;   // Название вкладки
  href: string;    // Ссылка на раздел
  iconPath?: string; // Путь к кастомной иконке (если есть в меню)
}

interface CategoryTabsProps {
  tabs: CategoryTabConfig[];
  className?: string;
}

export function CategoryTabs({ tabs, className = "" }: CategoryTabsProps) {
  const pathname = usePathname();

  if (!tabs || tabs.length === 0) return null;

  return (
    <div 
      className={`flex flex-wrap items-center gap-3 w-full ${className}`}
      role="tablist"
      aria-label="Категории предметов"
    >
      {tabs.map((tab, index) => {
        // Проверка: точное совпадение или это вложенный подраздел (для подсветки родительской вкладки)
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        
        return (
          <HubCard
            key={tab.href}
            gameId="eft"
            id={tab.id}
            title={tab.title}
            href={tab.href}
            variant="tab"
            index={index}
            isActive={isActive}
            iconPath={tab.iconPath}
          />
        );
      })}
    </div>
  );
}