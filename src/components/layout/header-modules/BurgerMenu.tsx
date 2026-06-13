"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { MenuItem } from "@/data/headerConfig";

interface BurgerMenuProps {
  menuItems?: MenuItem[];
}

export function BurgerMenu({ menuItems = [] }: BurgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Автоматическое закрытие меню при навигации
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="xl:hidden">
      <button 
        onClick={() => setIsOpen(true)} 
        className="flex items-center justify-center p-2 text-text-primary transition-colors duration-300 hover:text-(--primary) active:scale-95"
      >
        <span title="Меню"><Menu className="h-6 w-6" /></span>
      </button>

      {/* Backdrop (Оверлей) */}
      <div 
        className={`fixed inset-0 z-100 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} 
        onClick={() => setIsOpen(false)} 
      />

      {/* Drawer (Выезжающая панель) */}
      <div className={`fixed inset-y-0 right-0 z-101 flex w-72 flex-col border-l border-lines-hover bg-card-menu shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-lines-hover bg-(--color-base) p-4">
          <span className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">Навигация</span>
          <button onClick={() => setIsOpen(false)} className="rounded bg-danger-dim/20 p-1.5 text-danger-dim transition-colors duration-300 hover:bg-danger-dim hover:text-text-primary">
            <span title="Закрыть"><X className="h-5 w-5" /></span>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {menuItems.map((item, idx) => {
            const targetPath = item.path || '#';
            const isActive = item.path ? pathname?.startsWith(item.path) : false;
            return (
              <Link 
                key={item.id || idx} 
                href={targetPath}
                className={`tactical-menu-item flex items-center rounded border p-3 hover:scale-[1.02] ${isActive ? "active border-(--primary) shadow-[0_0_15px_color-mix(in_srgb,var(--primary)_30%,transparent)]" : "border-lines-hover"}`}
              >
                <span className="font-blender-medium text-[15px] uppercase tracking-widest">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}