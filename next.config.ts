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

const nextConfig: NextConfig = {
  /* config options here */

  async headers() {
    return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
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
  reactCompiler: true,
};

export default nextConfig;
