'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Transform {
  x:     number;
  y:     number;
  scale: number;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ConnectionDef {
  id:           string;
  d:            string;
  stroke:       string;
  opacity:      number;
  nodeIds?:     [string, string];
  strokeWidth?: number;
  dashArray?:   string;
  className?:   string;
}

export interface BackgroundRect {
  key:    string;
  x:      number;
  y:      number;
  width:  number;
  height: number;
  fill:   string;
}

export interface QuestMapViewportRef {
  /** Pan + zoom the viewport so canvas point (cx, cy) is centered on screen. */
  setCenter(cx: number, cy: number, opts?: { zoom?: number; duration?: number }): void;
  /** Fit a bounding box into view with optional padding. */
  fitToBounds(bounds: Bounds, opts?: { padding?: number; duration?: number }): void;
  getTransform(): Transform;
  /** Convert screen (client) coordinates to canvas coordinates. */
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  zoomIn():  void;
  zoomOut(): void;
}

interface Props {
  children?:          ReactNode;
  connections?:       ConnectionDef[];
  backgroundRects?:   BackgroundRect[];
  chainSet?:          Set<string> | null;
  className?:         string;
  style?:             CSSProperties;
  initialTransform?:  Transform;
  /** When true, LMB drag on empty canvas draws a rubber-band selection instead of panning. */
  isDragMode?:        boolean;
  /** Called with canvas-space rect after rubber-band ends (width/height > 4px). */
  onBoxSelect?:       (x0: number, y0: number, x1: number, y1: number) => void;
  /** Debounced (60 ms) callback after pan/zoom settles. */
  onTransformChange?: (t: Transform) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZOOM_MIN  = 0.05;
const ZOOM_MAX  = 2.0;
const ZOOM_STEP = 0.25;   // for button +/-
const PAN_CLAMP = 100_000; // large enough for any graph size

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Apply transform directly to a DOM element — zero React re-renders. */
function applyDOM(el: HTMLElement | SVGSVGElement, t: Transform): void {
  (el as HTMLElement).style.transform =
    `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`;
}

/** Clamp pan so the canvas doesn't fly completely off-screen. */
function clamp(vp: HTMLElement, t: Transform): Transform {
  const W  = vp.clientWidth;
  const H  = vp.clientHeight;
  const mg = PAN_CLAMP * t.scale;
  return {
    x:     Math.max(W - mg, Math.min(mg, t.x)),
    y:     Math.max(H - mg, Math.min(mg, t.y)),
    scale: t.scale,
  };
}

/** Animate between two transforms, returns a cancel function. */
function tween(
  from:     Transform,
  to:       Transform,
  duration: number,
  onTick:   (t: Transform) => void,
  onDone?:  () => void,
): () => void {
  const start = performance.now();
  let raf = 0;

  function tick(now: number): void {
    const p = Math.min(1, (now - start) / duration);
    const e = 1 - (1 - p) ** 3; // ease-out cubic
    onTick({
      x:     from.x + (to.x - from.x) * e,
      y:     from.y + (to.y - from.y) * e,
      scale: from.scale + (to.scale - from.scale) * e,
    });
    if (p < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  }

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const QuestMapViewport = forwardRef<QuestMapViewportRef, Props>(
  (
    {
      children,
      connections = [],
      backgroundRects = [],
      chainSet,
      className,
      style,
      initialTransform,
      isDragMode,
      onBoxSelect,
      onTransformChange,
    },
    ref,
  ) => {
    const containerRef    = useRef<HTMLDivElement>(null);
    const canvasRef       = useRef<HTMLDivElement>(null);
    const svgRef          = useRef<SVGSVGElement>(null);
    const selectionBoxRef = useRef<HTMLDivElement>(null);

    // Mutable transform — NOT React state, mutated synchronously on every frame
    const transform = useRef<Transform>(initialTransform ?? { x: 0, y: 0, scale: 1 });

    // Keep latest callbacks in refs so event closures don't go stale
    const isDragModeRef  = useRef(isDragMode);
    isDragModeRef.current = isDragMode;
    const onBoxSelectRef  = useRef(onBoxSelect);
    onBoxSelectRef.current = onBoxSelect;

    // Pointer drag state — pan
    const drag = useRef<{
      active:         boolean;
      pointerId:      number;
      startClientX:   number;
      startClientY:   number;
      startX:         number;
      startY:         number;
      hasMoved:       boolean;
    } | null>(null);

    // Rubber-band selection state
    const boxDrag = useRef<{ startX: number; startY: number } | null>(null);

    // Активные указатели (touch) + состояние pinch-жеста
    const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
    const pinch = useRef<{
      startDist:  number;
      startScale: number;
      startX:     number;
      startY:     number;
      startMidX:  number;
      startMidY:  number;
    } | null>(null);

    const rafId      = useRef(0);
    const cancelAnim = useRef<(() => void) | null>(null);
    const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Commit transform to both DOM layers simultaneously ─────────────────
    const commit = useCallback((t: Transform) => {
      transform.current = t;
      if (canvasRef.current) applyDOM(canvasRef.current, t);
      if (svgRef.current)    applyDOM(svgRef.current,    t);
    }, []);

    const notify = useCallback((t: Transform) => {
      if (!onTransformChange) return;
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => onTransformChange(t), 60);
    }, [onTransformChange]);

    const commitAndNotify = useCallback((t: Transform) => {
      commit(t);
      notify(t);
    }, [commit, notify]);

    // ── Pointer down — begin pan OR rubber-band selection ────────────────
    const onPointerDown = useCallback((e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Don't cancel UI clicks on nodes — only start from the container bg
      const target = e.target as HTMLElement;
      // Touch: панорамировать можно с любого места, включая карточки квестов —
      // блокируем только настоящие интерактивные элементы (кнопки/ссылки/поля),
      // чтобы тап по «Выполнено?» и пунктам задач продолжал работать.
      // Мышь: прежнее поведение — [data-no-pan] полностью исключён из pan
      // (иначе сломается drag нод в дев-режиме).
      if (e.pointerType === 'mouse') {
        if (target.closest('[data-no-pan]')) return;
      } else if (target.closest('button, a, input, select, textarea, [role="button"], [contenteditable="true"]')) {
        return;
      }

      cancelAnim.current?.();
      cancelAnim.current = null;

      // Регистрируем касание. Второй палец → pinch-zoom (мобилка), pan отменяем.
      if (e.pointerType !== 'mouse') {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { target.setPointerCapture(e.pointerId); } catch {}
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          if (dist > 0) {
            drag.current = null;
            containerRef.current?.classList.remove('[&]:cursor-grabbing');
            pinch.current = {
              startDist:  dist,
              startScale: transform.current.scale,
              startX:     transform.current.x,
              startY:     transform.current.y,
              startMidX:  (a.x + b.x) / 2,
              startMidY:  (a.y + b.y) / 2,
            };
          }
          return;
        }
        if (pointers.current.size > 2) return;
      }

      if (isDragModeRef.current) {
        // Rubber-band selection instead of pan
        const cont = containerRef.current;
        if (!cont) return;
        const rect = cont.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        boxDrag.current = { startX: e.clientX, startY: e.clientY };
        const el = selectionBoxRef.current;
        if (el) {
          el.style.left    = `${x}px`;
          el.style.top     = `${y}px`;
          el.style.width   = '0px';
          el.style.height  = '0px';
          el.style.display = 'block';
        }
        try { target.setPointerCapture(e.pointerId); } catch {}
        return;
      }

      drag.current = {
        active:       true,
        pointerId:    e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX:       transform.current.x,
        startY:       transform.current.y,
        hasMoved:     false,
      };

      containerRef.current?.classList.add('[&]:cursor-grabbing');
      try { target.setPointerCapture(e.pointerId); } catch {}
    }, []);

    // ── Pointer move — rubber-band update OR pan via RAF ─────────────────
    const onPointerMove = useCallback((e: PointerEvent) => {
      // Pinch-zoom: масштаб по расстоянию между пальцами, панорама по их центру.
      if (e.pointerType !== 'mouse' && pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (pinch.current && pointers.current.size >= 2) {
        const vp = containerRef.current;
        if (!vp) return;
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist <= 0) return;

        const p        = pinch.current;
        const rect     = vp.getBoundingClientRect();
        const oldScale = p.startScale;
        const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldScale * (dist / p.startDist)));

        // Точка канваса под стартовым центром пальцев остаётся на месте,
        // плюс сам центр может двигаться — это даёт одновременный zoom + pan.
        const midX0 = p.startMidX - rect.left;
        const midY0 = p.startMidY - rect.top;
        const midX1 = (a.x + b.x) / 2 - rect.left;
        const midY1 = (a.y + b.y) / 2 - rect.top;
        const ratio = newScale / oldScale;

        const nx = midX1 - (midX0 - p.startX) * ratio;
        const ny = midY1 - (midY0 - p.startY) * ratio;

        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          const el = containerRef.current;
          if (!el) return;
          commitAndNotify(clamp(el, { x: nx, y: ny, scale: newScale }));
        });
        return;
      }

