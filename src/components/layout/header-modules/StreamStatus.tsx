'use client';

import { useState, useEffect } from 'react';

export default function StreamStatus() {
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchStreamStatus = async () => {
      try {
        const response = await fetch('/api/twitch-status', { cache: 'no-store' });
        const data = await response.json();
        if (isMounted) setIsLive(data.isLive);
      } catch (error) {
        console.error("Ошибка при проверке статуса стрима:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const initialDelay = setTimeout(fetchStreamStatus, 3000);
    const interval = setInterval(fetchStreamStatus, 300000);

    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  // Настройки для ОНЛАЙН (Цвет #6B9963)
  const liveStyles = {
    border: 'border border-neutral-500',
    bg: 'bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(107,153,99,0.20)_0%,_rgba(107,153,99,0)_100%)]',
    boxShadow: 'shadow-[0_0_4px_rgba(107,153,99,0.17),0_0_8px_rgba(107,153,99,0.21)]',
    dot: 'bg-online',
    text: 'СТРИМ ОНЛАЙН',
    // Комбинация внешнего свечения и внутреннего блика из Figma
    glow: 'shadow-[0_0_6px_2px_rgba(107,153,99,0.61),0_0_19px_2px_rgba(107,153,99,1),inset_0_1px_1px_rgba(255,255,255,0.35)]',
    textColor: 'text-online',
  };

  // Настройки для ОФФЛАЙН 
  const offlineStyles = {
    border: 'border border-neutral-800',
    bg: 'bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(194,67,57,0.20)_0%,_rgba(194,67,57,0)_100%)]',
    boxShadow: '',
    dot: 'bg-danger',
    text: 'СТРИМ ОФФЛАЙН',
    glow: '',
    textColor: 'text-danger'
  };

  const s = isLive ? liveStyles : offlineStyles;

  return (
    <a 
      href="https://twitch.tv/fullkamen" 
      target="_blank" 
      rel="noopener noreferrer"
      className={`group relative flex items-center justify-center gap-2 w-40 h-10 rounded transition-all duration-500 fixed bottom-6 right-4 z-50 xl:absolute xl:top-[14px] xl:-right-[260px] xl:bottom-auto ${
        isLoading ? 'border border-neutral-800 bg-black/20' : `${s.border} ${s.bg} ${s.boxShadow} hover:brightness-125`
      }`}
    >
      {/* Декоративные элементы по бокам (только для ОНЛАЙН) */}
      {isLive && !isLoading && (
        <>
          <div 
            className="absolute -left-7 top-1/2 -translate-y-1/2 w-[26px] h-[25px] opacity-50 transition-opacity duration-300 group-hover:opacity-100 icon-bg"
            style={{ backgroundImage: 'url(/icons/hexagon-left.svg)' }}
          />
          <div 
            className="absolute -right-7 top-1/2 -translate-y-1/2 w-[26px] h-[25px] opacity-50 transition-opacity duration-300 group-hover:opacity-100 icon-bg"
            style={{ backgroundImage: 'url(/icons/hexagon-right.svg)' }}
          />
        </>
      )}

      {isLoading ? (
        /* Скелетон загрузки */
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-neutral-600 animate-pulse" />
          <div className="h-2 w-20 bg-neutral-800 rounded animate-pulse" />
        </div>
      ) : (
        /* Контент стрима */
        <div className="flex items-center justify-center gap-2 z-10">
          <div className="relative flex h-1 w-1 shrink-0 items-center justify-center">
            {isLive && (
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-online opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-1 w-1 ${s.dot} ${s.glow}`} />
          </div>
          <span className={`text-sm font-blender-medium uppercase leading-4 ${s.textColor}`}>
            {s.text}
          </span>
        </div>
      )}
    </a>
  );
}