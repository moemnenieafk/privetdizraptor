import { NextResponse } from 'next/server';

// Кэш ответа на 30с: один исходящий запрос к Twitch обслуживает все клиентские хиты
// (анти-абьюз открытого прокси — иначе флуд жрёт квоту Twitch-приложения).
export const revalidate = 30;

// Глобальные переменные для кеширования токена (работает между вызовами в теплых serverless-функциях)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

// Каналы ЦТА. Первый — основной (его live дублируется в поле `isLive` для обратной
// совместимости со StreamStatus). Один client_credentials-токен обслуживает все каналы:
// helix/streams и helix/users публичны, per-channel авторизация не нужна.
const CHANNELS = [
  { login: 'fullkamen', label: 'Фуллкамень' },
  { login: 'v4dyatv', label: 'v4dyatv' },
] as const;

type ChannelStatus = {
  login: string;
  label: string;
  isLive: boolean;
  avatar?: string;
  displayName?: string;
};

type ProfileMap = Record<string, { avatar?: string; displayName?: string }>;

// Ответ всегда содержит и `isLive` (основной канал), и массив `channels`.
function payload(liveLogins: Set<string>, profiles: ProfileMap = {}, error?: string) {
  const channels: ChannelStatus[] = CHANNELS.map((c) => ({
    login: c.login,
    label: c.label,
    isLive: liveLogins.has(c.login),
    avatar: profiles[c.login]?.avatar,
    displayName: profiles[c.login]?.displayName,
  }));
  return {
    isLive: channels[0]?.isLive ?? false,
    channels,
    ...(error ? { error } : {}),
  };
}

export async function GET() {
  // ВАЖНО: Храните эти данные в переменных окружения (файл .env.local)
  // для безопасности и гибкости.
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

  const empty = new Set<string>();

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Twitch API credentials are not configured in .env.local");
    return NextResponse.json(payload(empty, {}, "Server configuration error"), { status: 500 });
  }

  try {
    // 1. Получаем или переиспользуем OAuth токен
    if (!cachedToken || Date.now() > tokenExpiresAt) {
      const authResponse = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`,
        { method: 'POST' }
      );
      if (!authResponse.ok) {
        const errorData = await authResponse.json();
        console.error("Twitch Auth Error:", errorData);
        return NextResponse.json(payload(empty, {}, "Twitch authentication failed"), { status: authResponse.status });
      }
      const authData = await authResponse.json();
      cachedToken = authData.access_token;
      // Сохраняем время жизни токена (вычитаем 1 минуту для запаса надежности)
      tokenExpiresAt = Date.now() + (authData.expires_in * 1000) - 60000;
    }

    const headers = {
      'Client-ID': CLIENT_ID,
      'Authorization': `Bearer ${cachedToken}`,
    };

    // 2. Параллельно: live-статус (helix/streams, param=user_login) и профили
    //    (helix/users, param=login) — из последних берём АКТУАЛЬНЫЙ аватар с Twitch.
    const streamsQuery = CHANNELS.map((c) => `user_login=${encodeURIComponent(c.login)}`).join('&');
    const usersQuery = CHANNELS.map((c) => `login=${encodeURIComponent(c.login)}`).join('&');

    const [streamResponse, userResponse] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/streams?${streamsQuery}`, { headers }),
      fetch(`https://api.twitch.tv/helix/users?${usersQuery}`, { headers }),
    ]);

    if (!streamResponse.ok) {
      const errorData = await streamResponse.json();
      console.error("Twitch Stream API Error:", errorData);
      return NextResponse.json(payload(empty, {}, "Failed to fetch stream status"), { status: streamResponse.status });
    }
    const streamData = await streamResponse.json();

    // В массиве data приходят ТОЛЬКО активные стримы → их user_login = live-каналы
    const liveLogins = new Set<string>(
      (streamData.data ?? []).map((s: { user_login?: string }) => (s.user_login ?? '').toLowerCase())
    );

    // Профили — НЕ критично: при ошибке отдаём без аватаров (фронт откатится на статик).
    const profiles: ProfileMap = {};
    if (userResponse.ok) {
      const userData = await userResponse.json();
      const users = (userData.data ?? []) as { login?: string; profile_image_url?: string; display_name?: string }[];
      for (const u of users) {
        const login = (u.login ?? '').toLowerCase();
        if (login) profiles[login] = { avatar: u.profile_image_url, displayName: u.display_name };
      }
    }

    return NextResponse.json(payload(liveLogins, profiles));
  } catch (e: unknown) {
    console.error("Twitch API request failed:", e);
    // В случае ошибки (например, неверные ключи) возвращаем оффлайн
    return NextResponse.json(payload(empty, {}, "Internal server error"), { status: 500 });
  }
}
