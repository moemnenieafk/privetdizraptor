import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Корневое OG-превью портала — то, что Telegram/Discord/VK разворачивают картинкой
// по ссылке (og:image). Логотип ЦТА берём чистым, БЕЗ подписи-дескриптора: сам
// вектор `public/images/cta-logo.svg` встраиваем как <img data-uri> (resvg внутри
// next/og рендерит пути + градиенты), шрифт BlenderPro читаем с диска (woff Satori
// умеет) → отсюда runtime nodejs. Наследуется всеми страницами без своего OG.

export const runtime = 'nodejs';
export const alt = 'ЦТА — портал-компаньон по Escape from Tarkov';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), 'public', 'fonts', 'BlenderPro-Medium.woff')),
    readFile(join(process.cwd(), 'public', 'images', 'cta-logo.svg'), 'utf-8'),
  ]);
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 44,
          background: '#0D0D0F',
          padding: 88,
          fontFamily: 'Blender',
          color: '#F2F2F2',
        }}
      >
        {/* Логотип ЦТА — 160×56 → ×3.25 */}
        <img src={logoSrc} width={520} height={182} alt="ЦТА" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span style={{ display: 'flex', fontSize: 34, letterSpacing: 2, color: '#C9C9CE' }}>
            Цены барахолки · Карты · Трекер заданий · Бартеры · Сборки оружия
          </span>
          <span style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: '#7A7A82' }}>
            ПОРТАЛ-КОМПАНЬОН ПО ESCAPE FROM TARKOV
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Blender', data: font, style: 'normal', weight: 500 }],
    },
  );
}
