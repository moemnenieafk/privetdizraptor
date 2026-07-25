'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Volume2, VolumeX, Maximize2, X, Play } from 'lucide-react';
import { ArcadeFrame } from '@/components/ui/ArcadeFrame';
import { resolvePlate } from '@/lib/arcade-screen';
import { useSaveTheServersStore } from '@/store/useSaveTheServersStore';
import { useArcadeStore } from '@/store/useArcadeStore';
import { playSfx } from '@/lib/sfx';
import { ArcadeCanvas } from './ArcadeCanvas';
import { GameSelector } from './GameSelector';
import { SkinShop } from './SkinShop';
import { RotateScreen } from './RotateScreen';
import { gameMeta, DEFAULT_GAME_ID } from './registry';

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

// Зал автоматов. Десктоп: канвас в ленте + клоузап-фуллскрин. Тач: в ленте канвас НЕ запускаем
// (экран мелкий) — постер «Играть» → фуллскрин; портрет → экран поворота; ландшафт → игра.
export function ArcadeHost() {
  const selectedGameId = useArcadeStore((s) => s.selectedGameId);
  const selectGame = useArcadeStore((s) => s.selectGame);
  const muted = useArcadeStore((s) => s.muted);
  const toggleMuted = useArcadeStore((s) => s.toggleMuted);

  const [immersive, setImmersive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Тач фиксируем один раз; ориентацию — matchMedia (НЕ window.orientation/resize).
  const [isTouch] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  const [isLandscape, setIsLandscape] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : true,
  );
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void useArcadeStore.persist.rehydrate();
    void useSaveTheServersStore.persist.rehydrate();
    const mq = window.matchMedia('(orientation: landscape)');
    const onOri = () => setIsLandscape(mq.matches);
    mq.addEventListener('change', onOri);
    setHydrated(true);
    return () => mq.removeEventListener('change', onOri);
  }, []);

  const exit = useCallback(() => {
    setImmersive(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  const enter = useCallback(() => {
    setImmersive(true);
    const el = overlayRef.current;
    if (el?.requestFullscreen) {
      void el
        .requestFullscreen()
        .then(() => {
          // Прогрессив-энхансмент: лок ориентации (на iOS нет — поведение одинаково без него).
          const orient = window.screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          orient?.lock?.('landscape').catch(() => {});
        })
        .catch(() => {});
    }
  }, []);

  // Escape + синк выхода из нативного FS + блок скролла body в фуллскрине.
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit();
    };
    const onFsChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.body.style.overflow = '';
    };
  }, [immersive, exit]);

  const selMeta = gameMeta(selectedGameId);
  const meta = selMeta?.load ? selMeta : gameMeta(DEFAULT_GAME_ID);
  const load = meta?.load;
  const isSaveTheServers = meta?.id === 'save-the-servers';

  // Канвас запускаем: десктоп — всегда; тач — только в ландшафтном фуллскрине.
  const runCanvas = hydrated && !!load && (!isTouch || (immersive && isLandscape));

  // wakeLock, пока игра активна в фуллскрине (экран не гаснет посреди партии).
  useEffect(() => {
    if (!immersive || !runCanvas) return;
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      nav.wakeLock
        ?.request('screen')
        .then((s) => {
          if (cancelled) void s.release().catch(() => {});
          else sentinel = s;
        })
        .catch(() => {});
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release().catch(() => {});
    };
  }, [immersive, runCanvas]);

  const onToggleMute = () => {
    const willUnmute = muted;
    toggleMuted();
    if (willUnmute) playSfx('confirm'); // жест пользователя разблокирует AudioContext
  };

  const plateRatio = resolvePlate(immersive ? 'fullscreen' : 'site').ratio;

  // Содержимое «экрана» автомата.
  let screenContent: ReactNode;
  if (!hydrated) {
    screenContent = <div className="h-full w-full animate-pulse bg-black" />;
  } else if (runCanvas && load) {
    screenContent = (
      <ArcadeCanvas
        load={load}
        preset={immersive ? 'fullscreen' : 'site'}
        lockTouch={immersive}
        ariaLabel={`Мини-игра: ${meta?.title ?? ''}`}
      />
    );
  } else if (isTouch && immersive && !isLandscape) {
    screenContent = <RotateScreen onBack={exit} />;
  } else {
    // Тач в ленте: канвас не запускаем — постер с «Играть» ведёт в фуллскрин.
    screenContent = (
      <button
        type="button"
        onClick={enter}
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-black text-(--primary) select-none"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-(--primary)">
          <Play size={20} className="ml-0.5" />
        </span>
        <span className="font-blender-medium text-xs uppercase tracking-widest">Играть</span>
        <span className="text-type-micro font-blender-book text-text-secondary">{meta?.title ?? ''}</span>
      </button>
    );
  }

  const MuteButton = (
    <button
      type="button"
      onClick={onToggleMute}
      aria-pressed={!muted}
      className="flex h-9 items-center gap-2 rounded-xs border border-lines-hover bg-(--color-base)/70 px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary backdrop-blur-sm transition-colors hover:border-(--primary) hover:text-(--primary)"
    >
      {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      {muted ? 'Звук выкл' : 'Звук вкл'}
    </button>
  );

  const cabinet = (
    <div
      ref={overlayRef}
      className={
        immersive
          ? 'fixed inset-0 z-70 flex items-center justify-center bg-black p-2'
          : 'flex shrink-0 flex-col items-center gap-3 lg:sticky lg:top-20'
      }
      style={
        immersive
          ? { paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }
          : undefined
      }
    >
      <div
        className={immersive ? 'max-h-dvh' : 'w-full max-w-80'}
        style={immersive ? { width: `min(100vw, calc(100dvh * ${plateRatio}))` } : undefined}
      >
        <ArcadeFrame view={immersive ? 'fullscreen' : 'site'}>{screenContent}</ArcadeFrame>
      </div>

      {immersive ? (
        <div className="fixed top-4 right-4 z-71 flex items-center gap-2" style={{ paddingRight: 'env(safe-area-inset-right)' }}>
          {MuteButton}
          <button
            type="button"
            onClick={exit}
            className="flex h-9 items-center gap-2 rounded-xs border border-lines-hover bg-(--color-base)/70 px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary backdrop-blur-sm transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <X size={15} />
            Выход · Esc
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {MuteButton}
          {!isTouch && (
            <button
              type="button"
              onClick={enter}
              className="flex h-9 items-center gap-2 rounded-xs border border-(--primary) px-3 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
            >
              <Maximize2 size={14} />
              Развернуть
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      {cabinet}
      <div className={`flex min-w-0 flex-1 flex-col gap-6 ${immersive ? 'pointer-events-none opacity-0' : ''}`}>
        <GameSelector selectedId={meta?.id ?? DEFAULT_GAME_ID} onSelect={selectGame} />
        {isSaveTheServers && <SkinShop />}
      </div>
    </div>
  );
}
