import type { SocialPlatform } from "@/lib/auth/me";

// Соцсети в profiles хранятся как ХЕНДЛЫ (не URL), см. /api/account/social.
// Здесь строим публичную ссылку. Discord профильного URL по хендлу не имеет —
// возвращаем null (на UI показываем хендл текстом, без ссылки).
export function socialUrl(platform: SocialPlatform, handle: string): string | null {
  const h = handle.trim().replace(/^@/, "");
  if (!h) return null;
  switch (platform) {
    case "twitch":
      return `https://twitch.tv/${h}`;
    case "youtube":
      return `https://www.youtube.com/@${h}`;
    case "steam":
      return `https://steamcommunity.com/id/${h}`;
    case "discord":
      return null;
  }
}
