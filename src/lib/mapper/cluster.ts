// cta-mapper · S3 — кластеризация по типу (решение 2). Чистая логика, без IO.
//
// ПЕРВИЧНЫЙ ключ схлопывания — typeKey от vision-прохода, НЕ dHash. dHash оставлен
// вторичным сигналом слияния заведомо идентичных экземпляров внутри одного типа.
// Один канон на кластер (самый крупный = чётче геометрия) → в S6/S7 идёт только он.

import { createHash } from 'node:crypto';
import type { MapperObject } from './types';

/** Расстояние Хэмминга между двумя dHash (hex-строки одной длины). */
export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export interface Cluster {
  clusterId: string;
  typeKey: string;
  canonicalId: string;
  memberIds: string[];
  count: number;
}

export interface ClusterResult {
  objects: MapperObject[]; // те же объекты с проставленными clusterId/isClusterCanonical
  clusters: Cluster[];
}

/**
 * Схлопнуть объекты в кластеры по typeKey. Хлам/отклонённые/безтиповые не участвуют.
 * Канон = экземпляр с максимальным pixelCount (даёт самую чёткую геометрию для замера).
 */
export function cluster(objects: MapperObject[]): ClusterResult {
  const eligible = objects.filter((o) => o.typeKey && !o.isClutter && o.stage !== 'rejected');

  const byType = new Map<string, MapperObject[]>();
  for (const o of eligible) {
    const k = o.typeKey as string;
    (byType.get(k) ?? byType.set(k, []).get(k)!).push(o);
  }

  const clusters: Cluster[] = [];
  for (const [typeKey, members] of byType) {
    const clusterId = createHash('sha1').update(typeKey).digest('hex').slice(0, 8);
    const canonical = members.reduce((a, b) => (b.pixelCount > a.pixelCount ? b : a));
    for (const o of members) {
      o.clusterId = clusterId;
      o.isClusterCanonical = o.id === canonical.id;
      o.stage = 'clustered';
    }
    clusters.push({
      clusterId,
      typeKey,
      canonicalId: canonical.id,
      memberIds: members.map((o) => o.id),
      count: members.length,
    });
  }

  clusters.sort((a, b) => b.count - a.count);
  return { objects, clusters };
}

/** Соотношение сторон канона — число-пропорция для промта S6 (решение 3). */
export function aspect(o: MapperObject): number {
  const long = Math.max(o.bbox.w, o.bbox.h);
  const short = Math.min(o.bbox.w, o.bbox.h);
  return short > 0 ? +(long / short).toFixed(2) : 1;
}
