'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { getHeaderConfig } from '@/data/headerConfig';
import { NavLink } from '@/components/ui/NavLink';
import StreamStatus from '@/components/features/StreamStatus';
import { PlayerTelemetry } from '@/components/features/PlayerTelemetry';
import { TacticalSearch } from '@/components/features/TacticalSearch';

export function Header() {
  const pathname = usePathname();
  
  // Определяем текущую игру по URL (по умолчанию 'eft')
  const segments = (pathname || '').split('/').filter(Boolean);
  const gameId = segments.length > 0 ? segments[0] : 'eft';
  
  // Подтягиваем словарь ссылок и настроек для активной игры
  const config = getHeaderConfig(pathname || '');

  return (
    // Корневой тег header получает класс темы (например, theme-eft), 
    // который задает CSS-переменную --primary для всех вложенных компонентов
    <header className={`w-full bg-card-menu/80 backdrop-blur-xl border-b border-lines-hover sticky top-0 z-50 transition-colors duration-500 theme-${gameId}`}>
      
      {/* ================= СТРОКА 1: Глобальная навигация ================= */}
      <div className="border-b border-lines-hover/50">
        <div className="w-full max-w-[1100px] mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Слева: Сквозной логотип ЦТА */}
          <div className="flex-shrink-0 animate-[fade-in_0.5s_ease-out]">
            <Link href="/" className="block transition-transform hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
              <Image 
                src="/images/cta-logo.svg" 
                alt="ЦТА Лого" 
                width={120} 
                height={42} 
                priority
              />
            </Link>
          </div>

          {/* По центру: Динамическое меню текущей игры */}
          <nav className="hidden lg:flex items-center justify-center gap-8 flex-1 px-8">
            {config.menuItems.map((item) => (
              <NavLink key={item.path} href={item.path}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Справа: Телеметрия и Статус стрима */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <PlayerTelemetry />
            <StreamStatus />
          </div>
        </div>
      </div>

      {/* ================= СТРОКА 2: Контекстная панель ================= */}
      <div className="w-full max-w-[1100px] mx-auto px-4 h-14 flex items-center justify-between">
        
        {/* Слева: Динамический логотип текущей игры (с перекраской через маску) */}
        <Link href={`/${gameId}`} className="flex-shrink-0 group outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm" title={`Вернуться в хаб ${gameId.toUpperCase()}`}>
          <div 
            className="w-[100px] h-[24px] bg-text-primary opacity-80 group-hover:opacity-100 group-hover:bg-[var(--primary)] transition-all duration-300"
            style={{
              maskImage: `url(/games/${gameId}/${gameId}-logo.svg)`,
              WebkitMaskImage: `url(/games/${gameId}/${gameId}-logo.svg)`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'left center',
              WebkitMaskPosition: 'left center',
            }}
          />
        </Link>

        {/* По центру: Глобальный тактический поиск (TacticalSearch) */}
        <div className="flex-1 flex justify-center max-w-lg mx-4">
          <TacticalSearch />
        </div>

        {/* Справа: Кнопка-модификатор */}
        <button className="hidden sm:block flex-shrink-0 px-4 py-1.5 text-[10px] font-blender-medium tracking-[0.2em] uppercase border border-lines-hover bg-base text-text-secondary rounded hover:text-primary hover:border-primary/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Я новичок
        </button>
      </div>
    </header>
  );
}