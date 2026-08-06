'use client';

import { usePathname, useRouter } from 'next/navigation';
import { getHeaderConfig } from '@/data/headerConfig';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { ROLE_LABELS } from '@/lib/role-inference';

import { PlatformLogo } from './header-modules/PlatformLogo';
import { HeaderNavigation } from './header-modules/HeaderNavigation';
import { GameLogo } from './header-modules/GameLogo';
import { BurgerMenu } from './header-modules/BurgerMenu';
import { PlayerTelemetry } from './header-modules/PlayerTelemetry';
import { GameModeBadge } from './header-modules/GameModeBadge';
import StreamStatus from './header-modules/StreamStatus';
import { TacticalSearch } from './header-modules/TacticalSearch';
import NewbieButton from './header-modules/NewbieButton';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const effectiveRole = useRoleStore((s) => effectiveRoleFor(s, activeProfileId));
  const newbieLabel = ROLE_LABELS[effectiveRole].button;
  const segments = (pathname || '').split('/').filter(Boolean);
  const gameId = segments.length > 0 ? segments[0] : 'eft';
  const config = getHeaderConfig(pathname || '');
  const menuItems = config?.menuItems || [];
  const isHomePage = pathname === '/';
  const showFeatures = !isHomePage;
  // На near-fullscreen страницах (карты локаций + карта заданий) ROW 2 (лого игры + глоб. поиск +
  // «Я новичок» + крошки) скрыт: каркас отдаёт вертикаль контенту, оставляя только ROW 1.
  const isMapRoute = (pathname || '').startsWith('/eft/maps') || (pathname || '').startsWith('/eft/questmap');

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
              <GameModeBadge />
              <div className="hidden xl:block">
                <PlayerTelemetry />
              </div>
              <BurgerMenu menuItems={menuItems} newbieLabel={newbieLabel} onOpenNewbie={() => router.push('/eft/hub')} />
            </div>
          )}
        </div>

        {/* ═══ ROW 2 ═══ (скрыт на карт-страницах: near-fullscreen каркас) */}
        {showFeatures && !isMapRoute && (
          <div className="px-4 xl:px-0 max-w-275 mx-auto">
            <div className="flex items-center gap-7 pb-3">
              <div className="hidden xl:flex shrink-0">
                <GameLogo gameId={gameId} />
              </div>
              <div className="flex-1 min-w-0 flex justify-center">
                <TacticalSearch />
              </div>
              <div className="hidden xl:flex shrink-0">
                <NewbieButton label={newbieLabel} onClick={() => router.push('/eft/hub')} />
              </div>
            </div>

            <div className="hidden xl:block pb-3">
              <Breadcrumbs />
            </div>
          </div>
        )}
      </header>

      {/* Плавающий оверлей стрима — вне потока хедер-бара, сам себя позиционирует (fixed).
          На Картах низ-право занят кластером зум+Позиция+Сквад → переносим в левый гуттер на
          высоту хедера (зеркало «Завоза» справа). Вне Карт — прежний правый-низ. */}
      {showFeatures && <StreamStatus mapVariant={isMapRoute} />}
    </>
  );
}
