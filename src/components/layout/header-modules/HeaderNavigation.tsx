"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { type MenuItem } from '@/data/headerConfig';
import { usePlayerStore } from '@/store/usePlayerStore';

// Хелпер: должна ли иконка сохранять свои оригинальные цвета (без CSS-маски)
const isColoredIcon = (item: MenuItem, urlToUse?: string) => {
  if (item.coloredIcon) return true;
  const targetUrl = urlToUse || item.iconUrl;
  if (targetUrl?.endsWith('.webp')) return true;
  if (targetUrl?.includes('/02-quests/')) return true;
  if (targetUrl?.includes('/gun-modes/')) return true;
  return false;
};

interface HeaderNavigationProps {
  menuItems: MenuItem[];
}

function SubNavItem({ child, faction }: { child: MenuItem; faction: string }) {
  const [isSubHovered, setIsSubHovered] = useState(false);
  const iconToUse = (faction === 'USEC' && child.iconUrlUsec) ? child.iconUrlUsec : ((faction === 'BEAR' && child.iconUrlBear) ? child.iconUrlBear : child.iconUrl);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setIsSubHovered(true)}
      onMouseLeave={() => setIsSubHovered(false)}
    >
      <Link
        href={child.path || '#'}
        className="group flex h-6 w-full items-center justify-between px-3.5 transition-colors duration-200 hover:bg-[#0D0D0F]"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {iconToUse && (
            isColoredIcon(child, iconToUse) ? (
              <img src={iconToUse} alt="" className="h-4 w-4 flex-shrink-0 object-contain" />
            ) : (
              <div
                className="icon-mask h-4 w-4 flex-shrink-0 text-text-secondary transition-colors duration-200 group-hover:text-[var(--primary)]"
                style={{ maskImage: `url(${iconToUse})`, WebkitMaskImage: `url(${iconToUse})`, maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat' }}
              />
            )
          )}
          <span className="truncate font-blender-medium text-[10pt] uppercase leading-3 text-text-secondary transition-colors duration-200 group-hover:text-[var(--primary)]">
            {child.label}
          </span>
        </div>
        {child.children && (
          <ChevronDown className="h-3 w-3 -rotate-90 flex-shrink-0 text-text-secondary transition-colors duration-200 group-hover:text-[var(--primary)]" />
        )}
      </Link>

      {/* Вылет меню 3-го уровня вправо */}
      {child.children && isSubHovered && (
        <div className="absolute left-[calc(100%+4px)] top-[-9px] z-50 flex w-[160px] flex-col rounded border border-[#52525B] bg-card-menu py-2 shadow-xl transition-colors duration-300 hover:border-[var(--primary)] animate-[fade-in_0.15s_ease-out_both]">
          {/* Невидимый мост для курсора (перекрывает отступ в 4px) */}
          <div className="absolute -left-4 top-0 h-full w-4 bg-transparent" />

          {child.children.map((grandChild) => (
            <SubNavItem key={grandChild.id} child={grandChild} faction={faction} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ item, pathname, faction }: { item: MenuItem; pathname: string; faction: string }) {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = item.path ? pathname?.startsWith(item.path) : false;

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Кнопка-триггер или обычная ссылка */}
      <Link 
        href={item.path || '#'} 
        className={`group/main flex cursor-pointer items-center justify-start gap-2 rounded-sm py-1 pl-2 pr-1 transition-colors duration-300 font-blender-medium text-sm uppercase leading-4 ${
          isActive ? 'bg-[var(--primary)] text-[#0D0D0F]' : 'text-text-secondary hover:text-[var(--primary)] hover:bg-black/20'
      }`}>
        <span>{item.label}</span>
        {item.children && (
          <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-300 ${isHovered ? 'rotate-180' : ''}`} />
        )}
      </Link>

      {/* Выпадающее меню (Dropdown Container) */}
      {item.children && isHovered && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 flex w-[160px] flex-col rounded border border-[#52525B] bg-card-menu py-2 transition-colors duration-300 hover:border-[var(--primary)] animate-[fade-in_0.15s_ease-out_both]">
          {/* Невидимый "мост" для мышки, чтобы меню не закрывалось при переходе */}
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