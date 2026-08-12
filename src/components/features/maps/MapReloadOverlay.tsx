'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapUiStore } from '@/store/useMapUiStore';

/**
 * Фирменный оверлей «пересборки слоя» поверх карты (см. store `reloadOverlay`).
 *
 * Зачем: после мутации метки страница делает full-reload (router.refresh роняет
 * Leaflet-перемонтаж → 500). Этот оверлей висит всю паузу reload'а, превращая
 * технический сбой в стильную обратную связь. `tone:'error'` — реальный сбой записи
 * (reload НЕ идёт, показываем кнопку «Закрыть»).
 *
 * Лоадер — пиксель-морф-грид в духе Marathon-референса (свой глиф-набор, не их ассет):
 * рассыпь → ромб → монограмма ЦТА → крест → … Акцент = var(--primary) (авто-цвет игры).
 */

const GRID = 15;
const MID = (GRID - 1) / 2;

// Монограмма «ЦТА» — буквы Ц·Т·А, значения 2 = акцент (горит --primary).
// Рисуется прямо здесь, чтобы читалась в пиксель-сетке (SVG-лого в 15px не разобрать).
const CTA_ROWS = [
  '...............',
  '...............',
  '...............',
  '...............',
  '...............',
  '..@.@.@@@..@....',
  '..@.@..@..@.@...',
  '..@.@..@..@@@...',
  '..@.@..@..@.@...',
  '..@@@..@..@.@...',
  '....@..........',
  '...............',
  '...............',
  '...............',
  '...............',
].map((r) => r.padEnd(GRID, '.').slice(0, GRID));

type Cell = 0 | 1 | 2; // 0 — фон-сетка, 1 — тело (приглушённое), 2 — акцент
type Glyph = Cell[][];

const blank = (): Glyph => Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => 0 as Cell));

const ctaGlyph = (): Glyph =>
  CTA_ROWS.map((row) => row.split('').map((ch) => (ch === '@' ? 2 : 0) as Cell));

// Ромб-контур: |dr|+|dc| ≈ R. Внешний край — акцент, внутренняя грань — тело.
const diamond = (R: number): Glyph => {
  const g = blank();
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const d = Math.abs(r - MID) + Math.abs(c - MID);
      if (d === R) g[r][c] = 2;
      else if (d === R - 1) g[r][c] = 1;
    }
  return g;
};

// Крест: вертикаль + горизонталь через центр, ядро — акцент.
const cross = (half: number): Glyph => {
  const g = blank();
  for (let i = MID - half; i <= MID + half; i++) {
    g[i][MID] = 2;
    g[MID][i] = 2;
  }
  g[MID][MID] = 2;
  return g;
};

// Детерминированная «рассыпь»: тусклый шум-фон (без Math.random — стабильно между рендерами).
const scatter = (seed: number): Glyph => {
  const g = blank();
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) {
      const h = (r * 928371 + c * 12345 + seed * 6151) % 97;
      if (h < 8) g[r][c] = 2;
      else if (h < 26) g[r][c] = 1;
    }
  return g;
};

// Цикл морфа. ЦТА идёт РАНО (idx 1) и повторяется — за минимальную задержку reload
// (LOADER_MIN_MS) юзер успевает увидеть рассыпь → сборку в монограмму ЦТА.
const CYCLE: Glyph[] = [scatter(1), ctaGlyph(), diamond(6), ctaGlyph(), cross(5), scatter(2)];

const MORPH_MS = 550; // шаг морфа (один кадр) — быстрый, динамичный морф
/**
 * Минимальная длительность показа лоадера перед reload — чтобы анимация гарантированно
 * проигралась хотя бы раз и показала монограмму ЦТА (рассыпь → ЦТА появляется на 2-м кадре).
 * MapViewerClient держит оверлей столько перед window.location.reload().
 */
export const LOADER_MIN_MS = MORPH_MS * 2 + 300; // ~1.4с: scatter → cta (+короткий хвост на показ лого)

function PixelMorph({ frozen }: { frozen: boolean }) {
  // frozen (error / reduce-motion): не морфим — показываем статичную монограмму ЦТА.
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (frozen) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % CYCLE.length), MORPH_MS);
    return () => clearInterval(t);
  }, [frozen]);

  const g = frozen ? ctaGlyph() : CYCLE[idx];
  const cells = useMemo(() => Array.from({ length: GRID * GRID }, (_, k) => k), []);

  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${GRID}, 0.5rem)` }}
      aria-hidden="true"
    >
      {cells.map((k) => {
        const v = g[Math.floor(k / GRID)][k % GRID];
        const accent = v === 2;
        const body = v === 1;
        return (
          <span
            key={k}
            className={`size-2 rounded-xs transition-all duration-500 ease-out ${
              accent ? 'bg-(--primary)' : 'bg-(--color-text-muted)'
            }`}
            style={{
              opacity: accent ? 1 : body ? 0.42 : 0.07,
              boxShadow: accent ? '0 0 8px var(--primary)' : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function MapReloadOverlay() {
  const overlay = useMapUiStore((s) => s.reloadOverlay);
  const setOverlay = useMapUiStore((s) => s.setReloadOverlay);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }, []);

  if (!overlay) return null;
  const isError = overlay.tone === 'error';

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-(--color-base)/92 backdrop-blur-sm animate-[fade-in_0.25s_ease-out_both]">
      <PixelMorph frozen={isError || reduce.current} />

      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <h2
          className={`font-blender-medium text-2xl uppercase tracking-widest md:text-3xl ${
            isError ? 'text-danger' : 'text-(--primary)'
          }`}
          style={{
            textShadow: isError
              ? '0 0 15px rgba(200,60,60,0.35)'
              : '0 0 15px color-mix(in srgb, var(--primary) 35%, transparent)',
          }}
        >
          {overlay.title}
        </h2>
        <div
          className={`h-px w-40 bg-linear-to-r from-transparent to-transparent opacity-60 ${
            isError ? 'via-danger' : 'via-(--primary)'
          }`}
        />
        {overlay.sub && (
          <p className="max-w-sm font-blender-book text-sm text-text-secondary">
            <span className="text-text-muted">&gt; </span>
            {overlay.sub}
            {!isError && <span className="ml-0.5 inline-block w-2 animate-pulse text-(--primary)">▮</span>}
          </p>
        )}
      </div>

      {isError && (
        <button
          type="button"
          onClick={() => setOverlay(null)}
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-md border border-lines-hover bg-card-menu px-8 py-3 transition-all duration-300 hover:border-danger"
        >
          <span className="relative z-10 font-blender-medium uppercase tracking-widest text-text-secondary transition-colors duration-300 group-hover:text-danger">
            Закрыть
          </span>
        </button>
      )}
    </div>
  );
}