      if (boxDrag.current) {
        const cont = containerRef.current;
        const el   = selectionBoxRef.current;
        if (!cont || !el) return;
        const rect = cont.getBoundingClientRect();
        const x0   = boxDrag.current.startX - rect.left;
        const y0   = boxDrag.current.startY - rect.top;
        const x1   = e.clientX - rect.left;
        const y1   = e.clientY - rect.top;
        el.style.left   = `${Math.min(x0, x1)}px`;
        el.style.top    = `${Math.min(y0, y1)}px`;
        el.style.width  = `${Math.abs(x1 - x0)}px`;
        el.style.height = `${Math.abs(y1 - y0)}px`;
        return;
      }

      if (!drag.current?.active) return;

      const dx = e.clientX - drag.current.startClientX;
      const dy = e.clientY - drag.current.startClientY;
      drag.current.hasMoved = drag.current.hasMoved || Math.abs(dx) > 2 || Math.abs(dy) > 2;

      if (!drag.current.hasMoved) return;

      const nx = drag.current.startX + dx;
      const ny = drag.current.startY + dy;

      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const vp = containerRef.current;
        if (!vp) return;
        const next = clamp(vp, { ...transform.current, x: nx, y: ny });
        commitAndNotify(next);
      });
    }, [commitAndNotify]);

    // ── Pointer up — finalize rubber-band OR end pan ─────────────────────
    const onPointerUp = useCallback((e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2 && pinch.current) {
          // Палец убран — pinch закончен. Оставшийся палец не превращаем в pan
          // (иначе карта дёргается), ждём нового касания.
          pinch.current = null;
          if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
          try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
          return;
        }
      }

      if (boxDrag.current) {
        const el = selectionBoxRef.current;
        if (el) el.style.display = 'none';

        const cb   = onBoxSelectRef.current;
        const vp   = containerRef.current;
        if (cb && vp) {
          const rect  = vp.getBoundingClientRect();
          const t     = transform.current;
          const toCanvas = (sx: number, sy: number) => ({
            x: (sx - t.x) / t.scale,
            y: (sy - t.y) / t.scale,
          });
          const x0s = boxDrag.current.startX - rect.left;
          const y0s = boxDrag.current.startY - rect.top;
          const x1s = e.clientX - rect.left;
          const y1s = e.clientY - rect.top;
          const c0  = toCanvas(Math.min(x0s, x1s), Math.min(y0s, y1s));
          const c1  = toCanvas(Math.max(x0s, x1s), Math.max(y0s, y1s));
          cb(c0.x, c0.y, c1.x, c1.y);
        }
        boxDrag.current = null;
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
        return;
      }

      if (!drag.current) return;
      drag.current = null;
      if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
      containerRef.current?.classList.remove('[&]:cursor-grabbing');
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    }, []);

    // ── Wheel — zoom to cursor ────────────────────────────────────────────
    const onWheel = useCallback((e: WheelEvent) => {
      const vp = containerRef.current;
      if (!vp) return;
      e.preventDefault();
      e.stopPropagation();

      const rect   = vp.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Normalize wheel delta across trackpad / line / page modes
      const rawDelta = e.deltaMode === 1 ? e.deltaY * 30
                     : e.deltaMode === 2 ? e.deltaY * 600
                     : e.deltaY;

      // Exponential zoom — feels linear in log space
      const factor   = Math.exp(-rawDelta * 0.002);
      const oldScale = transform.current.scale;
      const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldScale * factor));
      if (Math.abs(newScale - oldScale) < 0.0001) return;

      // cor3 formula: keep canvas point under cursor stationary
      const ratio = newScale / oldScale;
      const newX  = mouseX - (mouseX - transform.current.x) * ratio;
      const newY  = mouseY - (mouseY - transform.current.y) * ratio;

      const next = clamp(vp, { x: newX, y: newY, scale: newScale });
      commitAndNotify(next);
    }, [commitAndNotify]);

    // ── Register all events on the container element ──────────────────────
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      el.addEventListener('pointerdown',   onPointerDown);
      el.addEventListener('pointermove',   onPointerMove);
      el.addEventListener('pointerup',     onPointerUp);
      el.addEventListener('pointercancel', onPointerUp);
      el.addEventListener('wheel',         onWheel, { passive: false });
      return () => {
        el.removeEventListener('pointerdown',   onPointerDown);
        el.removeEventListener('pointermove',   onPointerMove);
        el.removeEventListener('pointerup',     onPointerUp);
        el.removeEventListener('pointercancel', onPointerUp);
        el.removeEventListener('wheel',         onWheel);
      };
    }, [onPointerDown, onPointerMove, onPointerUp, onWheel]);

    // ── Initial center on mount ───────────────────────────────────────────
    useEffect(() => {
      if (initialTransform) { commit(initialTransform); return; }
      const vp = containerRef.current;
      if (!vp) return;
      const t: Transform = { x: vp.clientWidth / 2, y: vp.clientHeight / 2, scale: 1.0 };
      commit(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Cleanup ───────────────────────────────────────────────────────────
    useEffect(() => () => {
      cancelAnim.current?.();
      if (debounce.current) clearTimeout(debounce.current);
    }, []);

    // ── Imperative API ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      setCenter(cx, cy, opts = {}) {
        const vp = containerRef.current;
        if (!vp) return;
        const { zoom = transform.current.scale, duration = 500 } = opts;
        const to = clamp(vp, {
          x:     vp.clientWidth  / 2 - cx * zoom,
          y:     vp.clientHeight / 2 - cy * zoom,
          scale: zoom,
        });
        if (duration <= 0) { commitAndNotify(to); return; }
        cancelAnim.current?.();
        cancelAnim.current = tween(
          { ...transform.current },
          to,
          duration,
          (t) => commit(t),
          () => { notify(to); cancelAnim.current = null; },
        );
      },

      fitToBounds(bounds, opts = {}) {
        const vp = containerRef.current;
        if (!vp) return;
        const { padding = 0.08, duration = 600 } = opts;
        const bW = bounds.maxX - bounds.minX;
        const bH = bounds.maxY - bounds.minY;
        if (bW <= 0 || bH <= 0) return;
        const scaleX = (vp.clientWidth  * (1 - padding * 2)) / bW;
        const scaleY = (vp.clientHeight * (1 - padding * 2)) / bH;
        const scale  = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(scaleX, scaleY)));
        const cx     = bounds.minX + bW / 2;
        const cy     = bounds.minY + bH / 2;
        const to     = clamp(vp, {
          x:     vp.clientWidth  / 2 - cx * scale,
          y:     vp.clientHeight / 2 - cy * scale,
          scale,
        });
        if (duration <= 0) { commitAndNotify(to); return; }
        cancelAnim.current?.();
        cancelAnim.current = tween(
          { ...transform.current },
          to,
          duration,
          (t) => commit(t),
          () => { notify(to); cancelAnim.current = null; },
        );
      },

      getTransform: () => ({ ...transform.current }),

      screenToCanvas(sx, sy) {
        const vp = containerRef.current;
        if (!vp) return { x: 0, y: 0 };
        const rect = vp.getBoundingClientRect();
        const { x: tx, y: ty, scale } = transform.current;
        return {
          x: (sx - rect.left - tx) / scale,
          y: (sy - rect.top  - ty) / scale,
        };
      },

      zoomIn() {
        const vp = containerRef.current;
        if (!vp) return;
        const cx = vp.clientWidth  / 2;
        const cy = vp.clientHeight / 2;
        const oldScale = transform.current.scale;
        const newScale = Math.min(ZOOM_MAX, oldScale + ZOOM_STEP);
        const ratio    = newScale / oldScale;
        const next = clamp(vp, {
          x:     cx - (cx - transform.current.x) * ratio,
          y:     cy - (cy - transform.current.y) * ratio,
          scale: newScale,
        });
        cancelAnim.current?.();
        cancelAnim.current = tween(
          { ...transform.current }, next, 200,
          (t) => commit(t),
          () => { notify(next); cancelAnim.current = null; },
        );
      },

      zoomOut() {
        const vp = containerRef.current;
        if (!vp) return;
        const cx = vp.clientWidth  / 2;
        const cy = vp.clientHeight / 2;
        const oldScale = transform.current.scale;
        const newScale = Math.max(ZOOM_MIN, oldScale - ZOOM_STEP);
        const ratio    = newScale / oldScale;
        const next = clamp(vp, {
          x:     cx - (cx - transform.current.x) * ratio,
          y:     cy - (cy - transform.current.y) * ratio,
          scale: newScale,
        });
        cancelAnim.current?.();
        cancelAnim.current = tween(
          { ...transform.current }, next, 200,
          (t) => commit(t),
          () => { notify(next); cancelAnim.current = null; },
        );
      },
    }), [commit, commitAndNotify, notify]);

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
      <div
        ref={containerRef}
        className={`bg-(--color-base) overflow-hidden cursor-grab touch-none select-none${className ? ` ${className}` : ' relative'}`}
        style={style}
      >
        {/* ── SVG connection layer (same transform, behind nodes) ────── */}
        <svg
          ref={svgRef}
          aria-hidden
          className="absolute top-0 left-0 pointer-events-none overflow-visible z-0"
          style={{
            width:           1,
            height:          1,
            transformOrigin: '0 0',
            willChange:      'transform',
          }}
        >
          <defs>
            <filter id="qm-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {backgroundRects.map(r => (
            <rect
              key={r.key}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={r.fill}
              rx={8}
            />
          ))}

          {connections.map((c) => {
            const finalOpacity = c.nodeIds && chainSet
              ? (chainSet.has(c.nodeIds[0]) && chainSet.has(c.nodeIds[1]) ? c.opacity : 0.05)
              : c.opacity;
            return (
              <path
                key={c.id}
                d={c.d}
                fill="none"
                stroke={c.stroke}
                strokeWidth={c.strokeWidth ?? 2}
                opacity={finalOpacity}
                strokeDasharray={c.dashArray ?? '14 7'}
                strokeLinecap="round"
                className={c.className}
              />
            );
          })}
        </svg>

        {/* ── Canvas: absolute-positioned quest nodes ────────────────── */}
        <div
          ref={canvasRef}
          className="absolute top-0 left-0 z-10"
          style={{ transformOrigin: '0 0', willChange: 'transform' }}
        >
          {children}
        </div>

        {/* ── Rubber-band selection rect (screen space, hidden by default) ── */}
        <div
          ref={selectionBoxRef}
          className="absolute z-50 pointer-events-none border border-white/40 bg-white/5 rounded-xs"
          style={{ display: 'none' }}
        />
      </div>
    );
  },
);

QuestMapViewport.displayName = 'QuestMapViewport';
