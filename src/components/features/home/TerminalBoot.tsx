"use client";

import { useState, useEffect } from "react";

const BOOT_LINES = [
  "> ИНИЦИАЛИЗАЦИЯ ЦТА...",
  "> ЗАГРУЗКА МОДУЛЕЙ РАЗВЕДКИ...",
  "> ПОДКЛЮЧЕНИЕ К API TARKOV.DEV...",
  "> ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ // СИСТЕМА ОНЛАЙН",
] as const;

const LINE_INTERVAL_MS = 160;
const HOLD_AFTER_LAST_MS = 220;

interface TerminalBootProps {
  onComplete: () => void;
}

export function TerminalBoot({ onComplete }: TerminalBootProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount < BOOT_LINES.length) {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), LINE_INTERVAL_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(onComplete, HOLD_AFTER_LAST_MS);
    return () => clearTimeout(t);
  }, [visibleCount, onComplete]);

  return (
    <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-base">
      <div className="flex flex-col gap-2 w-full max-w-xs px-6 sm:max-w-sm">
        {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
          <p
            key={i}
            className={`font-blender-medium text-type-caption tracking-[0.3em] uppercase ${
              i === BOOT_LINES.length - 1
                ? "text-(--primary)"
                : "text-text-secondary"
            }`}
          >
            {line}
          </p>
        ))}
        {visibleCount < BOOT_LINES.length && (
          <span className="inline-block w-[7px] h-3 bg-(--primary) animate-pulse" />
        )}
      </div>
    </div>
  );
}
