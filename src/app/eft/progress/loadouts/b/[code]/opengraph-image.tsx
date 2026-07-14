import type { ReactNode } from 'react';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getBuildDefs } from '@/db/build-defs';
import { decodeBuild } from '@/lib/build-share';
import { buildFocus } from '@/lib/build-focus';
import { buildTotal, formatRub } from '@/lib/build-price';
import { calcBuild, calcDelta, type BuildNode } from '@/lib/weapon-build';

// OG-превью снэпшота: то, что развернётся картинкой в Telegram/Discord/VK.
//
// Картинки модулей НЕ вставляем: иконки в R2 лежат в webp, а Satori (движок next/og)
// webp не декодирует. Поэтому карточка типографская — на дизайне Nightfall,
// с цифрами, ради которых сборкой и делятся.
//
// Шрифт грузим с диска: BlenderPro-Book.woff лежит в public/fonts (woff Satori умеет,
// woff2 — нет). Отсюда же и runtime nodejs.

export const runtime = 'nodejs';
export const alt = 'Сборка оружия — ЦТА';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function collectIds(node: BuildNode, acc: Set<string>): Set<string> {
  acc.add(node.itemId);
  for (const child of Object.values(node.mods)) collectIds(child, acc);
  return acc;
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const font = await readFile(
    join(process.cwd(), 'public', 'fonts', 'BlenderPro-Medium.woff'),
  );

  const tree = decodeBuild(code);

  const render = (children: ReactNode) =>
    new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#131313',
            padding: 64,
            fontFamily: 'Blender',
            color: '#E8E8E8',
          }}
        >
          {children}
        </div>
      ),
      {
        ...size,
        fonts: [{ name: 'Blender', data: font, style: 'normal', weight: 500 }],
      },
    );

  if (!tree) {
    return render(
      <div style={{ display: 'flex', fontSize: 56, letterSpacing: 4 }}>
        СБОРКА НЕ НАЙДЕНА
      </div>,
    );
  }

  const ids = [...collectIds(tree, new Set())];
  const bundle = await getBuildDefs(ids);

  const index = new Map(bundle.defs.map((d) => [d.id, d]));
  const result = calcBuild(tree, index);
  const delta = calcDelta(tree, index);

  const baseName = bundle.names[tree.itemId] ?? 'Оружие';
  const total = buildTotal(tree.itemId, result, bundle.prices);
  const focus = buildFocus(result, delta, index, total.total > 0 ? total.total : null);

  const stat = (label: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 20, letterSpacing: 3, color: '#8A8A8A' }}>{label}</span>
      <span style={{ fontSize: 46, color: '#E8E8E8' }}>{value}</span>
    </div>
  );

  return render(
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <span style={{ fontSize: 24, letterSpacing: 6, color: '#F28A2E' }}>
          ЦТА · ЦЕНТР ТАКТИЧЕСКОЙ АДАПТАЦИИ
        </span>

        <span style={{ fontSize: 64, letterSpacing: 2, lineHeight: 1.1 }}>{baseName}</span>

        <div style={{ display: 'flex', gap: 12 }}>
          <span
            style={{
              display: 'flex',
              fontSize: 24,
              letterSpacing: 4,
              color: '#F28A2E',
              border: '1px solid rgba(242,138,46,0.4)',
              borderRadius: 4,
              padding: '6px 16px',
            }}
          >
            {focus.label.toUpperCase()}
          </span>

          {focus.tags.slice(0, 2).map((t) => (
            <span
              key={t.id}
              style={{
                display: 'flex',
                fontSize: 24,
                letterSpacing: 4,
                color: '#8A8A8A',
                border: '1px solid #2A2A2A',
                borderRadius: 4,
                padding: '6px 16px',
              }}
            >
              {t.label.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {stat('ЭРГОНОМИКА', String(result.stats.ergonomics))}
        {stat('ОТДАЧА', String(result.stats.recoilSum))}
        {stat('МОДУЛЕЙ', String(result.stats.modCount))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 20, letterSpacing: 3, color: '#8A8A8A' }}>СТОИМОСТЬ</span>
          <span style={{ fontSize: 46, color: '#F28A2E' }}>{formatRub(total.total)}</span>
        </div>
      </div>
    </>,
  );
}
