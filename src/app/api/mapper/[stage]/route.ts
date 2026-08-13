// cta-mapper · единый роут на все стадии, дискриминированный по [stage] (решение 7).
// DEV-ONLY: в проде отдаёт 404 (тул локальный — карантин). Тяжёлые пиксели не ходят по HTTP:
// браузер шлёт {mapId, source, …}, роут читает/пишет диск по путям, отдаёт JSON-сводку.
// Отказоустойчивость: ошибка на объекте пишется в object.error, прогон не падает целиком.

import { NextResponse } from 'next/server';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isPipelineStage, type MapperManifest, type PipelineStage } from '@/lib/mapper/types';
import { initManifest, readManifest, writeManifest, workspaceDir, canonicalObjects } from '@/lib/mapper/manifest';
import { segment } from '@/lib/mapper/segment';
import { cluster } from '@/lib/mapper/cluster';
import { visionType, generateCanonical, GeminiBillingError } from '@/lib/mapper/gemini';
import { traceCanonical } from '@/lib/mapper/trace';
import { assemble } from '@/lib/mapper/assemble';
import { familyById, collisionWarnings } from '@/lib/mapper/palette';

export const runtime = 'nodejs';
export const maxDuration = 300;

// GET /api/mapper/manifest?mapId=… — отдать манифест для гидрации UI (dev-only, stage игнор).
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev-only' }, { status: 404 });
  const mapId = new URL(req.url).searchParams.get('mapId');
  if (!mapId) return NextResponse.json({ error: 'нужен mapId' }, { status: 400 });
  const m = await readManifest(mapId);
  return NextResponse.json(m ?? { objects: [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ stage: string }> }) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev-only' }, { status: 404 });

  const { stage } = await params;
  if (!isPipelineStage(stage)) return NextResponse.json({ error: `неизвестная стадия: ${stage}` }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { mapId?: string; source?: string; pxPerMetre?: number };
  const mapId = body.mapId;
  if (!mapId) return NextResponse.json({ error: 'нужен mapId' }, { status: 400 });

  try {
    const summary = await runStage(stage, mapId, body);
    return NextResponse.json({ stage, ...summary });
  } catch (e) {
    if (e instanceof GeminiBillingError) {
      return NextResponse.json({ stage, error: e.message, billing: true }, { status: 402 });
    }
    return NextResponse.json({ stage, error: (e as Error).message }, { status: 500 });
  }
}

async function runStage(stage: PipelineStage, mapId: string, body: { source?: string; pxPerMetre?: number }) {
  // segment может создавать манифест; остальные требуют существующего
  let m = await readManifest(mapId);
  if (stage === 'segment') {
    if (!body.source) throw new Error('segment: нужен source');
    m ??= initManifest({ mapId, source: body.source, sourceSize: { w: 0, h: 0 }, pxPerMetre: body.pxPerMetre });
    m.source = body.source;
    if (body.pxPerMetre != null) m.pxPerMetre = body.pxPerMetre;
    const objects = await segment(m);
    m.objects = objects;
    await writeManifest(m);
    return { count: objects.length };
  }
  if (!m) throw new Error(`манифест ${mapId} не найден — сначала segment`);

  switch (stage) {
    case 'vision':
      return runVision(m);
    case 'cluster': {
      const { clusters } = cluster(m.objects);
      await writeManifest(m);
      return { clusters: clusters.length, canonicals: canonicalObjects(m).length };
    }
    case 'generate':
      return runGenerate(m);
    case 'trace':
      return runTrace(m);
    case 'assemble':
      return runAssemble(m);
    default:
      throw new Error(`стадия ${stage} не обработана`);
  }
}

async function runVision(m: MapperManifest) {
  let ok = 0;
  const warnings: string[] = [];
  for (const o of m.objects) {
    if (o.stage === 'rejected' || !o.paths.crop) continue;
    try {
      const crop = await readFile(o.paths.crop);
      const v = await visionType(crop);
      o.typeKey = v.typeKey;
      o.material = v.material;
      o.subjectSeed = v.subjectSeed;
      o.isClutter = v.isClutter;
      o.stage = 'typed';
      ok++;
    } catch (e) {
      if (e instanceof GeminiBillingError) {
        await writeManifest(m);
        throw e;
      }
      o.error = (e as Error).message;
    }
  }
  await writeManifest(m);
  return { typed: ok, warnings };
}

async function runGenerate(m: MapperManifest) {
  const cacheDir = join(workspaceDir(m.mapId), 'cache');
  const genDir = join(workspaceDir(m.mapId), 'generated');
  await mkdir(genDir, { recursive: true });
  const anchorPng = m.anchorPath ? await readFile(m.anchorPath).catch(() => undefined) : undefined;
  let ok = 0;
  const warnings: string[] = [];
  for (const o of canonicalObjects(m)) {
    if (!o.subject || !o.material) {
      o.error = 'нет subject/material — пройти S5';
      continue;
    }
    const fam = familyById(o.material);
    if (!fam) {
      o.error = `неизвестный материал ${o.material}`;
      continue;
    }
    warnings.push(...collisionWarnings([o.material]).map((w) => `${o.id}: ${w}`));
    try {
      const geometryPng = o.paths.crop ? await readFile(o.paths.crop).catch(() => undefined) : undefined;
      const { png, cached } = await generateCanonical({ subject: o.subject, materials: [fam], matte: o.matte, anchorPng, geometryPng, cacheDir });
      const out = join(genDir, `${o.id}.png`);
      await writeFile(out, png);
      o.paths.generated = out;
      o.stage = 'generated';
      ok += cached ? 0 : 1;
    } catch (e) {
      if (e instanceof GeminiBillingError) {
        await writeManifest(m);
        throw e;
      }
      o.error = (e as Error).message;
    }
  }
  await writeManifest(m);
  return { generated: ok, warnings };
}

async function runTrace(m: MapperManifest) {
  const svgDir = join(workspaceDir(m.mapId), 'svg');
  await mkdir(svgDir, { recursive: true });
  let ok = 0;
  let notLocked = 0;
  for (const o of canonicalObjects(m)) {
    if (!o.paths.generated || !o.material) continue;
    try {
      const png = await readFile(o.paths.generated);
      const r = traceCanonical(png, [o.material], o.matte, o.type, m.palette);
      const out = join(svgDir, `${o.id}.svg`);
      await writeFile(out, r.svg);
      o.paths.svg = out;
      o.stage = 'traced';
      ok++;
      if (!r.paletteLocked) notLocked++;
    } catch (e) {
      o.error = (e as Error).message;
    }
  }
  await writeManifest(m);
  return { traced: ok, notPaletteLocked: notLocked };
}

async function runAssemble(m: MapperManifest) {
  const tracedByCanonical: Record<string, string> = {};
  for (const o of canonicalObjects(m)) {
    if (o.paths.svg) tracedByCanonical[o.id] = await readFile(o.paths.svg, 'utf8').catch(() => '');
  }
  const svg = assemble({ manifest: m, tracedByCanonical });
  const out = join(workspaceDir(m.mapId), 'objects.assembled.svg');
  await writeFile(out, svg);
  return { symbols: Object.keys(tracedByCanonical).length, out };
}
