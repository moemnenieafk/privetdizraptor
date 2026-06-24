import { NextResponse } from 'next/server';

// Кэш ответа на 30с: один исходящий запрос к Twitch обслуживает все клиентские хиты
// (анти-абьюз открытого прокси — иначе флуд жрёт квоту Twitch-приложения).
export const revalidate = 30;

// Глобальные переменные для кеширования токена (работает между вызовами в теплых serverless-функциях)
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function GET() {
  // ВАЖНО: Храните эти данные в переменных окружения (файл .env.local)
  // для безопасности и гибкости.
  const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  const CHANNEL_NAME = 'fullkamen';

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Twitch API credentials are not configured in .env.local");
    return NextResponse.json({ isLive: false, error: "Server configuration error" }, { status: 500 });
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
        return NextResponse.json({ isLive: false, error: "Twitch authentication failed" }, { status: authResponse.status });
      }
      const authData = await authResponse.json();
      cachedToken = authData.access_token;
      // Сохраняем время жизни токена (вычитаем 1 минуту для запаса надежности)
      tokenExpiresAt = Date.now() + (authData.expires_in * 1000) - 60000;
    }

    // 2. Проверяем статус стрима
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${CHANNEL_NAME}`,
      {
        headers: {
          'Client-ID': CLIENT_ID,
          'Authorization': `Bearer ${cachedToken}`,
        },
      }
    );
    if (!streamResponse.ok) {
      const errorData = await streamResponse.json();
      console.error("Twitch Stream API Error:", errorData);
      return NextResponse.json({ isLive: false, error: "Failed to fetch stream status" }, { status: streamResponse.status });
    }
    const streamData = await streamResponse.json();

    // Если массив data не пустой — стрим идет
    const isLive = streamData.data && streamData.data.length > 0;

    return NextResponse.json({ isLive });
  } catch (e: unknown) {
    console.error("Twitch API request failed:", e);
    // В случае ошибки (например, неверные ключи) возвращаем оффлайн
    return NextResponse.json({ isLive: false, error: "Internal server error" }, { status: 500 });
  }
}