"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GAMES_DATA } from '@/data/games';
import { useClickOutside } from '@/hooks/useClickOutside';

interface GameLogoProps {
  gameId?: string; // Сделано опциональным, так как используется usePathname для fallback'а
}

export function GameLogo({ gameId }: GameLogoProps) {
  const pathname = usePathname();
  const segments = (pathname || '').split('/').filter(Boolean);
  const currentGameId = gameId || (segments.length > 0 ? segments[0] : 'eft');

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Шаг 1: Фильтрация только активных игр
  const activeGames = GAMES_DATA.filter((game) => !game.isInactive);

  // Логика закрытия выпадающего списка при клике вне его области (click outside)
  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  return (
    <div 
      ref={dropdownRef}
      className="relative flex h-14 w-[160px] cursor-pointer items-center justify-center rounded border border-lines-hover bg-black/20 transition-colors duration-300 hover:border-(--primary) group"
      onClick={() => setIsOpen(!isOpen)}
    >
      {/* Шаг 2: Текущий логотип-маска */}
      <div 
        className="h-8 w-24 bg-zinc-600 transition-colors duration-300 group-hover:bg-(--primary)"
        style={{
          maskImage: `url(/games/${currentGameId}/${currentGameId}-logo.svg)`,
          WebkitMaskImage: `url(/games/${currentGameId}/${currentGameId}-logo.svg)`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      />

      {/* Шаг 3: Выпадающее меню со списком доступных игр */}
      <div 
        className={`absolute left-0 top-[calc(100%+8px)] z-50 flex w-[160px] flex-col overflow-hidden rounded border border-lines-hover bg-card-menu shadow-lg transition-all duration-200 ${isOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}
      >
        {activeGames.map((game) => (
          <Link 
            key={game.id} 
            href={`/${game.id}`}
            onClick={() => setIsOpen(false)}
            className="group/item flex h-12 w-full items-center justify-center border-b border-lines-hover bg-transparent transition-colors last:border-0 hover:bg-black/20"
          >
            <div 
              className="h-6 w-20 bg-zinc-600 transition-colors duration-300 group-hover/item:bg-(--primary)"
              style={{
                maskImage: `url(/games/${game.id}/${game.id}-logo.svg)`,
                WebkitMaskImage: `url(/games/${game.id}/${game.id}-logo.svg)`,
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}