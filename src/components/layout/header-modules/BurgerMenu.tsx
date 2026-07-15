"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/data/headerConfig";
import { GAMES_DATA, type LogoConfig } from "@/data/games";
import { Carousel } from "@/components/ui/Carousel";
import { PlatformLogo } from "./PlatformLogo";
import { MobileMenuStats } from "./MobileMenuStats";
import NewbieButton from "./NewbieButton";
import { useUser } from "@/hooks/useUser";

interface BurgerMenuProps {
  menuItems?: MenuItem[];
  onOpenNewbie?: () => void;
  newbieLabel?: string;
}

// Достаём src+габариты логотипа из union-конфига игры (mask / multi-state / строка).
const getLogo = (logo: LogoConfig): { src: string; width: number; height: number } => {
  if (typeof logo === "string") return { src: logo, width: 100, height: 32 };
  if (logo.type === "mask") return { src: logo.src, width: logo.width, height: logo.height };
  return { src: logo.default, width: logo.width, height: logo.height };
};

/**
 * Анимированная иконка-тоггл: две линии ↔ крестик.
 * Обе линии съезжаются к центру и поворачиваются на ±45° (transition-all, 300ms), реверсивно.
 */
function BurgerIcon({ open }: { open: boolean }) {
  const line = "absolute left-0 h-0.5 w-6 rounded-full bg-current transition-all duration-300 ease-in-out";
  return (
    <span aria-hidden className="relative block h-4 w-6">
      <span className={`${line} ${open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-1"}`} />
      <span className={`${line} ${open ? "top-1/2 -translate-y-1/2 -rotate-45" : "top-2.5"}`} />
    </span>
  );
}

export function BurgerMenu({ menuItems = [], onOpenNewbie, newbieLabel }: BurgerMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();

  const currentGameId = (pathname || "").split("/").filter(Boolean)[0] || "eft";
  const activeGames = GAMES_DATA.filter((g) => !g.isInactive);
  const startIndex = Math.max(0, activeGames.findIndex((g) => g.id === currentGameId));

  // Автозакрытие при навигации
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Лок скролла фона + закрытие по Escape, пока дровер открыт
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <div className="xl:hidden">
      {/* Единая кнопка-тоггл: морфит бургер↔крестик, держится над дровером */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={isOpen}
        className={`relative z-102 flex h-11 w-11 items-center justify-center rounded border transition-colors duration-300 active:scale-95 ${isOpen ? "border-transparent text-text-muted hover:text-(--primary)" : "border-lines-hover text-text-primary hover:border-(--primary) hover:text-(--primary)"}`}
      >
        <BurgerIcon open={isOpen} />
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-100 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-out ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Дровер — во всю высоту, широкий (телефон = почти весь экран) */}
      <div
        className={`fixed inset-y-0 right-0 z-101 flex w-full max-w-96 flex-col border-l border-lines-hover bg-card-menu shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Шапка: лого (крестик — это плавающая кнопка-тоггл выше) */}
        <div className="flex h-17 shrink-0 items-center border-b border-lines-hover bg-(--color-base) px-4">
          <PlatformLogo />
        </div>

        {/* Скроллируемое тело: стата + навигация + новичок */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <MobileMenuStats />

          {/* Вход в Аккаунт Центр / логин — на мобиле PlayerTelemetry скрыт (hidden xl:block),
              поэтому дублируем точку входа сюда. */}
          {user ? (
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="tactical-menu-item flex items-center justify-center gap-2.5 rounded border border-(--primary) py-3.5 font-blender-medium text-[15px] uppercase tracking-widest text-(--primary) hover:scale-[1.02]"
            >
              <span className="h-4 w-4 icon-mask icon-account_profile_icon bg-(--primary)" />
              Аккаунт Центр
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="tactical-menu-item flex items-center justify-center gap-2.5 rounded border border-(--primary) py-3.5 font-blender-medium text-[15px] uppercase tracking-widest text-(--primary) hover:scale-[1.02]"
            >
              <span className="h-4 w-4 icon-mask icon-eft-profile-login bg-(--primary)" />
              Войти
            </Link>
          )}

          <nav className="flex flex-col gap-2">
            {menuItems.map((item, idx) => (
              <Link
                key={item.id || idx}
                href={item.path || "#"}
                className="tactical-menu-item flex items-center justify-center rounded border border-lines-hover py-3.5 font-blender-medium text-[15px] uppercase tracking-widest hover:scale-[1.02]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex justify-center pt-1">
            <NewbieButton label={newbieLabel} onClick={() => { setIsOpen(false); onOpenNewbie?.(); }} />
          </div>
        </div>

        {/* Свитчер игр — прибит к низу */}
        <div className="shrink-0 border-t border-lines-hover bg-(--color-base) py-3">
          <Carousel
            options={{ startIndex }}
            slideClassName="flex-[0_0_200px] mr-3"
            viewportPadClassName="py-1"
          >
            {activeGames.map((game) => {
              const isActive = game.id === currentGameId;
              const { src, width, height } = getLogo(game.logo);
              return (
                <Link
                  key={game.id}
                  href={`/${game.id}`}
                  className={`flex h-16 w-full items-center justify-center rounded border transition-colors ${isActive ? "border-(--primary) bg-black/30" : "border-lines-hover bg-black/10"}`}
                >
                  <div
                    className={isActive ? "bg-(--primary)" : "bg-text-muted opacity-60"}
                    style={{
                      width,
                      height,
                      WebkitMaskImage: `url(${src})`,
                      maskImage: `url(${src})`,
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                    }}
                  />
                </Link>
              );
            })}
          </Carousel>
        </div>
      </div>
    </div>
  );
}
