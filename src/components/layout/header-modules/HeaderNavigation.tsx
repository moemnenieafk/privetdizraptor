"use client";

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { type MenuItem } from '@/data/headerConfig';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useClickOutside } from '@/hooks/useClickOutside';

// Хелпер: должна ли иконка сохранять свои оригинальные цвета (без CSS-маски)
const isColoredIcon = (item: MenuItem, urlToUse?: string) => {
  if (item.coloredIcon) return true;
  const targetUrl = urlToUse || item.iconUrl;
  if (targetUrl?.endsWith('.webp')) return true;
  if (targetUrl?.includes('/gun-modes/')) return true;
  return false;
};

// Хелпер: проверка активности текущего пункта или любого из его вложенных детей
const isItemActive = (item: MenuItem, pathname: string): boolean => {
  if (item.path && item.path !== '#') {
    // Точное совпадение роута или нахождение во вложенном роуте
    if (pathname === item.path || pathname.startsWith(item.path + '/')) {
      return true;
    }
  }
  if (item.children && item.children.length > 0) {
    return item.children.some(child => isItemActive(child, pathname));
  }
  return false;
};

interface HeaderNavigationProps {
  menuItems: MenuItem[];
}

function SubNavItem({ child, faction }: { child: MenuItem; faction: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [flyLeft, setFlyLeft] = useState(false);
  const isActive = isItemActive(child, pathname || '');

  // Закрытие подменю при смене роута
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Умное позиционирование: предотвращаем выход меню за правый край экрана на планшетах
  useEffect(() => {
    if (isOpen && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      // Если меню (ширина 200px) не влезает в экран справа
      if (rect.right + 200 > window.innerWidth) {
        setFlyLeft(true);
      } else {
        setFlyLeft(false);
      }
    }
  }, [isOpen]);

  // Закрытие по ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleInteraction = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const nativeEvent = e.nativeEvent as PointerEvent;
    // Открываем по клику только на тач-устройствах, если есть подменю
    if (child.children && nativeEvent.pointerType !== 'mouse') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const iconToUse = (faction === 'USEC' && child.iconUrlUsec) ? child.iconUrlUsec : ((faction === 'BEAR' && child.iconUrlBear) ? child.iconUrlBear : child.iconUrl);

  return (
    <div
      ref={itemRef}
      className="relative w-full"
      onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) setIsOpen(true); }}
      onMouseLeave={() => { if (window.matchMedia('(hover: hover)').matches) setIsOpen(false); }}
    >
      <Link
        href={child.path || '#'}
        onClick={handleInteraction}
        className={`tactical-menu-item group/link flex h-9 w-full items-center justify-between px-3.5 ${isActive ? 'active' : ''}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {iconToUse && (
            isColoredIcon(child, iconToUse) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconToUse} alt="" className="h-4 w-4 flex-shrink-0 object-contain" />
            ) : (
              <div
                className="icon-mask h-4 w-4 flex-shrink-0 bg-current transition-colors duration-200"
                style={{ maskImage: `url(${iconToUse})`, WebkitMaskImage: `url(${iconToUse})`, maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat' }}
              />
            )
          )}
          <span className="truncate pt-0.5 font-blender-medium text-[13px] uppercase leading-none tracking-wide">
            {child.label}
          </span>
        </div>
        {child.children && (
          <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 ${isOpen ? (flyLeft ? 'rotate-90' : '-rotate-90') : '-rotate-90'}`} />
        )}
      </Link>

      {/* Вылет меню 3-го уровня с умным позиционированием и дизайн-токенами */}
      {child.children && (
        <div className={`absolute ${flyLeft ? 'right-[calc(100%+4px)] origin-top-right' : 'left-[calc(100%+4px)] origin-top-left'} top-[-4px] z-50 flex w-[200px] flex-col rounded border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_95%,transparent)] py-1.5 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out ${isOpen ? 'visible scale-100 opacity-100' : 'invisible pointer-events-none scale-95 opacity-0'}`}>
          {/* Невидимый мост для курсора */}
          <div className={`absolute ${flyLeft ? '-right-4' : '-left-4'} top-0 h-full w-4 bg-transparent`} />

          {child.children.map((grandChild) => (
            <SubNavItem key={grandChild.id} child={grandChild} faction={faction} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, pathname, faction }: { item: MenuItem; pathname: string; faction: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const isActive = isItemActive(item, pathname || '');

  // Закрытие при клике вне области (особенно важно для планшетов)
  useClickOutside(navRef, () => setIsOpen(false), isOpen);

  // Закрытие при смене роута
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Закрытие по ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleInteraction = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const nativeEvent = e.nativeEvent as PointerEvent;
    // На тач-устройствах первый тап по родительскому пункту открывает меню
    if (item.children && nativeEvent.pointerType !== 'mouse') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div
      ref={navRef}
      className="relative"
      onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) setIsOpen(true); }}
      onMouseLeave={() => { if (window.matchMedia('(hover: hover)').matches) setIsOpen(false); }}
    >
      <Link 
        href={item.path || '#'} 
        onClick={handleInteraction}
        className={`tactical-menu-item group/main flex cursor-pointer items-center justify-start gap-1.5 rounded px-2 py-1.5 font-blender-medium text-[15px] uppercase tracking-wide leading-none ${isActive ? 'active' : ''}`}
      >
        <span className="pt-0.5">{item.label}</span>
        {item.children && (
          <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </Link>

      {item.children && (
        <div className={`absolute left-0 top-[calc(100%+8px)] z-50 flex w-[200px] flex-col rounded border border-lines-hover bg-[color-mix(in_srgb,var(--color-card-menu)_95%,transparent)] py-1.5 shadow-2xl backdrop-blur-md origin-top transition-all duration-300 ease-out ${isOpen ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-2 scale-95 opacity-0 pointer-events-none'}`}>
          <div className="absolute -top-4 left-0 h-4 w-full bg-transparent" />
          {item.children.map((child) => (
            <SubNavItem key={child.id} child={child} faction={faction} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HeaderNavigation({ menuItems }: HeaderNavigationProps) {
  const pathname = usePathname();
  const profiles = usePlayerStore((state) => state.profiles);
  const activeProfileId = usePlayerStore((state) => state.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const faction = activeProfile?.faction || 'BEAR';

  return (
    <nav className="flex h-9 items-center gap-3.5">
      {menuItems.map((item) => {
        return <NavItem key={item.id} item={item} pathname={pathname || ''} faction={faction} />;
      })}
    </nav>
  );
}