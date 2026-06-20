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

export function Header() {
  const pathname = usePathname();
  const segments = (pathname || '').split('/').filter(Boolean);
  const gameId = segments.length > 0 ? segments[0] : 'eft';
  const config = getHeaderConfig(pathname || '');
  const menuItems = config?.menuItems || [];
  const isHomePage = pathname === '/';
  const showFeatures = !isHomePage;
  const [isNewbieModalOpen, setIsNewbieModalOpen] = useState(false);

  return (
    <>
      <header className={`w-full theme-${gameId} bg-transparent`}>
        {/* ═══ ROW 1 ═══ */}
        <div
          className={`flex items-center gap-7 px-4 xl:px-0 max-w-275 mx-auto py-[clamp(12px,1.09vw,21px)] ${isHomePage ? 'justify-center' : ''}`}
        >
          <div className="shrink-0">
            <PlatformLogo />
          </div>

          {showFeatures && (
            <div className="hidden xl:flex flex-1 items-center">
              <HeaderNavigation menuItems={menuItems} />
            </div>
          )}

          {showFeatures && (
            <div className="ml-auto flex items-center gap-3">
              <PlayerTelemetry />
              <BurgerMenu menuItems={menuItems} />
            </div>
          )}
        </div>

        {/* ═══ ROW 2 ═══ */}
        {showFeatures && (
          <div className="px-4 xl:px-0 max-w-275 mx-auto">
            <div className="flex items-center gap-7 pb-3">
              <GameLogo gameId={gameId} />
              <div className="flex-1 min-w-0 flex justify-center">
                <TacticalSearch />
              </div>
              <div className="hidden sm:flex shrink-0">
                <NewbieButton onClick={() => setIsNewbieModalOpen(true)} />
              </div>
            </div>

            <div className="pb-3">
              <Breadcrumbs />
            </div>
          </div>
        )}
      </header>

      <NewbieModal isOpen={isNewbieModalOpen} onClose={() => setIsNewbieModalOpen(false)} />
    </>
  );
}
