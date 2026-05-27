'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { GAMES_DATA } from '@/data/games';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // 1. Разбиваем путь и берем первый сегмент
    const segments = pathname.split('/').filter(Boolean);
    const currentSegment = segments.length > 0 ? segments[0] : '';

    // 2. Проверяем, существует ли такая игра в базе
    const validGameIds = GAMES_DATA.map((game) => game.id);
    const gameId = validGameIds.includes(currentSegment) ? currentSegment : 'eft';

    // 3. Вешаем класс темы на body для глобального покрытия
    const targetElement = document.body;

    // 4. Очищаем старые классы тем
    const classesToRemove = Array.from(targetElement.classList).filter(className =>
      className.startsWith('theme-')
    );
    if (classesToRemove.length > 0) {
      targetElement.classList.remove(...classesToRemove);
    }

    // 5. Устанавливаем новый класс
    targetElement.classList.add(`theme-${gameId}`);
  }, [pathname]);

  // Компонент-обертка
  return <>{children}</>;
}