'use client';

import { useState, useEffect } from 'react';

export default function StreamStatus() {
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreamOpen, setIsStreamOpen] = useState(false);
  const [isStreamVisible, setIsStreamVisible] = useState(true);
  const [hostname, setHostname] = useState('localhost');
  const [isQuestFullscreen, setIsQuestFullscreen] = useState(false);

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
    setHostname(window.location.hostname);

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

  const handleButtonClick = () => {
    if (!isLive) return;
    if (!isStreamOpen) {
      setIsStreamOpen(true);
      setIsStreamVisible(true);
    } else {
      setIsStreamVisible((v) => !v);
    }
  };

  const liveS = {
    border: 'border border-neutral-500',
    bg: 'bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(107,153,99,0.20)_0%,_rgba(107,153,99,0)_100%)]',
    shadow: 'shadow-[0_0_4px_rgba(107,153,99,0.17),0_0_8px_rgba(107,153,99,0.21)]',
    dot: 'bg-online',
    text: 'СТРИМ ОНЛАЙН',
    glow: 'shadow-[0_0_6px_2px_rgba(107,153,99,0.61),0_0_19px_2px_rgba(107,153,99,1),inset_0_1px_1px_rgba(255,255,255,0.35)]',
    textColor: 'text-online',
  };

  const offlineS = {
    border: 'border border-neutral-800',
    bg: 'bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,_rgba(194,67,57,0.20)_0%,_rgba(194,67,57,0)_100%)]',
    shadow: '',
    dot: 'bg-danger',
    text: 'СТРИМ ОФФЛАЙН',
    glow: '',
    textColor: 'text-danger',
  };

  const s = isLive ? liveS : offlineS;

  return (
    <>
      {/* ═══ Кнопка-индикатор стрима ═══ */}
      <a
        href={isLive ? undefined : 'https://twitch.tv/fullkamen'}
        target={isLive ? undefined : '_blank'}
        rel="noopener noreferrer"
        role={isLive ? 'button' : undefined}
        onClick={isLive ? (e) => { e.preventDefault(); handleButtonClick(); } : undefined}
        className={`group relative flex shrink-0 items-center justify-center gap-2 w-40 h-10 rounded transition-all duration-500
          ${isQuestFullscreen ? 'invisible pointer-events-none' : ''}
          ${isLoading
            ? 'border border-neutral-800 bg-black/20'
            : `${s.border} ${s.bg} ${s.shadow} hover:brightness-125`
          }`}
      >
        {/* Декоративные гексагоны по бокам (только ОНЛАЙН) */}
        {isLive && !isLoading && (
          <>
            <div
              className="absolute -left-7 top-1/2 -translate-y-1/2 w-6.5 h-6.25 opacity-50 transition-opacity duration-300 group-hover:opacity-100 icon-bg"
              style={{ backgroundImage: 'url(/icons/hexagon-left.svg)' }}
            />
            <div
              className="absolute -right-7 top-1/2 -translate-y-1/2 w-6.5 h-6.25 opacity-50 transition-opacity duration-300 group-hover:opacity-100 icon-bg"
              style={{ backgroundImage: 'url(/icons/hexagon-right.svg)' }}
            />
          </>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-neutral-600 animate-pulse" />
            <div className="h-2 w-20 bg-neutral-800 rounded animate-pulse" />
          </div>
        ) : (
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

      {/* ═══ Окно стрима ═══ */}
      {isStreamOpen && !isQuestFullscreen && (
        <div className="fixed bottom-4 right-4 z-70">
          {/* Шапка окна — скрывается при минимизации */}
          <div
            className={`transition-[max-height,opacity] duration-300 ease-out overflow-hidden ${
              isStreamVisible ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between bg-card-menu border-t border-l border-r border-lines-hover px-3 h-8 rounded-t-sm">
              <span className="text-type-caption font-blender-medium uppercase tracking-wider text-text-secondary">
                Стрим Fullkamen
              </span>
              <button
                onClick={() => setIsStreamVisible(false)}
                title="Свернуть (зритель сохраняется)"
                className="flex h-5 w-5 items-center justify-center text-text-muted transition-colors hover:text-text-primary"
              >
                <span className="text-base font-blender-medium leading-none">—</span>
              </button>
            </div>
          </div>

          {/*
            iframe всегда загружен после открытия.
            При минимизации — 1×1px: Twitch считает зрителя, но видео не видно.
          */}
          <div
            style={
              isStreamVisible
                ? { width: 320, height: 180 }
                : { width: 1, height: 1, overflow: 'hidden' }
            }
          >
            <iframe
              src={`https://player.twitch.tv/?channel=fullkamen&parent=${hostname}&autoplay=true`}
              width="320"
              height="180"
              allowFullScreen
              className="block"
            />
          </div>
        </div>
      )}

      {/* Кнопка развернуть — показывается когда окно свёрнуто в 1px */}
      {isStreamOpen && !isStreamVisible && !isQuestFullscreen && (
        <button
          onClick={() => setIsStreamVisible(true)}
          className="fixed bottom-4 right-4 z-70 flex items-center gap-1.5 h-7 px-2.5 rounded-sm border border-lines-hover bg-card-menu transition-colors hover:border-online group/expand"
        >
          <span className="h-1 w-1 shrink-0 rounded-full bg-online animate-pulse" />
          <span className="mt-0.5 text-type-caption font-blender-medium uppercase text-text-secondary transition-colors group-hover/expand:text-online">
            Развернуть стрим
          </span>
        </button>
      )}
    </>
  );
}
