'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { getHeaderConfig } from '@/data/headerConfig';

import { PlatformLogo } from './header-modules/PlatformLogo';
import { HeaderNavigation } from './header-modules/HeaderNavigation';
import { GameLogo } from './header-modules/GameLogo';
import { BurgerMenu } from './header-modules/BurgerMenu';
import { PlayerTelemetry } from './header-modules/PlayerTelemetry';
import { TacticalSearch } from './header-modules/TacticalSearch';
import NewbieButton from './header-modules/NewbieButton';
import NewbieModal from './header-modules/NewbieModal';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { useScrollHeader } from '@/hooks/useScrollHeader';

export function Header() {
  const pathname = usePathname();
  const segments = (pathname || '').split('/').filter(Boolean);
  const gameId = segments.length > 0 ? segments[0] : 'eft';
  const config = getHeaderConfig(pathname || '');
  const menuItems = config?.menuItems || [];
  const isHomePage = pathname === '/';
  const showFeatures = !isHomePage;
  const [isNewbieModalOpen, setIsNewbieModalOpen] = useState(false);
  const isScrolled = useScrollHeader();

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full theme-${gameId} transition-[background-color,box-shadow] duration-300 ease-out ${
          isScrolled
            ? 'bg-[color-mix(in_srgb,var(--color-base)_90%,transparent)] shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-md'
            : 'bg-transparent'
        }`}
      >
        {/* ═══ ROW 1 — всегда видима ═══ */}
        <div
          className={`flex items-center gap-7 px-4 xl:px-0 max-w-275 mx-auto transition-[padding] duration-300 ease-out ${
            isScrolled ? 'py-5.25' : 'py-[clamp(12px,1.09vw,21px)]'
          } ${isHomePage ? 'justify-center' : ''}`}
        >
          {/* Логотип */}
          <div className="shrink-0">
            <PlatformLogo />
          </div>

          {/* Навигация — только xl+, flex-1 */}
          {showFeatures && (
            <div className="hidden xl:flex flex-1 items-center">
              <HeaderNavigation menuItems={menuItems} />
            </div>
          )}

          {/* Правые контролы */}
          {showFeatures && (
            <div className="ml-auto flex items-center gap-3">
              <PlayerTelemetry />
              <BurgerMenu menuItems={menuItems} />
            </div>
          )}
        </div>

        {/* ═══ BREADCRUMB ROW — появляется при скролле ═══ */}
        {showFeatures && (
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              isScrolled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-4 xl:px-0 max-w-275 mx-auto pb-5.25">
                <Breadcrumbs />
              </div>
            </div>
          </div>
        )}

        {/* ═══ ROW 2 — схлопывается при скролле ═══ */}
        {showFeatures && (
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              isScrolled ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
            }`}
          >
            <div className={isScrolled ? 'overflow-hidden' : 'overflow-visible'}>
              <div className="px-4 xl:px-0 max-w-275 mx-auto">
                {/* Смена игры | Поиск | Кнопка «Я новичок» */}
                <div className="flex items-center gap-7 pb-3">
                  <GameLogo gameId={gameId} />
                  <div className="flex-1 min-w-0 flex justify-center">
                    <TacticalSearch />
                  </div>
                  <div className="hidden sm:flex shrink-0">
                    <NewbieButton onClick={() => setIsNewbieModalOpen(true)} />
                  </div>
                </div>

                {/* Хлебные крошки развёрнутого режима */}
                <div className="pb-3">
                  <Breadcrumbs />
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <NewbieModal isOpen={isNewbieModalOpen} onClose={() => setIsNewbieModalOpen(false)} />
    </>
  );
}
