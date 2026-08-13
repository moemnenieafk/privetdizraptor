// cta-mapper — чтение/запись/миграция манифеста (единственное состояние прогона).
// Серверный модуль (node:fs) — импортируется только роут-хендлером, не клиентом.
//
// Отказоустойчивость (мандат V4DYA «чёткий отказоустойчивый пайплайн»):
//   • запись атомарная (tmp + rename) — прерывание не оставит битый json;
//   • стадии идемпотентны — читают манифест, дописывают своё, пишут обратно;
//   • падение на одном объекте пишется в object.error и не роняет остальные.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { BBox, MapperManifest, MapperObject } from './types';
import { FACTORY_PALETTE, MATTE_HEX } from './palette';

export const MANIFEST_VERSION = 1;

/** Корень рабочей папки прогона (под map-exports/ — уже в .gitignore). */
export function workspaceDir(mapId: string): string {
  return join('map-exports', 'mapper', mapId);
}
export function manifestPath(mapId: string): string {
  return join(workspaceDir(mapId), 'mapper.json');
}

export function objectId(bbox: BBox, mapId: string): string {
  return createHash('sha1').update(`${mapId}:${bbox.x},${bbox.y},${bbox.w},${bbox.h}`).digest('hex').slice(0, 8);
}

export function initManifest(args: {
  mapId: string;
  source: string;
  sourceSize: { w: number; h: number };
  pxPerMetre?: number | null;
}): MapperManifest {
  return {
    version: MANIFEST_VERSION,
    mapId: args.mapId,
    source: args.source,
    sourceSize: args.sourceSize,
    pxPerMetre: args.pxPerMetre ?? null,
    background: null,
    matteHex: { ...MATTE_HEX },
    palette: FACTORY_PALETTE,
    anchorPath: null,
    objects: [],
  };
}

/** Поднять старую схему до текущей. Пропуски namespace'ов заполняются дефолтами. */
function migrate(raw: unknown): MapperManifest {
  const m = raw as Partial<MapperManifest> & { version?: number };
  if (!m || typeof m !== 'object') throw new Error('manifest: не объект');
  // v0 → v1: реестр палитры мог отсутствовать / быть плоским string[].
  const palette = Array.isArray(m.palette) && m.palette.length && typeof m.palette[0] === 'object' ? m.palette : FACTORY_PALETTE;
  return {
    version: MANIFEST_VERSION,
    mapId: m.mapId ?? 'unknown',
    source: m.source ?? '',
    sourceSize: m.sourceSize ?? { w: 0, h: 0 },
    pxPerMetre: m.pxPerMetre ?? null,
    background: m.background ?? null,
    matteHex: m.matteHex ?? { ...MATTE_HEX },
    palette: palette as MapperManifest['palette'],
    anchorPath: m.anchorPath ?? null,
    objects: Array.isArray(m.objects) ? (m.objects as MapperObject[]) : [],
  };
}

export async function readManifest(mapId: string): Promise<MapperManifest | null> {
  try {
    const raw = await readFile(manifestPath(mapId), 'utf8');
    return migrate(JSON.parse(raw));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** Атомарная запись: пишем во временный файл и переименовываем поверх. */
export async function writeManifest(m: MapperManifest): Promise<void> {
  const path = manifestPath(m.mapId);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(m, null, 2), 'utf8');
  await rename(tmp, path);
}

/** Вставить/обновить объект по id (мутирует переданный manifest.objects, возвращает его). */
export function upsertObject(m: MapperManifest, obj: MapperObject): MapperManifest {
  const i = m.objects.findIndex((o) => o.id === obj.id);
  if (i === -1) m.objects.push(obj);
  else m.objects[i] = obj;
  return m;
}

export function getObject(m: MapperManifest, id: string): MapperObject | undefined {
  return m.objects.find((o) => o.id === id);
}

/** Канон-объекты кластеров (единственные, что идут в генерацию/трассу). */
export function canonicalObjects(m: MapperManifest): MapperObject[] {
  return m.objects.filter((o) => o.isClusterCanonical && !o.isClutter && o.stage !== 'rejected');
}
