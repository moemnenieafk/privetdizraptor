'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Maximize2, X } from 'lucide-react';
import { ArcadeFrame } from '@/components/ui/ArcadeFrame';
import { resolvePlate } from '@/lib/arcade-screen';
import { useSaveTheServersStore } from '@/store/useSaveTheServersStore';
import { useArcadeStore } from '@/store/useArcadeStore';
import { playSfx } from '@/lib/sfx';
import { ArcadeCanvas } from './ArcadeCanvas';
import { GameSelector } from './GameSelector';
import { SkinShop } from './SkinShop';
import { gameMeta, DEFAULT_GAME_ID } from './registry';

// Site-вид зала + иммерсивный фуллскрин («наклонился к автомату»). КРИТИЧНО (хендофф §8):
// переход site↔fullscreen НЕ пересобирает канвас — рендерим ЕДИНЫЙ инстанс ArcadeFrame/
// ArcadeCanvas, меняем только классы обёртки и view. Мобильный поворот/тач-гейт — фаза E.
export function ArcadeHost() {
  const selectedGameId = useArcadeStore((s) => s.selectedGameId);
  const selectGame = useArcadeStore((s) => s.selectGame);
  const muted = useArcadeStore((s) => s.muted);
  const toggleMuted = useArcadeStore((s) => s.toggleMuted);

  const [immersive, setImmersive] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void useArcadeStore.persist.rehydrate();
    void useSaveTheServersStore.persist.rehydrate();
  }, []);

  const exit = useCallback(() => {
    setImmersive(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  const enter = useCallback(() => {
    setImmersive(true);
    // Прогрессив-энхансмент: настоящий фуллскрин, если доступен.
    const el = overlayRef.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }, []);

  // Escape закрывает фуллскрин; синк, если юзер вышел из нативного FS.
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
  const isSaveTheServers = meta?.id === 'save-the-servers';

  const onToggleMute = () => {
    const willUnmute = muted;
    toggleMuted();
    if (willUnmute) playSfx('confirm'); // жест пользователя разблокирует AudioContext
  };

  // Пропорция фронт-плиты — чтобы в фуллскрине уместить автомат по высоте.
  const plateRatio = resolvePlate(immersive ? 'fullscreen' : 'site').ratio;

  const canvas = meta?.load ? (
    <ArcadeCanvas load={meta.load} preset={immersive ? 'fullscreen' : 'site'} ariaLabel={`Мини-игра: ${meta.title}`} />
  ) : (
    <div className="h-full w-full bg-black" />
  );

  // Единый инстанс кабинета: меняем ТОЛЬКО обёртку и view (канвас не пересобирается).
  const cabinet = (
    <div
      ref={overlayRef}
      className={
        immersive
          ? 'fixed inset-0 z-70 flex items-center justify-center bg-black p-2'
          : 'flex shrink-0 flex-col items-center gap-3 lg:sticky lg:top-20'
      }
    >
      <div
        className={immersive ? 'max-h-dvh' : 'w-full max-w-80'}
        style={immersive ? { width: `min(100vw, calc(100dvh * ${plateRatio}))` } : undefined}
      >
        <ArcadeFrame view={immersive ? 'fullscreen' : 'site'}>{canvas}</ArcadeFrame>
      </div>

      {immersive ? (
        <button
          type="button"
          onClick={exit}
          className="fixed top-4 right-4 z-71 flex h-10 items-center gap-2 rounded-xs border border-lines-hover bg-(--color-base)/80 px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary backdrop-blur-sm transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <X size={15} />
          Выход · Esc
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-pressed={!muted}
            className="flex h-9 items-center gap-2 rounded-xs border border-lines-hover px-3 font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {muted ? 'Звук выкл' : 'Звук вкл'}
          </button>
          <button
            type="button"
            onClick={enter}
            className="flex h-9 items-center gap-2 rounded-xs border border-(--primary) px-3 font-blender-medium text-type-micro uppercase tracking-widest text-(--primary) transition-colors hover:bg-(--primary) hover:text-(--color-base)"
          >
            <Maximize2 size={14} />
            Развернуть
          </button>
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
