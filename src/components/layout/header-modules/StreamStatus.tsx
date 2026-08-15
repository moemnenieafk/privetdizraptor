'use client';

import { useState, useEffect } from 'react';
import { useStreamDockStore } from '@/store/useStreamDockStore';
import { useStreamLive } from '@/hooks/useStreamLive';

// Плавающая кнопка-индикатор статуса стрима.
// Сам плеер живёт в StreamDock (features/streams). Здесь — ТОЛЬКО индикатор LIVE/OFFLINE
// и триггер: клик по LIVE разворачивает fullkamen-док (если юзер его свернул в 1×1).
// mapVariant — на Картах: левый гуттер, высота хедера (низ-право там занят контролами карты).
export default function StreamStatus({ mapVariant = false }: { mapVariant?: boolean }) {
  const { isLive, isLoading } = useStreamLive();
  const [isQuestFullscreen, setIsQuestFullscreen] = useState(false);
  const expandDock = useStreamDockStore((s) => s.expand);

  useEffect(() => {
    const check = () =>
      setIsQuestFullscreen(
        document.body.hasAttribute('data-quest-fullscreen') ||
          document.body.hasAttribute('data-app-fullscreen') ||
          document.body.hasAttribute('data-app-drawer'),
      );
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-quest-fullscreen', 'data-app-fullscreen', 'data-app-drawer'],
    });
    check();
    return () => observer.disconnect();
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
    // Плавающий оверлей: блок сидит в боковом гуттере ЗА кромкой 1100px-контента. Обёртка кликопрозрачна.
    // mapVariant: ЛЕВЫЙ гуттер, по центру пробела (0..кромка-контента) и на уровне логотипа хедера.
    //   • top = паддинг ROW1 (тот же clamp) + половина h-14 логотипа (28px) − половина h-10 кнопки (20px)
    //     ⇒ центр кнопки совпадает с центром логотипа на любом разрешении;
    //   • left = центр гуттера ((100vw−1100)/4) − половина ширины кнопки (5rem) − доп-сдвиг влево 2rem
    //     (визуальный центр блока, дальше от логотипа); фолбэк 1.5rem держит гекс-скобку в кадре.
    // Иначе (не Карты) — правый низ. Авто-центр в ПРАВОМ гуттере без магических констант:
    //   обёртка разворачивается ровно на пустой блок (width = гуттер, right:0), items-center
    //   центрирует кнопку внутри. Само подстраивается под любую ширину экрана.
    <div
      className={`fixed hidden xl:flex flex-col gap-2 pointer-events-none ${
        mapVariant ? 'items-start z-40' : 'bottom-4 items-center z-70'
      }`}
      style={
        mapVariant
          ? {
              top: 'calc(clamp(12px, 1.09vw, 21px) + 8px)',
              left: 'max(1.5rem, calc((100vw - 1100px) / 4 - 7rem))',
            }
          : { right: 0, width: 'max(10rem, calc((100vw - 1100px) / 2))' }
      }
    >
      {/* ═══ Кнопка-индикатор стрима ═══ */}
      <a
        href={isLive ? undefined : 'https://www.twitch.tv/fullkamen'}
        target={isLive ? undefined : '_blank'}
        rel="noopener noreferrer"
        role={isLive ? 'button' : undefined}
        onClick={isLive ? (e) => { e.preventDefault(); expandDock('fullkamen'); } : undefined}
        title={isLive ? 'Развернуть окно стрима' : undefined}
        // Сплошной #141416 под градиент-свечением — чтобы кнопка не была прозрачной (иначе
        // s.bg-градиент перебивает bg-класс). Работает в обеих вариациях (LIVE/OFFLINE).
        style={{ backgroundColor: 'var(--color-base)' }}
        className={`group relative flex shrink-0 items-center justify-center gap-2 w-10 sm:w-40 h-10 rounded-sm transition-all duration-500
          ${isQuestFullscreen ? 'invisible pointer-events-none' : 'pointer-events-auto'}
          ${isLoading
            ? 'border-[0.5px] border-lines-hover'
            : `${s.border} ${s.bg} ${s.shadow} hover:brightness-125`
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
