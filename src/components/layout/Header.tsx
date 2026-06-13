'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { getHeaderConfig } from '@/data/headerConfig';

// Модули Хедера
import { PlatformLogo } from './header-modules/PlatformLogo';
import { HeaderNavigation } from './header-modules/HeaderNavigation';
import { GameLogo } from './header-modules/GameLogo';
import { BurgerMenu } from './header-modules/BurgerMenu';

// Фичи
import StreamStatus from './header-modules/StreamStatus';
import { PlayerTelemetry } from './header-modules/PlayerTelemetry';
import { TacticalSearch } from './header-modules/TacticalSearch';
import NewbieButton from './header-modules/NewbieButton';
import NewbieModal from './header-modules/NewbieModal';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { useScrollHeader } from '@/hooks/useScrollHeader';

export function Header() {
  const pathname = usePathname();
  
  // Определяем текущую игру по URL (по умолчанию 'eft')
  const segments = (pathname || '').split('/').filter(Boolean);
  const gameId = segments.length > 0 ? segments[0] : 'eft';
  
  // Подтягиваем словарь ссылок и настроек для активной игры
  const config = getHeaderConfig(pathname || '');
  const menuItems = config?.menuItems || []; // Защита от undefined при отсутствии конфигурации

  const isHomePage = pathname === '/';

  // Конфигурация фиче-флагов для точечного включения/отключения модулей
  const features = {
    showPlatformLogo: true,
    showNavigation: !isHomePage,
    showUserControls: !isHomePage, // Стрим и Телеметрия
    showGameLogo: !isHomePage,
    showSearch: !isHomePage,
    showNewbieButton: !isHomePage,
  };

  // Состояние для управления модальным окном
  const [isNewbieModalOpen, setIsNewbieModalOpen] = useState(false);

  // Хук отслеживания скролла для компактного режима хедера
  const isScrolled = useScrollHeader(40);

  return (
    <>
      <header
        className={`sticky top-0 z-50 flex w-full flex-col px-4 transition-all duration-300 ease-out theme-${gameId} ${
          isScrolled ? "bg-[color-mix(in_srgb,var(--color-base)_90%,transparent)] py-3 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md" : "bg-[var(--color-base)] pb-[clamp(12px,1.09vw,21px)] pt-[clamp(12px,1.09vw,21px)]"
        }`}
      >
      
      {/* ================= ЕДИНАЯ СЕТКА ХЕДЕРА ================= */}
      <div className="tactical-grid items-center gap-y-4 relative w-full">
        
        {/* 1. Платформенный Логотип */}
        {features.showPlatformLogo && (
          <div className={`flex items-center transition-all duration-300 order-1 ${isHomePage ? 'col-span-full justify-center' : 'col-span-1 justify-start'}`}>
            <PlatformLogo />
          </div>
        )}

        {/* 2. Навигация (Скрывается при скролле) */}
        {features.showNavigation && (
          <div className={`hidden xl:flex xl:col-span-4 justify-start order-3 xl:order-2 transition-all duration-300 ease-out z-[60] ${isScrolled ? 'absolute opacity-0 invisible pointer-events-none -translate-y-2' : 'relative opacity-100 translate-y-0'}`}>
            <HeaderNavigation menuItems={menuItems} />
          </div>
        )}

        {/* 3. Телеметрия, Стрим и Бургер-меню (Скрываются при скролле, оставляя Бургер) */}
        {features.showUserControls && (
          <div className="col-span-1 md:col-start-4 xl:col-start-6 flex items-center justify-end gap-4 order-2 xl:order-3 relative">
            <div className={`flex items-center gap-4 transition-all duration-300 ease-out ${isScrolled ? 'absolute opacity-0 invisible pointer-events-none right-12' : 'relative opacity-100 right-0'}`}>
              <PlayerTelemetry />
              <StreamStatus />
            </div>
            {features.showNavigation && <BurgerMenu menuItems={menuItems} />}
          </div>
        )}

        {/* 4. Логотип Игры (Скрывается при скролле) */}
        {features.showGameLogo && (
          <div className={`col-span-1 flex justify-start order-4 transition-all duration-300 ease-out ${isScrolled ? 'absolute opacity-0 invisible pointer-events-none -translate-y-2' : 'relative opacity-100 translate-y-0'}`}>
            <GameLogo gameId={gameId} />
          </div>
        )}

        {/* 5. Глобальный Поиск (Центрируется, меняет порядок при скролле для объединения в один ряд) */}
        {features.showSearch && (
          <div className={`col-span-2 md:col-span-2 xl:col-span-4 flex justify-center w-full transition-all duration-300 relative z-[50] ${isScrolled ? 'order-2' : 'order-5'}`}>
            <TacticalSearch />
          </div>
        )}

        {/* 6. Кнопка-модификатор (Скрывается при скролле) */}
        {features.showNewbieButton && (
          <div className={`col-span-1 md:col-start-4 xl:col-start-6 flex justify-end transition-all duration-300 ease-out ${isScrolled ? 'absolute right-4 order-last opacity-0 invisible pointer-events-none translate-y-2' : 'relative right-0 order-6 opacity-100 translate-y-0'}`}>
            <NewbieButton onClick={() => setIsNewbieModalOpen(true)} />
          </div>
        )}

        {/* 7. Хлебные крошки (Скрываются при скролле) */}
        {features.showNavigation && (
          <div className={`col-span-full order-7 grid transition-all duration-300 ease-out ${isScrolled ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
            <div className="overflow-hidden">
              <Breadcrumbs />
            </div>
          </div>
        )}
      </div>
      </header>

      {/* Модальное окно для новичков */}
      <NewbieModal isOpen={isNewbieModalOpen} onClose={() => setIsNewbieModalOpen(false)} />
    </>
  );
}