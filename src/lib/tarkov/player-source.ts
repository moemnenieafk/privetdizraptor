// СЕРВЕРНЫЙ слой: ходит к апстриму player.tarkov.dev (публичный профиль BSG).
// Только server-side — обходит CORS/Turnstile-хостнейм апстрима. Наружу не экспонируем
// апстрим напрямую: клиент всегда идёт через наши роуты (rate-limit + Turnstile + кэш).
import type { GameMode, PlayerSearchHit, RawPlayerProfile } from "@/types/eft-player";

const BASE = "https://player.tarkov.dev";
const TIMEOUT_MS = 8000;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

async function request(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      signal: controller.signal,
      // Браузерные заголовки: без них Cloudflare апстрима режет датацентр-IP (403)
      // на origin-путях (/account/), которые не кэшируются на edge как /name/.
      // Referer/Origin tarkov.dev — мы проксируем тот же публичный сценарий.
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9,ru;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        referer: "https://tarkov.dev/",
        origin: "https://tarkov.dev",
      },
      // Ответ профиля меняется медленно — держим короткий edge-кэш поверх нашего БД-кэша.
      next: { revalidate: 300 },
    });
  } catch {
    throw new UpstreamError("Апстрим недоступен, попробуйте позже", 502);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new UpstreamError("Слишком много запросов к апстриму", 429);
  if (res.status === 404) throw new UpstreamError("Профиль не найден", 404);
  if (res.status >= 500) throw new UpstreamError("Ошибка апстрим-сервера", 502);
  if (res.status !== 200) {
    const bodyText = await res.text().catch(() => "");
    console.error(`[player-source] ${path} → HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
    throw new UpstreamError(`Ошибка запроса профиля (${res.status})`, res.status);
  }

  const json = (await res.json()) as { err?: unknown; errmsg?: string };
  if (json && typeof json === "object" && "err" in json && json.err) {
    throw new UpstreamError(json.errmsg || "Ошибка апстрима", 502);
  }
  return json;
}

export async function searchPlayersByName(
  name: string,
  gameMode: GameMode,
): Promise<PlayerSearchHit[]> {
  const data = await request(`/name/${encodeURIComponent(name)}?gameMode=${gameMode}`);
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (d): d is PlayerSearchHit =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as PlayerSearchHit).aid === "number" &&
        typeof (d as PlayerSearchHit).name === "string",
    )
    .map((d) => ({ aid: d.aid, name: d.name }));
}

export async function fetchAccount(
  aid: string,
  gameMode: GameMode,
): Promise<RawPlayerProfile> {
  const data = await request(`/account/${encodeURIComponent(aid)}?gameMode=${gameMode}`);
  if (typeof data !== "object" || data === null || typeof (data as RawPlayerProfile).aid !== "number") {
    throw new UpstreamError("Некорректный ответ профиля", 502);
  }
  return data as RawPlayerProfile;
}
