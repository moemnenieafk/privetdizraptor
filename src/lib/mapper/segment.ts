// cta-mapper · S1 — сегментация. Серверный модуль (sharp).
//
// Два входа:
//   • ФАЙЛ-РАСТР целой карты → фон + связные компоненты + физ-фильтр (решение 8);
//   • ПАПКА готовых кропов (твоя ручная нарезка map-exports/.../objects) → файл = объект.
//
// Углы/позиции ПРЕВЬЮ-грубые (решение 9): угол через PCA главной оси, ±90° гасим
// правилом «высота ≥ ширины». Никакой рекурсии — стек Int32Array (16K карта положит стек).

import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';
import type { BBox, MapperManifest, MapperObject } from './types';
import { objectId } from './manifest';

const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export interface SegmentOpts {
  bgTolerance?: number; // евклид RGB, дефолт 12
  minAreaPx?: number; // фолбэк-порог в пикселях, если нет масштаба; дефолт 400
  minMetres?: number; // физ-порог по длинной стороне (решение 8), дефолт 4.5
}

/** Модальный цвет пикселей по периметру кадра — это и есть фон. */
export function detectBackground(rgba: Buffer, w: number, h: number): [number, number, number] {
  const bins = new Map<number, number>();
  const add = (i: number) => {
    // квантуем до 4 бит/канал, чтобы сгладить шум сглаживания
    const key = ((rgba[i] >> 4) << 8) | ((rgba[i + 1] >> 4) << 4) | (rgba[i + 2] >> 4);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < w; x++) {
    add((x) * 4);
    add(((h - 1) * w + x) * 4);
  }
  for (let y = 0; y < h; y++) {
    add((y * w) * 4);
    add((y * w + (w - 1)) * 4);
  }
  let best = 0;
  let bestKey = 0;
  for (const [k, c] of bins) if (c > best) ((best = c), (bestKey = k));
  return [((bestKey >> 8) & 0xf) << 4, ((bestKey >> 4) & 0xf) << 4, (bestKey & 0xf) << 4];
}

/** Связные компоненты по маске переднего плана. Итеративный стек, 8-связность. */
function connectedComponents(mask: Uint8Array, w: number, h: number, minPx: number): number[][] {
  const labels = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  const comps: number[][] = [];
  for (let start = 0; start < w * h; start++) {
    if (mask[start] !== 1 || labels[start] !== 0) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = comps.length + 1;
    const px: number[] = [];
    while (sp > 0) {
      const p = stack[--sp];
      px.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const np = ny * w + nx;
          if (mask[np] === 1 && labels[np] === 0) {
            labels[np] = comps.length + 1;
            stack[sp++] = np;
          }
        }
      }
    }
    if (px.length >= minPx) comps.push(px);
  }
  return comps;
}

/** Угол главной оси (PCA) по пикселям компоненты, нормализован «высота ≥ ширины». */
function principalAngle(px: number[], w: number): number {
  let n = 0;
  let mx = 0;
  let my = 0;
  for (const p of px) {
    mx += p % w;
    my += (p / w) | 0;
    n++;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of px) {
    const dx = (p % w) - mx;
    const dy = ((p / w) | 0) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy) * (180 / Math.PI);
  return angle; // раскладку/нормализацию канона делает stage assemble
}

function bboxOf(px: number[], w: number): BBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of px) {
    const x = p % w;
    const y = (p / w) | 0;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** dHash 16 hex (64 бита) по нормализованному кропу — вторичный сигнал слияния (решение 2). */
export async function dHash(png: Buffer): Promise<string> {
  const { data } = await sharp(png).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let hex = '';
  let bits = 0;
  let nbit = 0;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = y * 9 + x;
      bits = (bits << 1) | (data[i] > data[i + 1] ? 1 : 0);
      if (++nbit === 4) {
        hex += bits.toString(16);
        bits = 0;
        nbit = 0;
      }
    }
  }
  return hex;
}

function baseObject(id: string, bbox: BBox, angle: number, pixelCount: number, dedupKey: string, cropPath: string): MapperObject {
  return {
    id,
    bbox,
    angle,
    pixelCount,
    areaM2: null,
    typeKey: null,
    material: null,
    matte: 'magenta', // OKLab: маджента вдвое безопаснее зелёного; гистограмма-матовый — refinement S4
    subjectSeed: null,
    isClutter: false,
    clusterId: null,
    isClusterCanonical: false,
    dedupKey,
    subject: null,
    type: 'isolated',
    stage: 'segmented',
    paths: { crop: cropPath },
  };
}

/** Путь «папка готовых кропов»: каждый файл = один объект (bbox = весь кадр, angle 0). */
async function fromCropDir(dir: string, mapId: string): Promise<MapperObject[]> {
  const files = (await readdir(dir)).filter((f) => IMG_EXT.has(extname(f).toLowerCase()));
  const out: MapperObject[] = [];
  for (const f of files) {
    const p = join(dir, f);
    const buf = await readFile(p);
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const bbox: BBox = { x: 0, y: 0, w, h };
    out.push(baseObject(objectId(bbox, `${mapId}:${f}`), bbox, 0, w * h, await dHash(buf), p));
  }
  return out;
}

/** Путь «целый растр»: фон → маска → компоненты → физ-фильтр → кроп + PCA-угол. */
async function fromRaster(source: string, m: MapperManifest, opts: SegmentOpts): Promise<MapperObject[]> {
  const tol = opts.bgTolerance ?? 12;
  const minMetres = opts.minMetres ?? 4.5;
  const { data, info } = await sharp(source, { limitInputPixels: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const [br, bg, bb] = detectBackground(data, w, h);
  m.background = `#${[br, bg, bb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  // маска переднего плана: далеко от фона по RGB
  const mask = new Uint8Array(w * h);
  const tol2 = tol * tol;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const dr = data[i] - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    mask[p] = dr * dr + dg * dg + db * db > tol2 ? 1 : 0;
  }

  // физ-порог (решение 8): длинная сторона объекта < minMetres → мусор, не детектим
  const minPx = m.pxPerMetre
    ? Math.round(Math.pow(minMetres * m.pxPerMetre, 2)) // площадь квадрата minMetres×minMetres
    : opts.minAreaPx ?? 400;

  const comps = connectedComponents(mask, w, h, minPx);
  const out: MapperObject[] = [];
  for (const px of comps) {
    const bbox = bboxOf(px, w);
    const angle = principalAngle(px, w);
    // кроп по bbox; чужие пиксели внутри bbox зальются фоном на стадии подготовки к S6
    const crop = await sharp(source, { limitInputPixels: false })
      .extract({ left: bbox.x, top: bbox.y, width: bbox.w, height: bbox.h })
      .png()
      .toBuffer();
    const id = objectId(bbox, m.mapId);
    const cropPath = join('map-exports', 'mapper', m.mapId, 'crops', `${id}.png`);
    const obj = baseObject(id, bbox, angle, px.length, await dHash(crop), cropPath);
    obj.areaM2 = m.pxPerMetre ? (bbox.w * bbox.h) / (m.pxPerMetre * m.pxPerMetre) : null;
    out.push(obj);
  }
  return out;
}

/** S1 главный вход: диспатч по типу source (папка кропов или файл-растр). */
export async function segment(m: MapperManifest, opts: SegmentOpts = {}): Promise<MapperObject[]> {
  const st = await sharp(m.source, { limitInputPixels: false })
    .metadata()
    .then(() => 'file' as const)
    .catch(() => 'dir' as const);
  return st === 'dir' ? fromCropDir(m.source, m.mapId) : fromRaster(m.source, m, opts);
}
