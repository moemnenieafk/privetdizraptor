// Геометрия поля/панели — общая для рендера и ввода (px в логических 640×480).
import { ARCADE_W, ARCADE_H } from '../../types';
import { TOOLS } from './config';

export interface Layout {
  cell: number;
  ox: number;
  oy: number;
  boardW: number;
  boardH: number;
  hudTop: number;
  toolY: number;
  toolH: number;
}

const HUD_TOP = 54;
const TOOL_H = 58;
const CELL_MAX = 46;

export function computeLayout(rows: number, cols: number): Layout {
  const gridH = ARCADE_H - HUD_TOP - TOOL_H;
  const cell = Math.floor(Math.min(gridH / rows, ARCADE_W / cols, CELL_MAX));
  const boardW = cell * cols;
  const boardH = cell * rows;
  const ox = Math.round((ARCADE_W - boardW) / 2);
  const oy = Math.round(HUD_TOP + (gridH - boardH) / 2);
  return { cell, ox, oy, boardW, boardH, hudTop: HUD_TOP, toolY: ARCADE_H - TOOL_H, toolH: TOOL_H };
}

/** Клетка под точкой (лог. px) или null. */
export function cellAt(lay: Layout, rows: number, cols: number, x: number, y: number): { r: number; c: number } | null {
  const c = Math.floor((x - lay.ox) / lay.cell);
  const r = Math.floor((y - lay.oy) / lay.cell);
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return { r, c };
}

export interface ToolRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Прямоугольники кнопок инструментов (по числу TOOLS), ряд снизу. */
export function toolRects(lay: Layout): ToolRect[] {
  const n = TOOLS.length;
  const pad = 8;
  const w = Math.floor((ARCADE_W - pad * (n + 1)) / n);
  const h = lay.toolH - pad * 2;
  return TOOLS.map((_, i) => ({ x: pad + i * (w + pad), y: lay.toolY + pad, w, h }));
}

export function toolIndexAt(lay: Layout, x: number, y: number): number {
  const rects = toolRects(lay);
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}
