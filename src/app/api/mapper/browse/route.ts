// cta-mapper · серверный обозреватель папок для выбора источника (dev-only).
// Браузер получает только имена директорий + счётчик картинок — пиксели по HTTP не ходят.
// Статический сегмент `browse` перебивает динамический `[stage]` для /api/mapper/browse.

import { NextResponse } from 'next/server';
import { readdir } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

export const runtime = 'nodejs';

const IMG = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev-only' }, { status: 404 });

  const q = new URL(req.url).searchParams.get('path') ?? 'map-exports';
  const abs = resolve(q); // относительный → от корня проекта; абсолютный (D:\…) → как есть

  try {
    const entries = await readdir(abs, { withFileTypes: true });
    let images = 0;
    const dirs: { name: string; path: string; images: number }[] = [];
    for (const e of entries) {
      if (e.isDirectory()) {
        let cnt = 0;
        try {
          const sub = await readdir(join(abs, e.name));
          cnt = sub.filter((f) => IMG.has(extname(f).toLowerCase())).length;
        } catch {
          // нет доступа к подпапке — показываем без счётчика
        }
        dirs.push({ name: e.name, path: join(abs, e.name), images: cnt });
      } else if (IMG.has(extname(e.name).toLowerCase())) {
        images++;
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name));
    const parent = dirname(abs);
    return NextResponse.json({ path: abs, parent: parent === abs ? null : parent, dirs, images });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, path: abs }, { status: 400 });
  }
}
