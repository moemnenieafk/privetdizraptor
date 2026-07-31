#!/usr/bin/env node
/**
 * fetch-tiles.mjs — выгрузка и сшивка тайловых карт tarkov.dev.
 *
 * Заменяет fetch-markers.mjs (GraphQL API больше не отвечает).
 * Конфигурация карт не хардкодится, а тянется из maps.json the-hideout.
 *
 *   node scripts/fetch-tiles.mjs --list
 *   node scripts/fetch-tiles.mjs --map the-lab
 *   node scripts/fetch-tiles.mjs --map icebreaker --zoom 4 --layers 06_infirmary,14_bridge
 *   node scripts/fetch-tiles.mjs --map customs --scales 8192,4096
 *
 * Требуется: node >= 18, sharp >= 0.34 (join API).
 *
 * Три грабли, ради которых скрипт и написан:
 *   1. Тайлы приходят в разных форматах PNG (RGBA / RGB / палитра / 1-битные,
 *      прозрачность через tRNS). Если скормить их в мозаику как есть,
 *      интерпретация первого тайла навяжется всему холсту — карта молча
 *      приедет обесцвеченной с обрезанной альфой. Лечится приведением
 *      каждого тайла к sRGB + alpha ДО сшивки.
 *   2. tileSize в конфиге — параметр отрисовки Leaflet, а не размер файла
 *      (у Лаборатории там 175 при реальных 256). Размер берём из тайла.
 *   3. Слои одной карты надо резать по ОБЩЕМУ bbox, иначе этажи разъедутся.
 */

import { mkdir, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const MAPS_JSON =
  'https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json';

const DEFAULTS = {
  cache: '.tile-cache',
  out: 'map-exports/raster',
  concurrency: 32,
  quality: 90,
  scales: [8192],
  emptyBytes: 500, // тайлы меньше — заведомо пустые, альфу не проверяем
};

// ─────────────────────────────────────────────────────────── аргументы

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const [k, inline] = t.slice(2).split('=');
      a[k] = inline ?? (argv[i + 1]?.startsWith('--') ? true : argv[++i] ?? true);
    } else a._.push(t);
  }
  return a;
}

// ─────────────────────────────────────────────────────────── конфиг карт

async function loadMapConfig() {
  const res = await fetch(MAPS_JSON);
  if (!res.ok) throw new Error(`maps.json: HTTP ${res.status}`);
  const groups = await res.json();
  const out = new Map();
  for (const g of groups) {
    for (const m of g.maps ?? []) {
      if (!m.tilePath) continue;
      const layers = [
        {
          id: layerIdFromPath(m.tilePath),
          name: 'Main',
          tilePath: m.tilePath,
          heights: m.heightRange ?? null,
          isMain: true,
        },
        ...(m.layers ?? [])
          .filter((l) => l.tilePath)
          .map((l) => ({
            id: layerIdFromPath(l.tilePath),
            name: l.name ?? layerIdFromPath(l.tilePath),
            tilePath: l.tilePath,
            heights: l.extents?.[0]?.height ?? null,
            isMain: false,
          })),
      ];
      out.set(m.key, {
        key: m.key,
        minZoom: m.minZoom ?? 1,
        maxZoom: m.maxZoom ?? 5,
        rotation: m.coordinateRotation ?? 0,
        bounds: m.bounds ?? null,
        layers: dedupe(layers),
      });
    }
  }
  return out;
}

const layerIdFromPath = (p) => p.replace(/\/\{z\}.*$/, '').split('/').pop();
const dedupe = (ls) => {
  const seen = new Set();
  return ls.filter((l) => !seen.has(l.id) && seen.add(l.id));
};

// ─────────────────────────────────────────────────────────── загрузка

/**
 * Некоторые сети/прокси отдают 403 на программные запросы к assets.tarkov.dev,
 * пропуская при этом curl. Если fetch упёрся — переключаемся на curl и больше
 * не пробуем fetch до конца запуска.
 */
let useCurl = false;

