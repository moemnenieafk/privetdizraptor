'use client';

import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';

interface ProfileResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void; // Функция для фактического сброса (на будущее)
}

export function ProfileResetModal({ isOpen, onClose, onConfirm }: ProfileResetModalProps) {
  // Состояния для плавной анимации
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose, isVisible);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Закрытие по Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  return (
    // Оверлей (z-index выше, чем у окна настроек)
    <div 
      className={`fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Контейнер модалки */}
      <div 
        ref={modalRef}
        className={`flex w-[348px] flex-col shadow-[0_0_40px_rgba(194,67,57,0.15)] transition-all duration-300 ease-out ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}
      >
        
        {/* ШАПКА (#C24339) */}
        <div className="relative flex h-7 w-full items-center justify-start gap-1 rounded-t bg-[#C24339]">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <div className="h-full w-full icon-mask icon-eft-profile-reset text-zinc-100" />
          </div>
          <div className="text-sm font-blender-medium leading-4 text-zinc-100">Подтверждение сброса профиля игрока</div>
          
          {/* Кнопка закрытия (#7E2C25) */}
          <button onClick={onClose} className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-80 focus:outline-none">
            <div className="flex h-3 w-4 items-center justify-center rounded-[1px] bg-[#7E2C25]">
              <div className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </div>
          </button>
        </div>

        {/* ТЕЛО МОДАЛКИ (#0D0D0F) */}
        <div className="relative flex w-full flex-col items-center justify-start overflow-hidden rounded-b border border-[#C24339] bg-[#0D0D0F] p-8 text-center">
          
          {/* Фоновые паттерны */}
          <div className="pointer-events-none absolute left-0 top-0 h-[80px] w-full bg-[url('/images/warning-bg-pannel-top.svg')] bg-cover bg-top bg-no-repeat opacity-50" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-[80px] w-full bg-[url('/images/warning-bg-pannel-bottom.svg')] bg-cover bg-bottom bg-no-repeat opacity-50" />

          {/* Контент (z-10, чтобы быть поверх паттернов) */}
          <div className="relative z-10 flex w-full flex-col items-center gap-6">
            
            {/* Иконка и Заголовок */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-10 w-10 icon-mask icon-eft-profile-warning text-[#C24339]" />
              <div className="text-xl font-blender-medium uppercase tracking-wide text-[#C24339]">ВНИМАНИЕ</div>
            </div>

            {/* Текстовый блок */}
            <div className="flex flex-col gap-4 text-left text-sm font-blender-medium leading-4 text-[#9CA3AF]">
              <p>
                Вы действительно хотите осуществить сброс прогресса профиля игрока?
              </p>
              <p>
                Вы подтверждаете, что абсолютно <span className="font-bold text-zinc-100">ВЕСЬ</span> прогресс завершенных заданий, найденных предметов, построенных модулей убежища, уровень ЧВК, уровни торговцев будут сброшены по умолчанию.
              </p>
              <p className="text-[#52525B]">
                Выполняется автоматически после вайпа
              </p>
            </div>

            {/* Кнопки */}
            <div className="mt-2 flex w-full gap-5">
              <button 
                onClick={() => {
                  if (onConfirm) onConfirm();
                  onClose();
                }} 
                className="flex h-9 flex-1 items-center justify-center rounded border border-[#C24339] bg-transparent text-[16px] font-blender-medium text-[#C24339] transition-colors hover:bg-[#C24339] hover:text-[#0D0D0F] focus:outline-none"
              >
                ДА
              </button>
              <button 
                onClick={onClose} 
                className="flex h-9 flex-1 items-center justify-center rounded border border-[#C24339] bg-transparent text-[16px] font-blender-medium text-[#C24339] transition-colors hover:bg-[#C24339] hover:text-[#0D0D0F] focus:outline-none"
              >
                НЕТ
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}