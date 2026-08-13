// cta-mapper · S7 — трассировка канона в вектор. Серверный модуль (vtracer).
//
// Решения 4/4b/6: vtracer 1.0.0-alpha.3, palette-lock против САБСЕТА материалов объекта
// (не всех 60 — OKLab-замер: близкие семейства слипнутся). После трассы: убрать заливки
// матового, сгруппировать по цвету, id группы = имя токена-слоя (Figma читает id как слой).

import { convertBuffer } from '@visioncortex/vtracer';
import type { MaterialFamily, Matte, ObjectType } from './types';
import { MATTE_HEX, tokenFor, tracePalette } from './palette';

export interface TraceResult {
  svg: string; // Figma-версия: литеральные хексы, id групп = токены
  colors: string[]; // фактические цвета на выходе
  pathCount: number;
  paletteLocked: boolean; // все цвета из сабсета?
}

/** vtracer.convertBuffer с сабсет-палитрой. mode/simplify зависят от силуэта. */
export function traceCanonical(generatedPng: Buffer, materialIds: string[], matte: Matte, type: ObjectType = 'isolated', palette?: MaterialFamily[]): TraceResult {
  const sub = tracePalette(materialIds, matte, palette);
  const raw = convertBuffer(new Uint8Array(generatedPng), {
    palette: sub,
    mode: type === 'tile' ? 'polygon' : 'spline',
    hierarchical: 'cutout', // бесшовная мозаика без наложений
    colorPrecision: 8,
    filterSpeckle: 16, // при 4096px порог 1/40 ≈ 102px, 16 безопасно
    cornerThreshold: 60,
    pathPrecision: 1,
  });
  const t = groupByToken(raw, MATTE_HEX[matte], palette);
  return { ...t, paletteLocked: t.colors.every((c) => sub.includes(c)) };
}

/** Убрать матовый фон, сгруппировать пути по цвету, id группы = токен NIGHTFALL/Figma. */
function groupByToken(svg: string, matteHex: string, palette?: MaterialFamily[]): Omit<TraceResult, 'paletteLocked'> {
  const open = svg.match(/<svg[^>]*>/i)?.[0] ?? '<svg xmlns="http://www.w3.org/2000/svg">';
  const paths = svg.match(/<path\b[^>]*?(?:\/>|>[\s\S]*?<\/path>)/gi) ?? [];
  const byFill = new Map<string, string[]>();
  for (const p of paths) {
    const fill = (p.match(/fill="([^"]+)"/i)?.[1] ?? '').toUpperCase();
    if (!fill || fill === matteHex.toUpperCase()) continue; // фон и безцветные — вон
    (byFill.get(fill) ?? byFill.set(fill, []).get(fill)!).push(p);
  }
  let body = '';
  for (const [fill, ps] of byFill) {
    const token = tokenFor(fill, palette) ?? `c-${fill.slice(1).toLowerCase()}`;
    body += `<g id="${token}">${ps.join('')}</g>`;
  }
  return { svg: `${open}${body}</svg>`, colors: [...byFill.keys()], pathCount: paths.length };
}
