"use client";

import { useEffect, useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface NewbieModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewbieModal({ isOpen, onClose }: NewbieModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose, isVisible);

  // Управление задержкой размонтирования для плавных анимаций
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10); // Даем DOM отрисоваться перед стартом анимации
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300); // Ждем 300ms (продолжительность transition)
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Эффект для закрытия модального окна по нажатию клавиши Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isRendered) {
    return null;
  }

  return (
    // Полупрозрачный фон (Backdrop)
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Панель модального окна */}
      <div
        ref={modalRef}
        className={`flex w-[400px] flex-col shadow-2xl transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
      >
        {/* ШАПКА */}
        <div className="relative flex h-7 w-full items-center justify-start gap-1 rounded-t bg-[#222225]">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <div className="h-full w-full icon-mask icon-eft-lore-tarkov text-[#9CA3AF]" />
          </div>
          <div className="text-sm font-blender-medium uppercase leading-4 text-zinc-100">Гайд для новичков</div>
          
          {/* Кнопка закрытия */}
          <button onClick={onClose} className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-80 focus:outline-none">
            <div className="flex h-3 w-4 items-center justify-center rounded-[1px] bg-[#7E2C25]">
              <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </div>
          </button>
        </div>

        {/* ТЕЛО МОДАЛКИ */}
        <div className="flex w-full flex-col overflow-hidden rounded-b border border-[#222225] bg-[#161618] p-7">
          <div className="flex flex-col gap-4 text-sm font-blender-medium leading-4 text-text-secondary">
            <p>Добро пожаловать в Центр Тактической Адаптации! Этот раздел поможет вам освоиться в мире Escape from Tarkov.</p>
            <p>Здесь вы найдете информацию о ключевых механиках, советы по выживанию и ссылки на полезные ресурсы.</p>
            <div className="flex flex-col gap-3 pt-2">
              <a href="/eft/quests" onClick={onClose} className="group flex items-center gap-2 text-text-primary transition-colors hover:text-[var(--primary)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] opacity-50 transition-opacity group-hover:opacity-100" />
                Первые квесты
              </a>
              <a href="/eft/keepitems" onClick={onClose} className="group flex items-center gap-2 text-text-primary transition-colors hover:text-[var(--primary)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] opacity-50 transition-opacity group-hover:opacity-100" />
                Что оставлять в схроне
              </a>
              <a href="/eft/maps" onClick={onClose} className="group flex items-center gap-2 text-text-primary transition-colors hover:text-[var(--primary)]">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] opacity-50 transition-opacity group-hover:opacity-100" />
                Изучение карт
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}