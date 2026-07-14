import type { MetadataRoute } from 'next';
import { PRIVATE_PATHS, SITE_URL, absoluteUrl } from '@/lib/site';

// robots.txt: закрываем приватное (аккаунт/админка/API/служебное), остальное — открыто.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS.map((p) => `${p}/`),
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