async function download(url, dest) {
  if (!useCurl) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'cta-maps/1.0', Accept: 'image/png,*/*' },
      });
      if (res.status === 403) {
        useCurl = true;
      } else if (res.ok) {
        await writeFile(dest, Buffer.from(await res.arrayBuffer()));
        return true;
      } else if (res.status === 404) {
        return false;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      if (!useCurl) throw err;
    }
  }
  try {
    await execFileAsync('curl', ['-sfL', '--max-time', '60', '-o', dest, url]);
    return true;
  } catch {
    return false;
  }
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchLayer(layer, zoom, cacheDir, opts) {
  const n = 2 ** zoom;
  const dir = path.join(cacheDir, layer.id);
  await mkdir(dir, { recursive: true });

  const jobs = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) jobs.push({ x, y });

  let missing = 0;
  await pool(jobs, Number(opts.concurrency), async ({ x, y }) => {
    const dest = path.join(dir, `${x}_${y}.png`);
    if (existsSync(dest) && (await stat(dest)).size > 0) return;
    const url = layer.tilePath
      .replace('{z}', zoom)
      .replace('{x}', x)
      .replace('{y}', y);
    if (!(await download(url, dest))) missing++;
  });
  return { total: jobs.length, missing };
}

// ─────────────────────────────────────────────────────────── анализ

/** Размер тайла берём из файла, а не из конфига. */
async function probeTileSize(dir) {
  const files = await readdir(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if ((await stat(p)).size < 500) continue;
    const { width, height } = await sharp(p).metadata();
    if (width && width === height) return width;
  }
  return 256;
}

/** Есть ли в тайле непрозрачные пиксели. */
async function hasContent(file, emptyBytes) {
  if (!existsSync(file)) return false;
  if ((await stat(file)).size < emptyBytes) return false;
  try {
    const { channels } = await sharp(file)
      .toColourspace('srgb')
      .ensureAlpha()
      .stats();
    return channels[channels.length - 1].max > 8;
  } catch {
    return false;
  }
}

async function occupiedGrid(dir, zoom, opts) {
  const n = 2 ** zoom;
  const cells = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) cells.push({ x, y });
  const flags = await pool(cells, 16, ({ x, y }) =>
    hasContent(path.join(dir, `${x}_${y}.png`), Number(opts.emptyBytes)),
  );
  const occ = cells.filter((_, i) => flags[i]);
  if (!occ.length) return null;
  return {
    x0: Math.min(...occ.map((c) => c.x)),
    x1: Math.max(...occ.map((c) => c.x)),
    y0: Math.min(...occ.map((c) => c.y)),
    y1: Math.max(...occ.map((c) => c.y)),
    count: occ.length,
  };
}

// ─────────────────────────────────────────────────────────── сшивка

/**
 * Приведение к единому формату. Без этого мозаика перенимает интерпретацию
 * первого тайла — однобитный серый превращает всю карту в чёрно-белую.
 */
