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

export interface QuestMapViewportRef {
  /** Pan + zoom the viewport so canvas point (cx, cy) is centered on screen. */
  setCenter(cx: number, cy: number, opts?: { zoom?: number; duration?: number }): void;
  /** Fit a bounding box into view with optional padding. */
  fitToBounds(bounds: Bounds, opts?: { padding?: number; duration?: number }): void;
  getTransform(): Transform;
  zoomIn():  void;
  zoomOut(): void;
}

interface Props {
  children?:          ReactNode;
  connections?:       ConnectionDef[];
  chainSet?:          Set<string> | null;
  className?:         string;
  style?:             CSSProperties;
  initialTransform?:  Transform;
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
      chainSet,
      className,
      style,
      initialTransform,
      onTransformChange,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef    = useRef<HTMLDivElement>(null);
    const svgRef       = useRef<SVGSVGElement>(null);

    // Mutable transform — NOT React state, mutated synchronously on every frame
    const transform = useRef<Transform>(initialTransform ?? { x: 0, y: 0, scale: 1 });

    // Pointer drag state
    const drag = useRef<{
      active:         boolean;
      pointerId:      number;
      startClientX:   number;
      startClientY:   number;
      startX:         number;
      startY:         number;
      hasMoved:       boolean;
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

    // ── Pointer down — begin pan ──────────────────────────────────────────
    const onPointerDown = useCallback((e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Don't cancel UI clicks on nodes — only start pan from the container bg
      const target = e.target as HTMLElement;
      if (target.closest('[data-no-pan]')) return;

      cancelAnim.current?.();
      cancelAnim.current = null;

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

    // ── Pointer move — pan via RAF ────────────────────────────────────────
    const onPointerMove = useCallback((e: PointerEvent) => {
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

    // ── Pointer up — end pan ──────────────────────────────────────────────
    const onPointerUp = useCallback((e: PointerEvent) => {
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
      </div>
    );
  },
);

QuestMapViewport.displayName = 'QuestMapViewport';
