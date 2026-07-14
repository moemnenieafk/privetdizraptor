// Единая точка правды по адресу сайта: metadataBase, sitemap, robots, OG-ссылки.
// Приоритет: NEXT_PUBLIC_SITE_URL (прод-домен из Vercel env) → VERCEL_URL (превью) → localhost.

const RAW =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');

/** Абсолютный origin без завершающего слэша. */
export const SITE_URL = RAW.replace(/\/+$/, '');

/** Абсолютный URL из относительного пути. */
export const absoluteUrl = (path = '/') =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export const SITE_NAME = 'ЦТА — Центр тактической адаптации';
export const SITE_DESCRIPTION =
  'Портал-компаньон по Escape from Tarkov: цены барахолки, интерактивные карты, ' +
  'трекер заданий и убежища, бартеры, сборки оружия, гайды по сюжетным линиям.';

/** Разделы, которые не должны попадать в индекс и sitemap. */
export const PRIVATE_PATHS = [
  '/api',
  '/admin',
  '/account',
  '/login',
  '/reset-password',
  '/auth',
  '/eft/styleguide',
] as const;
