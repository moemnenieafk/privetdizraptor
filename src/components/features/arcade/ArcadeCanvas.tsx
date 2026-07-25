'use client';

import { useEffect, useRef, useState } from 'react';
import type { ArcadeGame, ArcadeGameData, ArcadeGameFactory } from './types';
import { ARCADE_W, ARCADE_H } from './types';
import { createCrtRenderer, type CrtPreset, type CrtRenderer } from './crt';

interface ArcadeCanvasProps {
  /** Динамический загрузчик фабрики игры (bundle-split). */
  load: () => Promise<ArcadeGameFactory>;
  preset: CrtPreset;
  ariaLabel: string;
  /** touch-action:none — ТОЛЬКО когда игра активна и в фуллскрине (в ленте страница обязана скроллиться). */
  lockTouch?: boolean;
  /** Серверные данные для игры (напр. колода бартеров game03). */
  gameData?: ArcadeGameData;
}

// Хост канваса: offscreen 2D 640×480 (игра рисует) → CRT-пасс на display-канвасе.
// Ввод — только Pointer Events (одна ветка мышь+тач), координаты простым масштабом от rect.
// Пауза при уходе вкладки в фон и из вьюпорта. Полный клинап rAF/слушателей.
export function ArcadeCanvas({ load, preset, ariaLabel, lockTouch, gameData }: ArcadeCanvasProps) {
  const displayRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  // Мутабельный ввод, живёт между кадрами (НЕ в React-стейте).
  const keys = useRef<Set<string>>(new Set());
  const presetRef = useRef<CrtPreset>(preset);
  const gameDataRef = useRef(gameData);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    gameDataRef.current = gameData;
  }, [gameData]);

  useEffect(() => {
    const display = displayRef.current;
    if (!display) return;
    const keySet = keys.current;

    // Offscreen-канвас игры.
    const offscreen = document.createElement('canvas');
    offscreen.width = ARCADE_W;
    offscreen.height = ARCADE_H;
    const gctx = offscreen.getContext('2d');
    if (!gctx) return;
    gctx.imageSmoothingEnabled = true;

    // Состояние указателя. latch держит нажатие видимым хотя бы один кадр — иначе
    // быстрый тап (down+up внутри одного кадра) теряется при поллинге.
    let posX = ARCADE_W / 2;
    let posY = ARCADE_H / 2;
    let realDown = false;
    let latch = false;
    let active = false;
    const buildPointer = () => (active ? { x: posX, y: posY, down: realDown || latch } : null);

    const crt: CrtRenderer = createCrtRenderer(display, presetRef.current);

    let game: ArcadeGame | null = null;
    let raf = 0;
    let last = 0;
    let paused = false;
    let disposed = false;

    // Подгон буфера под CSS-размер бокса экрана.
    const resize = () => {
      const r = display.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) crt.resize(r.width, r.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(display);
    resize();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (paused || !game) return;
      const dt = last ? now - last : 16.7;
      last = now;
      crt.setPreset(presetRef.current);
      game.frame(
        { ctx: gctx, width: ARCADE_W, height: ARCADE_H, input: { keys: keySet, pointer: buildPointer() } },
        dt,
      );
      crt.render(offscreen);
      latch = false; // нажатие показали кадру — сбрасываем
    };

    // ─── Пауза: вкладка в фоне / автомат вне вьюпорта ───
    const setPaused = (v: boolean) => {
      if (v === paused) return;
      paused = v;
      last = 0;
    };
    const onVisibility = () => setPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting || document.visibilityState === 'hidden'), {
      threshold: 0.15,
    });
    io.observe(display);

    // ─── Pointer Events (одна ветка мышь+тач) ───
    const toLogical = (e: PointerEvent) => {
      const r = display.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * ARCADE_W;
      const y = ((e.clientY - r.top) / r.height) * ARCADE_H;
      posX = Math.max(0, Math.min(ARCADE_W, x));
      posY = Math.max(0, Math.min(ARCADE_H, y));
    };
    const onDown = (e: PointerEvent) => {
      toLogical(e);
      realDown = true;
      latch = true;
      active = true;
      display.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      toLogical(e);
      active = true;
    };
    const onUp = (e: PointerEvent) => {
      toLogical(e);
      realDown = false;
      display.releasePointerCapture?.(e.pointerId);
    };
    const onLeave = () => {
      active = false;
      realDown = false;
    };
    display.addEventListener('pointerdown', onDown);
    display.addEventListener('pointermove', onMove);
    display.addEventListener('pointerup', onUp);
    display.addEventListener('pointercancel', onUp);
    display.addEventListener('pointerleave', onLeave);

    // ─── Клавиатура (a11y: игра проходима с клавиатуры) ───
    const onKeyDown = (e: KeyboardEvent) => keySet.add(e.key);
    const onKeyUp = (e: KeyboardEvent) => keySet.delete(e.key);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ─── Загрузка модуля игры ───
    load().then((factory) => {
      if (disposed) return;
      game = factory(gameDataRef.current);
      game.init({ ctx: gctx, width: ARCADE_W, height: ARCADE_H, input: { keys: keySet, pointer: buildPointer() } });
      setLoading(false);
      raf = requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      display.removeEventListener('pointerdown', onDown);
      display.removeEventListener('pointermove', onMove);
      display.removeEventListener('pointerup', onUp);
      display.removeEventListener('pointercancel', onUp);
      display.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      keySet.clear();
      game?.dispose();
      crt.dispose();
    };
  }, [load]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={displayRef}
        aria-label={ariaLabel}
        role="img"
        tabIndex={0}
        className="absolute inset-0 h-full w-full select-none outline-none [image-rendering:pixelated] [-webkit-touch-callout:none]"
        style={{ touchAction: lockTouch ? 'none' : 'auto' }}
      />
      {loading && (
        <div className="absolute inset-0 animate-pulse bg-black" aria-hidden />
      )}
    </div>
  );
}
