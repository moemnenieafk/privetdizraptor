import type { NextConfig } from "next";

// Безопасные security-заголовки (defense-in-depth). Enforcing-CSP не ставим здесь —
// её надо подбирать/тестить отдельно (inline-стили, Supabase, Leaflet), чтобы не сломать UI.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' }, // анти-clickjacking (/account, /login)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

// Анти-хотлинк для собственных ассетов (SVG-иконки и пр.). CORP=same-origin: браузер
// НЕ отдаёт ресурс чужому сайту для <img>/no-cors. Свои загрузки (same-origin) не задеты.
// Браузерная защита — программный парсинг (curl) не покрывает. Обход через crossorigin
// падает на отсутствии ACAO. Применяем только к same-origin public/-ассетам (не к R2).
const ASSET_HOTLINK_HEADERS = [
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  /* config options here */

  async redirects() {
    return [
      // «Обновления игры» переехали из «Связи» в «Кодекс» (URL отражает раздел).
      { source: '/eft/comlink/game-updates', destination: '/eft/gamesetting/game-updates', permanent: true },
      { source: '/eft/comlink/game-updates/:slug*', destination: '/eft/gamesetting/game-updates/:slug*', permanent: true },
      // «Рейтинг предметов» и «Цена за слот» переехали из «Предметов» в «Прогресс»
      // (обе страницы — инструменты прогресса, а не каталог; URL приведён к разделу).
      { source: '/eft/items/loot-rate', destination: '/eft/progress/loot-rate', permanent: true },
      { source: '/eft/items/price-slot', destination: '/eft/progress/price-slot', permanent: true },
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
    ],
  },
  experimental: {
    // Нативные View Transitions React 19.2 (App Router бандлит свой canary — доп. зависимости
    // не нужны). Экспериментально: деградирует бесшумно — без поддержки браузера навигация
    // работает как обычно, анимации просто нет. Тюнинг/reduced-motion — в globals.css.
    viewTransition: true,
  },
  reactCompiler: true,
};

export default nextConfig;