async function normalizeTile(src, dest, size) {
  // Тайл мог не скачаться (404 или таймаут). Без этой ветки sharp бросает,
  // и весь прогон падает на этапе сшивки — уже после всей загрузки.
  if (!existsSync(src)) {
    await sharp({
      create: {
        width: size, height: size, channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png({ compressionLevel: 1 })
      .toFile(dest);
    return;
  }
  await sharp(src)
    .toColourspace('srgb')
    .ensureAlpha()
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 1 })
    .toFile(dest);
}

async function stitch(cacheDir, layer, grid, tileSize, tmpDir, outFile) {
  const normDir = path.join(tmpDir, layer.id);
  await mkdir(normDir, { recursive: true });

  const cols = grid.x1 - grid.x0 + 1;
  const rows = grid.y1 - grid.y0 + 1;
  const order = [];
  for (let y = grid.y0; y <= grid.y1; y++)
    for (let x = grid.x0; x <= grid.x1; x++) order.push({ x, y });

  await pool(order, 8, async ({ x, y }) => {
    await normalizeTile(
      path.join(cacheDir, layer.id, `${x}_${y}.png`),
      path.join(normDir, `${y}_${x}.png`),
      tileSize,
    );
  });

  const paths = order.map(({ x, y }) => path.join(normDir, `${y}_${x}.png`));

  await sharp(paths, {
    join: { across: cols, shim: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    limitInputPixels: false,
  })
    .png({ compressionLevel: 6 })
    .toFile(outFile);

  await rm(normDir, { recursive: true, force: true });
  return { width: cols * tileSize, height: rows * tileSize };
}

/** Точный bbox содержимого — объединённый по всем слоям. */
async function unionTrim(files) {
  let box = null;
  for (const f of files) {
    const img = sharp(f, { limitInputPixels: false });
    const { width, height } = await img.metadata();
    let region;
    try {
      const { info } = await img
        .clone()
        .trim({ threshold: 0 })
        .toBuffer({ resolveWithObject: true });
      region = {
        left: -(info.trimOffsetLeft ?? 0),
        top: -(info.trimOffsetTop ?? 0),
        width: info.width,
        height: info.height,
      };
    } catch {
      region = { left: 0, top: 0, width, height };
    }
    const b = {
      x0: region.left,
      y0: region.top,
      x1: region.left + region.width,
      y1: region.top + region.height,
    };
    box = box
      ? {
          x0: Math.min(box.x0, b.x0),
          y0: Math.min(box.y0, b.y0),
          x1: Math.max(box.x1, b.x1),
          y1: Math.max(box.y1, b.y1),
        }
      : b;
  }
  return box;
}

// ─────────────────────────────────────────────────────────── прогон

async function run(opts) {
  const configs = await loadMapConfig();

  if (opts.list) {
    console.log('Карты с тайлами:\n');
    for (const [key, c] of configs) {
      console.log(
        `  ${key.padEnd(20)} zoom ${c.minZoom}-${c.maxZoom}  rot ${String(c.rotation).padStart(3)}  слоёв ${c.layers.length}`,
      );
    }
    return;
  }

  const cfg = configs.get(opts.map);
  if (!cfg) throw new Error(`карта "${opts.map}" не найдена, см. --list`);

  const zoom =
    opts.zoom === undefined || opts.zoom === 'max' ? cfg.maxZoom : Number(opts.zoom);
  if (zoom < cfg.minZoom || zoom > cfg.maxZoom)
    throw new Error(`zoom ${zoom} вне диапазона ${cfg.minZoom}-${cfg.maxZoom}`);

  let layers = cfg.layers;
  if (opts.layers && opts.layers !== true) {
    const want = String(opts.layers).split(',').map((s) => s.trim());
    layers = layers.filter((l) => want.includes(l.id));
    if (!layers.length) throw new Error(`слои не найдены: ${opts.layers}`);
  }

  const cacheDir = path.join(opts.cache, opts.map, String(zoom));
  const tmpDir = path.join(opts.cache, '.tmp', opts.map);
  const outDir = path.join(opts.out, opts.map);
  await mkdir(outDir, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  console.log(
    `\n${opts.map} — zoom ${zoom}, сетка ${2 ** zoom}x${2 ** zoom}, слоёв ${layers.length}\n`,
  );

  for (const l of layers) {
    process.stdout.write(`  ${l.id.padEnd(24)} загрузка... `);
    const { total, missing } = await fetchLayer(l, zoom, cacheDir, opts);
    console.log(`${total - missing}/${total}${missing ? `  ПРОПУЩЕНО ${missing}` : ''}`);
  }
  if (useCurl) console.log('\n  (fetch отдал 403, переключился на curl)');

  const tileSize = await probeTileSize(path.join(cacheDir, layers[0].id));
  console.log(`\n  размер тайла: ${tileSize}px`);

  let grid = null;
  for (const l of layers) {
    const g = await occupiedGrid(path.join(cacheDir, l.id), zoom, opts);
    if (!g) {
      console.log(`  ${l.id.padEnd(24)} пусто, пропуск`);
      l.empty = true;
      continue;
    }
    console.log(
      `  ${l.id.padEnd(24)} тайлов ${String(g.count).padStart(5)}  x ${g.x0}..${g.x1}  y ${g.y0}..${g.y1}`,
    );
    grid = grid
      ? {
          x0: Math.min(grid.x0, g.x0), x1: Math.max(grid.x1, g.x1),
          y0: Math.min(grid.y0, g.y0), y1: Math.max(grid.y1, g.y1),
        }
      : g;
  }
  if (!grid) throw new Error('во всех слоях пусто');
  layers = layers.filter((l) => !l.empty);
  console.log(`\n  общая сетка: x ${grid.x0}..${grid.x1}  y ${grid.y0}..${grid.y1}`);

  const raw = [];
  for (const l of layers) {
    const f = path.join(tmpDir, `${l.id}.png`);
    const { width, height } = await stitch(cacheDir, l, grid, tileSize, tmpDir, f);
    console.log(`  ${l.id.padEnd(24)} сшито ${width}x${height}`);
    raw.push({ layer: l, file: f });
  }

  const box = await unionTrim(raw.map((r) => r.file));
  const cw = box.x1 - box.x0;
  const ch = box.y1 - box.y0;
  console.log(`\n  общий кроп: ${cw}x${ch} (${(cw * ch / 1e6).toFixed(1)} Мпикс)\n`);

  const scales = String(opts.scales).split(',').map(Number).filter(Boolean);
  const manifest = {
    map: opts.map, zoom, tileSize, coordinateRotation: cfg.rotation,
    boundsFromConfig: cfg.bounds, crop: { ...box, width: cw, height: ch },
    generated: new Date().toISOString(), layers: [],
  };

  // WebP не умеет стороны длиннее 16383, но libwebp сдаётся заметно раньше —
  // на общем числе пикселей. Замеры: 169 Мпикс кодируется, 212 и 234 — нет.
  const WEBP_MAX_SIDE = 16383;
  const WEBP_MAX_PIXELS = 150e6;
  const tooBig =
    cw > WEBP_MAX_SIDE || ch > WEBP_MAX_SIDE || cw * ch > WEBP_MAX_PIXELS;
  if (tooBig)
    console.log(`  (${(cw * ch / 1e6).toFixed(1)} Мпикс — за пределами WebP, полный размер пойдёт в PNG)\n`);

  const cropped = (file) =>
    sharp(file, { limitInputPixels: false })
      .extract({ left: box.x0, top: box.y0, width: cw, height: ch });

  for (const { layer, file } of raw) {
    const base = `${opts.map}-${layer.id}`;
    let full = path.join(outDir, `${base}-z${zoom}.${tooBig ? 'png' : 'webp'}`);
    try {
      await (tooBig
        ? cropped(file).png({ compressionLevel: 6 })
        : cropped(file).webp({ quality: Number(opts.quality), effort: 4 })
      ).toFile(full);
    } catch (err) {
      if (tooBig) throw err;
      // Кодек всё-таки не осилил — не роняем прогон, пишем PNG.
      console.log(`  ${base.padEnd(34)} WebP не осилил, пишу PNG`);
      full = path.join(outDir, `${base}-z${zoom}.png`);
      await cropped(file).png({ compressionLevel: 6 }).toFile(full);
    }

    const entry = {
      id: layer.id, name: layer.name, heights: layer.heights,
      isMain: layer.isMain, files: { [`z${zoom}`]: path.basename(full) },
    };

    for (const w of scales) {
      if (w >= cw) continue;
      const p = path.join(outDir, `${base}-${w}.webp`);
      await sharp(file, { limitInputPixels: false })
        .extract({ left: box.x0, top: box.y0, width: cw, height: ch })
        .resize({ width: w })
        .webp({ quality: Number(opts.quality), effort: 4 })
        .toFile(p);
      entry.files[String(w)] = path.basename(p);
    }

    console.log(`  ${base.padEnd(34)} ${((await stat(full)).size / 1024 / 1024).toFixed(2)} МБ`);
    manifest.layers.push(entry);
    await rm(file, { force: true });
  }

  await writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  console.log(`\n  manifest.json записан в ${outDir}\n`);
}

// ─────────────────────────────────────────────────────────── старт

const argv = parseArgs(process.argv.slice(2));
const opts = { ...DEFAULTS, ...argv };
if (!opts.map && !opts.list) {
  console.log('использование: node scripts/fetch-tiles.mjs --map <key> [--zoom max|N] [--layers a,b] [--scales 8192,4096]');
  console.log('               node scripts/fetch-tiles.mjs --list');
  process.exit(1);
}
run(opts).catch((e) => {
  console.error(`\nОШИБКА: ${e.message}\n`);
  process.exit(1);
});
