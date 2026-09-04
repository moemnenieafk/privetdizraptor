import type { NextConfig } from "next";

// CSP: строгие директивы против инъекций/кликджекинга (object/base/frame-ancestors/form-action),
// но РАЗРЕШИТЕЛЬНАЯ на источники ресурсов (https:/wss:/data:/blob:), чтобы не сломать живой UI —
// Supabase realtime (wss), R2-иконки, Leaflet-тайлы, Turnstile, YouTube-эмбеды, inline-стили Next.
// script-src допускает 'unsafe-inline'/'unsafe-eval' (гидрация React + Turnstile). Реальная защита
// здесь — не script-allowlist (её съедает unsafe-inline), а base-uri/object-src/frame-ancestors/
// form-action: закрывают base-tag-инъекцию, <object>/<embed>, обрамление и угон формы.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' https: blob:",
  "worker-src 'self' blob:",
].join('; ');

// Безопасные security-заголовки (defense-in-depth).
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' }, // анти-clickjacking (/account, /login)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: CSP },
];

// Анти-хотлинк для собственных ассетов (SVG-иконки и пр.). CORP=same-origin: браузер
// НЕ отдаёт ресурс чужому сайту для <img>/no-cors. Свои загрузки (same-origin) не задеты.
// Браузерная защита — программный парсинг (curl) не покрывает. Обход через crossorigin
// падает на отсутствии ACAO. Применяем только к same-origin public/-ассетам (не к R2).
const ASSET_HOTLINK_HEADERS = [
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

// Оффлоад статических медиа на Cloudflare R2 (zero egress) через 308-редирект: ссылки в коде,
// data-файлах и CSS остаются `/images/<cat>/...`, а Vercel редиректит их на R2 (файлы 1:1 залиты
// `npm run db:upload-dir-r2`). Редирект идёт ДО отдачи public/ — локальные копии остаются как
// фолбэк/источник, но не раздаются. ⚠️ ТОЛЬКО DOM-<img>/CSS-категории: arcade и traders НЕ здесь —
// их спрайты рисуются на WebGL-канвасе аркад (barter-rush), а R2 без CORS затейнит канвас (см.
// eft-barter-rush.ts). items/achievements/quests уже отдаются прямым R2-URL из своих резолверов.
const R2_MEDIA_BASE = process.env.NEXT_PUBLIC_ICON_BASE_URL;
const R2_MEDIA_CATEGORIES = ['bosses', 'seasons', 'battlepass', 'character', 'quests/eft/story'];
const R2_MEDIA_REDIRECTS = R2_MEDIA_BASE
  ? R2_MEDIA_CATEGORIES.map((cat) => ({
      source: `/images/${cat}/:path*`,
      destination: `${R2_MEDIA_BASE}/${cat}/:path*`,
      permanent: true,
    }))
  : [];

const nextConfig: NextConfig = {
  /* config options here */

  async redirects() {
    return [
      ...R2_MEDIA_REDIRECTS,
      // «Обновления игры» переехали из «Связи» в «Кодекс» (URL отражает раздел).
      { source: '/eft/comlink/game-updates', destination: '/eft/gamesetting/game-updates', permanent: true },
      { source: '/eft/comlink/game-updates/:slug*', destination: '/eft/gamesetting/game-updates/:slug*', permanent: true },
      // «Рейтинг предметов» и «Цена за слот» переехали из «Предметов» в «Прогресс»
      // (обе страницы — инструменты прогресса, а не каталог; URL приведён к разделу).
      { source: '/eft/items/loot-rate', destination: '/eft/progress/loot-rate', permanent: true },
      { source: '/eft/items/price-slot', destination: '/eft/progress/price-slot', permanent: true },
      // HD-Завод промоутнут в боевую карту `factory` (docs/decisions/factory-hd-promote.md,
      // 2026-08-13): старый превью-slug factory-hd ведёт на неё, чтобы ссылки/закладки не 404-или.
      { source: '/eft/maps/factory-hd', destination: '/eft/maps/factory', permanent: true },
    ];
  },

  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      // CORP только на директориях со своими ассетами.
      { source: '/icons/:path*', headers: ASSET_HOTLINK_HEADERS },
      { source: '/games/:path*', headers: ASSET_HOTLINK_HEADERS },
      { source: '/images/:path*', headers: ASSET_HOTLINK_HEADERS },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.tarkov.dev',
        port: '',
        pathname: '/**',
      },
      {
        // Аватары/профильные картинки Twitch (helix/users → profile_image_url)
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
        port: '',
        pathname: '/**',
      },
      {
        // Зеркало иконок предметов (Cloudflare R2) через КАСТОМНЫЙ домен. Нужно, чтобы гнать
        // иконки через /_next/image (same-origin) в канвас-игру аркады — иначе CORS/taint
        // ломает WebGL-CRT. ⚠️ Публичный `*.r2.dev` режется ТСПУ по SNI (см. ниже) — канон
        // отдачи ассетов теперь этот хост.
        protocol: 'https',
        hostname: 'cdn.cta.quest',
        port: '',
        pathname: '/**',
      },
      {
        // ⚠️ Старый публичный адрес бакета. Оставлен ТОЛЬКО как путь отката (вернуть
        // NEXT_PUBLIC_ICON_BASE_URL на pub-….r2.dev и пересобрать). Для RU-аудитории мёртв:
        // ТСПУ блокирует домен `r2.dev` по SNI, как и `*.workers.dev`.
        protocol: 'https',
        hostname: '**.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Нативные View Transitions React 19.2 (App Router бандлит свой canary): в Next 16.3
  // экспериментальный флаг `experimental.viewTransition` выпущен — фича работает по умолчанию.
  // Деградирует бесшумно: без поддержки браузера навигация обычная, анимаций нет.
  // Тюнинг/reduced-motion — в globals.css.
  reactCompiler: true,
};

export default nextConfig;
