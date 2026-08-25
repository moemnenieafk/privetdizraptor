import sharp from 'sharp';
import type { GridGeometry, GridRect } from './types';

/** Единственное место для калибровки. Значения подобраны под 1080p/1440p UI. */
export const GRID_TUNING = {
  minPitch: 38,
  maxPitch: 110,
  /** пустой слот почти однороден — порог по стандартному отклонению яркости */
  emptyStdDev: 9,
  /** доля тёмных пикселей на внутренней границе, при которой считаем это разделителем */
  separatorDarkRatio: 0.7,
  separatorLuma: 70,
  /** какую часть ячейки анализировать, чтобы не цеплять рамку */
  innerInset: 0.16,
} as const;

type Grey = { data: Buffer; width: number; height: number };

async function toGrey(input: Buffer): Promise<Grey> {
  const { data, info } = await sharp(input)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function edgeProfile(grey: Grey, axis: 'x' | 'y'): Float64Array {
  const { data, width, height } = grey;
  const len = axis === 'x' ? width : height;
  const other = axis === 'x' ? height : width;
  const profile = new Float64Array(len);

  for (let i = 1; i < len; i += 1) {
    let sum = 0;
    for (let j = 0; j < other; j += 1) {
      const curr = axis === 'x' ? data[j * width + i] : data[i * width + j];
      const prev = axis === 'x' ? data[j * width + i - 1] : data[(i - 1) * width + j];
      sum += Math.abs(curr - prev);
    }
    profile[i] = sum / other;
  }
  return profile;
}

/** Пик автокорреляции профиля рёбер = шаг сетки. */
function detectPitch(profile: Float64Array): number | null {
  let bestPitch: number | null = null;
  let bestScore = 0;

  for (let pitch = GRID_TUNING.minPitch; pitch <= GRID_TUNING.maxPitch; pitch += 1) {
    let score = 0;
    let samples = 0;
    for (let i = pitch; i < profile.length; i += 1) {
      score += profile[i] * profile[i - pitch];
      samples += 1;
    }
    if (samples === 0) continue;
    const normalized = score / samples;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestPitch = pitch;
    }
  }
  return bestPitch;
}

function detectOrigin(profile: Float64Array, pitch: number): number {
  let bestOffset = 0;
  let bestScore = -1;

  for (let offset = 0; offset < pitch; offset += 1) {
    let score = 0;
    for (let pos = offset; pos < profile.length; pos += pitch) {
      score += profile[pos];
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

export async function detectGeometry(input: Buffer): Promise<GridGeometry | null> {
  const grey = await toGrey(input);
  const profileX = edgeProfile(grey, 'x');
  const profileY = edgeProfile(grey, 'y');

  const pitchX = detectPitch(profileX);
  const pitchY = detectPitch(profileY);
  if (pitchX === null || pitchY === null) return null;

  // сетка квадратная — усредняем и тем самым гасим шум одной из осей
  const pitch = Math.round((pitchX + pitchY) / 2);
  const originX = detectOrigin(profileX, pitch);
  const originY = detectOrigin(profileY, pitch);

  return {
    originX,
    originY,
    pitch,
    cols: Math.floor((grey.width - originX) / pitch),
    rows: Math.floor((grey.height - originY) / pitch),
  };
}

function cellStdDev(grey: Grey, geo: GridGeometry, col: number, row: number): number {
  const inset = Math.round(geo.pitch * GRID_TUNING.innerInset);
  const x0 = geo.originX + col * geo.pitch + inset;
  const y0 = geo.originY + row * geo.pitch + inset;
  const size = geo.pitch - inset * 2;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = y0; y < y0 + size; y += 1) {
    if (y < 0 || y >= grey.height) continue;
    for (let x = x0; x < x0 + size; x += 1) {
      if (x < 0 || x >= grey.width) continue;
      const v = grey.data[y * grey.width + x];
      sum += v;
      sumSq += v * v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

/** Тёмная линия на внутренней границе означает, что два предмета соседствуют. */
function hasSeparator(
  grey: Grey,
  geo: GridGeometry,
  col: number,
  row: number,
  axis: 'vertical' | 'horizontal',
): boolean {
  const span = geo.pitch;
  let dark = 0;
  let total = 0;

  for (let k = 2; k < span - 2; k += 1) {
    const x =
      axis === 'vertical'
        ? geo.originX + (col + 1) * geo.pitch
        : geo.originX + col * geo.pitch + k;
    const y =
      axis === 'vertical'
        ? geo.originY + row * geo.pitch + k
        : geo.originY + (row + 1) * geo.pitch;

    if (x < 0 || x >= grey.width || y < 0 || y >= grey.height) continue;
    if (grey.data[y * grey.width + x] < GRID_TUNING.separatorLuma) dark += 1;
    total += 1;
  }
  return total > 0 && dark / total >= GRID_TUNING.separatorDarkRatio;
}

/**
 * Занятые ячейки склеиваются в прямоугольники предметов.
 * Разделители режут склейку — без этого два соседних 1x1 читаются как один 2x1.
 */
export async function segmentItems(input: Buffer, geo: GridGeometry): Promise<GridRect[]> {
  const grey = await toGrey(input);
  const occupied: boolean[][] = [];

  for (let row = 0; row < geo.rows; row += 1) {
    occupied[row] = [];
    for (let col = 0; col < geo.cols; col += 1) {
      occupied[row][col] = cellStdDev(grey, geo, col, row) > GRID_TUNING.emptyStdDev;
    }
  }

  const visited: boolean[][] = occupied.map((r) => r.map(() => false));
  const rects: GridRect[] = [];

  for (let row = 0; row < geo.rows; row += 1) {
    for (let col = 0; col < geo.cols; col += 1) {
      if (!occupied[row][col] || visited[row][col]) continue;

      let w = 1;
      while (
        col + w < geo.cols &&
        occupied[row][col + w] &&
        !visited[row][col + w] &&
        !hasSeparator(grey, geo, col + w - 1, row, 'vertical')
      ) {
        w += 1;
      }

      let h = 1;
      outer: while (row + h < geo.rows) {
        if (hasSeparator(grey, geo, col, row + h - 1, 'horizontal')) break;
        for (let k = 0; k < w; k += 1) {
          if (!occupied[row + h][col + k] || visited[row + h][col + k]) break outer;
        }
        h += 1;
      }

      for (let dy = 0; dy < h; dy += 1) {
        for (let dx = 0; dx < w; dx += 1) visited[row + dy][col + dx] = true;
      }
      rects.push({ x: col, y: row, w, h });
    }
  }
  return rects;
}

export async function cropSlot(
  input: Buffer,
  geo: GridGeometry,
  rect: GridRect,
): Promise<Buffer> {
  return sharp(input)
    .extract({
      left: geo.originX + rect.x * geo.pitch,
      top: geo.originY + rect.y * geo.pitch,
      width: rect.w * geo.pitch,
      height: rect.h * geo.pitch,
    })
    .png()
    .toBuffer();
}
