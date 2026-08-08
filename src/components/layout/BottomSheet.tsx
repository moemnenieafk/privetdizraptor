'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SheetCloseButton } from '@/components/ui/SheetCloseButton';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Затемнение — сплошное, чтобы карта и кнопки зума не просвечивали */}
      <button
        aria-label="Закрыть"
        onClick={onClose}
        className={`absolute inset-0 size-full bg-black/70 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* Лист — не выше 80% экрана, карта сверху остаётся видна. Фон сплошной. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl border-t border-lines-hover bg-(--color-base) shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex justify-center pt-3 pb-2">
          <span className="h-1 w-10 rounded-full bg-lines-hover" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-blender-medium text-sm uppercase tracking-widest text-(--color-text)">
            {title}
          </h2>
          <SheetCloseButton onClick={onClose} ariaLabel="Закрыть" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}