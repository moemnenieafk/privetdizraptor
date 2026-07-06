'use client';

import { useState, useEffect } from 'react';
import { useStreamDockStore } from '@/store/useStreamDockStore';

// Плавающая кнопка-индикатор статуса стрима (правый-нижний угол).
// Сам плеер живёт в StreamDock (features/streams). Здесь — ТОЛЬКО индикатор LIVE/OFFLINE
// и триггер: клик по LIVE разворачивает fullkamen-док (если юзер его свернул в 1×1).
export default function StreamStatus() {
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuestFullscreen, setIsQuestFullscreen] = useState(false);
  const expandDock = useStreamDockStore((s) => s.expand);

  useEffect(() => {
    const check = () =>
      setIsQuestFullscreen(
        document.body.hasAttribute('data-quest-fullscreen') || document.body.hasAttribute('data-app-fullscreen'),
      );
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-quest-fullscreen', 'data-app-fullscreen'],
    });
    check();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchStreamStatus = async () => {
      try {
        const response = await fetch('/api/twitch-status', { cache: 'no-store' });
        const data = await response.json();
        if (mounted) setIsLive(data.isLive);
      } catch {
        // silent
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const initialDelay = setTimeout(fetchStreamStatus, 3000);
    const interval = setInterval(fetchStreamStatus, 300_000);

    return () => {
      mounted = false;
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  // Редизайн (эпик E12, фрейм 1661-2505): LIVE = красный «ON AIR LIVE» + гекс-скобки,
  // OFFLINE = серый «STREAM OFFLINE». Красный/серый — токены danger/text-muted.
  const liveS = {
    border: 'border-[0.5px] border-danger',
    bg: 'bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(194,67,57,0.25)_0%,_rgba(194,67,57,0)_100%)]',
    shadow: 'shadow-[0_0_4px_rgba(194,67,57,0.21),0_0_2px_rgba(194,67,57,0.17)]',
    dot: 'bg-danger',
    dotSize: 'size-2',
    ping: 'bg-danger',
    text: 'ON AIR LIVE',
    textSize: 'text-base',
    glow: 'shadow-[0_0_6px_2px_rgba(194,67,57,0.55),0_0_16px_2px_rgba(194,67,57,0.9),inset_0_1px_1px_rgba(255,255,255,0.25)]',
    textColor: 'text-white',
  };

  const offlineS = {
    border: 'border-[0.5px] border-lines-hover',
    bg: 'bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(84,84,92,0.20)_0%,_rgba(84,84,92,0)_100%)]',
    shadow: '',
    dot: 'bg-text-muted',
    dotSize: 'size-1',
    ping: 'bg-text-muted',
    text: 'STREAM OFFLINE',
    textSize: 'text-sm',
    glow: '',
    textColor: 'text-text-muted',
  };

  const s = isLive ? liveS : offlineS;

  return (
    // Плавающий оверлей: прибит к правому-нижнему углу. Обёртка кликопрозрачна
    // (pointer-events-none), интерактив — на кнопке (-auto).
    <div className="fixed bottom-4 right-4 z-70 flex flex-col items-end gap-2 pointer-events-none">
      {/* ═══ Кнопка-индикатор стрима ═══ */}
      <a
        href={isLive ? undefined : 'https://www.twitch.tv/fullkamen'}
        target={isLive ? undefined : '_blank'}
        rel="noopener noreferrer"
        role={isLive ? 'button' : undefined}
        onClick={isLive ? (e) => { e.preventDefault(); expandDock('fullkamen'); } : undefined}
        title={isLive ? 'Развернуть окно стрима' : undefined}
        className={`group relative flex shrink-0 items-center justify-center gap-2 w-10 sm:w-40 h-10 rounded-sm transition-all duration-500
          ${isQuestFullscreen ? 'invisible pointer-events-none' : 'pointer-events-auto'}
          ${isLoading
            ? 'border-[0.5px] border-lines-hover bg-darkbase'
            : `${s.border} ${s.bg} ${s.shadow} bg-darkbase hover:brightness-125`
          }`}
      >
        {/* Гекс-скобки вплотную к пилюле (только LIVE, десктоп), красные */}
        {isLive && !isLoading && (
          <>
            <span
              className="icon-mask hidden sm:block absolute -left-6 top-1/2 -translate-y-1/2 size-6 text-danger transition-opacity duration-300 opacity-80 group-hover:opacity-100"
              style={{ maskImage: 'url(/icons/hexagon-left.svg)', WebkitMaskImage: 'url(/icons/hexagon-left.svg)', maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat' }}
            />
            <span
              className="icon-mask hidden sm:block absolute -right-6 top-1/2 -translate-y-1/2 size-6 text-danger transition-opacity duration-300 opacity-80 group-hover:opacity-100"
              style={{ maskImage: 'url(/icons/hexagon-right.svg)', WebkitMaskImage: 'url(/icons/hexagon-right.svg)', maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat' }}
            />
          </>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-neutral-600 animate-pulse" />
            <div className="hidden sm:block h-2 w-20 bg-neutral-800 rounded animate-pulse" />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 z-10">
            <div className="relative flex size-2 shrink-0 items-center justify-center">
              {isLive && (
                <span className={`animate-ping absolute inline-flex size-2 rounded-full ${s.ping} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full ${s.dotSize} ${s.dot} ${s.glow}`} />
            </div>
            <span className={`hidden sm:inline ${s.textSize} font-blender-medium uppercase leading-4 ${s.textColor}`}>
              {s.text}
            </span>
          </div>
        )}
      </a>
    </div>
  );
}
