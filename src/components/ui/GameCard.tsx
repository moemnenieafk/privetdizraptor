"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// Типы поддерживаемых логотипов:
export type LogoConfig =
  | string // Обычная картинка (fallback)
  | { type: 'multi-state'; default: string; hover: string; inactive: string; width: number; height: number; } // Многослойная (EFT)
  | { type: 'mask'; src: string; width: number; height: number; }; // Динамическая SVG-маска (FRAGO, ABI)

// Define the type for a single game object
export type Game = {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  bgHover: string;
  bgInactive: string;
  videoWebm: string;
  videoMp4: string;
  logo: LogoConfig;
  hoverClass: string;
  themeClass: string;
  isInactive: boolean;
};

// Define the props for the GameCard component
interface GameCardProps {
  game: Game;
  isLoading: boolean;
  index: number;
}

export function GameCard({ game, isLoading, index }: GameCardProps) {
  const [videoError, setVideoError] = useState(false);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Мемоизируем опции, чтобы IntersectionObserver не пересоздавался при каждом рендере
  const observerOptions = useMemo(() => ({ rootMargin: "100px" }), []);
  const isInView = useIntersectionObserver(cardRef, observerOptions);

  // Ручное управление воспроизведением видео для экономии ресурсов
  const handleMouseEnter = () => {
    if (videoRef.current && !game.isInactive) {
      videoRef.current.play().catch(() => {
        // Игнорируем ошибку, если play() был прерван быстрым уводом курсора
      });
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current && !game.isInactive) {
      videoRef.current.pause();
    }
  };

  return (
    <Link
      ref={cardRef}
      href={game.isInactive ? "#" : `/${game.id}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        if (game.isInactive) e.preventDefault();
      }}
      className={`w-full aspect-[348/564] max-w-[348px] shrink-0 relative overflow-hidden group tactical-card-base ${game.hoverClass} ${game.themeClass} ${game.isInactive ? "is-inactive cursor-not-allowed" : ""}
                  ${isLoading ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
      style={{
        // Задержка появления карточек после исчезновения прелоадера (500ms) + эффект "волны" (150ms на карту)
        transitionDelay: `${500 + index * 150}ms`
      }}
    >
      {/* ТАКТИЧЕСКИЙ ТУЛТИП */}
      <div className="tactical-tooltip">
        {game.isInactive ? "Доступ ограничен" : "Перейти в хаб"}
      </div>

      {/* Слой 1: Дефолтный фон */}
      <Image
        src={game.isInactive ? game.bgInactive : game.bg}
        alt={`${game.title} background`}
        fill
        sizes="(max-width: 768px) 80vw, 348px"
        priority={index < 2} // Prioritize loading for the first two cards
        className={`object-cover transition-all duration-700 ${game.isInactive ? "grayscale brightness-50" : ""}`}
      />

      {/* Слой 2: Ховер-контейнер с видео */}
      {!game.isInactive && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ease-in-out">
          <Image
            src={game.bgHover}
            alt={`${game.title} hover background`}
            fill
            sizes="(max-width: 768px) 80vw, 348px"
            className="object-cover z-0"
          />
          {!videoError && (
            <video
              ref={videoRef}
              loop
              muted
              playsInline
              poster={game.bgHover}
              className="absolute inset-0 w-full h-full object-cover z-10"
              onError={() => setVideoError(true)}
            >
              {/* Ленивая загрузка: рендерим источники только когда карточка в поле зрения */}
              {isInView && (
                <>
                  <source src={game.videoWebm} type="video/webm" />
                  <source src={game.videoMp4} type="video/mp4" />
                </>
              )}
            </video>
          )}
        </div>
      )}

      {/* Слой 3: Декоративный градиент */}
      <div className="absolute inset-0 bg-gradient-to-t from-base/90 via-base/40 to-transparent pointer-events-none z-20" />

      {/* Слой 3.5: Неоновая подсветка при наведении */}
      {!game.isInactive && (
        <div
          className="absolute bottom-0 left-0 w-full h-[28px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out bg-[radial-gradient(ellipse_at_bottom,var(--primary)_0%,transparent_70%)] z-25"
        />
      )}

      {/* Слой 3.8: Градиентная обводка при наведении */}
      {!game.isInactive && (
        <div className="tactical-gradient-border group-hover:opacity-100" />
      )}

      {/* Слой 4: Интерфейс на жестких Figma-координатах */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <div
          className="absolute left-0 top-[78.01%] w-full h-[17.02%] flex items-center justify-center"
        >
          {typeof game.logo === "string" ? (
            <Image
              src={game.logo}
              alt={game.title}
              width={256}
              height={96}
              className={`object-contain ${game.isInactive ? "opacity-30 grayscale" : ""}`}
            />
          ) : game.logo.type === "mask" ? (
            // --- УНИВЕРСАЛЬНОЕ ПРАВИЛО ДЛЯ НОВЫХ ИГР (CSS MASK) ---
            <div
              className={`flex-shrink-0 transition-colors duration-300 ${
                game.isInactive
                  ? "bg-text-muted opacity-30" // Серый цвет для неактивного
                  : "bg-text-primary group-hover:bg-[var(--primary)]" // Белый по умолчанию -> Акцентный цвет темы при ховере
              }`}
              style={{
                width: game.logo.width,
                height: game.logo.height,
                WebkitMaskImage: `url(${game.logo.src})`,
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskImage: `url(${game.logo.src})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
            />
          ) : (
            // --- МНОГОСЛОЙНЫЙ ЛОГОТИП (EFT) ---
            <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: game.logo.width, height: game.logo.height }}>
              {game.isInactive ? (
                <Image src={game.logo.inactive} alt={game.title} width={game.logo.width} height={game.logo.height} className="object-contain opacity-30" />
              ) : (
                <>
                  {/* Default Logo */}
                  <Image
                    src={game.logo.default}
                    alt={game.title}
                    width={game.logo.width}
                    height={game.logo.height}
                    className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 group-hover:opacity-0"
                  />
                  {/* Hover Logo */}
                  <Image
                    src={game.logo.hover}
                    alt={game.title}
                    width={game.logo.width}
                    height={game.logo.height}
                    className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                  />
                </>
              )}
            </div>
          )}
        </div>
        <div className={`absolute left-0 w-full text-center top-[524px] font-blender-medium text-[10px] xl:text-[12px] tracking-wider uppercase ${
          game.isInactive ? "text-text-muted" : "text-text-secondary group-hover:text-[var(--primary)] transition-colors duration-300"
        }`}>
          {game.isInactive ? "ТЕХНИЧЕСКИЕ РАБОТЫ" : game.subtitle}
        </div>
      </div>
    </Link>
  );
}