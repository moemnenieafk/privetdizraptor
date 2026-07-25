'use client';

import { ArrowLeft } from 'lucide-react';

// Мобильный портрет-гейт: канвас в ленте на тач не запускаем (экран мелкий), играть — только
// в ландшафтном фуллскрине. Экран поворота ОБЯЗАН иметь кнопку выхода (иначе ловушка при
// системной блокировке ориентации). Анимация иконки глушится под prefers-reduced-motion.
interface RotateScreenProps {
  onBack: () => void;
}

export function RotateScreen({ onBack }: RotateScreenProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black px-4 text-center select-none">
      {/* Телефон, поворачивающийся из портрета в ландшафт (currentColor → берёт токен). */}
      <svg
        viewBox="0 0 48 48"
        className="h-14 w-14 origin-center text-(--primary) motion-safe:animate-[arcade-rotate_1.8s_ease-in-out_infinite]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="17" y="6" width="14" height="26" rx="3" />
        <line x1="21.5" y1="28.5" x2="26.5" y2="28.5" />
        <path d="M8 36a16 16 0 0 0 14 6" />
        <polyline points="6 30 8 36 14 34" />
      </svg>

      <span className="font-blender-medium text-xs uppercase tracking-widest text-text-primary">
        Поверни телефон
      </span>
      <span className="text-type-micro font-blender-book text-text-secondary">
        Игра идёт в горизонтальном режиме
      </span>

      <button
        type="button"
        onClick={onBack}
        className="mt-2 flex h-9 items-center gap-1.5 rounded-xs border border-lines-hover px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
      >
        <ArrowLeft size={14} />
        Назад
      </button>
    </div>
  );
}
