// cta-mapper · S8 — сборка. Чистая логика (строки SVG), без IO.
//
// Решения 1/2/9: выход — БИБЛИОТЕКА <symbol> (по одному на кластер-канон) + <use> на
// каждый экземпляр. Только Figma-версия (литеральные хексы, id = имя слоя). Позиции/углы
// ПРЕВЬЮ-грубые — контактный лист для глаза; финальная раскладка в игровых метрах вручную.
// «Веб-версия с CSS-переменными» удалена (решение 1: тул — ускоритель Figma, не прод).

import type { MapperManifest, MapperObject } from './types';

/** Внутренность traced-SVG канона без обёртки <svg> — тело <symbol>. */
function symbolBody(tracedSvg: string): string {
  return tracedSvg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

interface AssembleInput {
  manifest: MapperManifest;
  /** id канона → его traced SVG (из paths.svg, прочитанного роутом). */
  tracedByCanonical: Record<string, string>;
}

/**
 * Собрать превью-раскладку: <defs><symbol/>… + <g id="Objects"><use/>…</g>.
 * transform="translate(x y) rotate(-angle)" — растр повёрнут в канон один раз,
 * обратный поворот вектора точен.
 */
export function assemble({ manifest, tracedByCanonical }: AssembleInput): string {
  const { w, h } = manifest.sourceSize;
  const canonicals = manifest.objects.filter((o) => o.isClusterCanonical && tracedByCanonical[o.id]);

  const symbols = canonicals
    .map((c) => {
      const sym = `sym-${c.clusterId ?? c.id}`;
      return `<symbol id="${sym}" viewBox="0 0 ${c.bbox.w} ${c.bbox.h}">${symbolBody(tracedByCanonical[c.id])}</symbol>`;
    })
    .join('\n');

  const canonByCluster = new Map(canonicals.map((c) => [c.clusterId, c]));
  const uses = manifest.objects
    .filter((o) => o.clusterId && canonByCluster.has(o.clusterId) && !o.isClutter && o.stage !== 'rejected')
    .map((o) => useTag(o, canonByCluster.get(o.clusterId!)!))
    .join('\n');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `<defs>\n${symbols}\n</defs>`,
    `<g id="Objects">\n${uses}\n</g>`,
    `</svg>`,
  ].join('\n');
}

function useTag(o: MapperObject, canon: MapperObject): string {
  const sym = `sym-${o.clusterId ?? o.id}`;
  const cx = o.bbox.x + o.bbox.w / 2;
  const cy = o.bbox.y + o.bbox.h / 2;
  // масштаб экземпляра к размеру канона (6 и 12 м контейнер — один символ с масштабом)
  const sx = +(o.bbox.w / canon.bbox.w).toFixed(4);
  const sy = +(o.bbox.h / canon.bbox.h).toFixed(4);
  return (
    `<use href="#${sym}" x="0" y="0" width="${canon.bbox.w}" height="${canon.bbox.h}" ` +
    `transform="translate(${o.bbox.x} ${o.bbox.y}) rotate(${(-o.angle).toFixed(2)} ${cx - o.bbox.x} ${cy - o.bbox.y}) scale(${sx} ${sy})"/>`
  );
}
