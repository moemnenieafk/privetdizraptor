// POST /api/eft/player-search — поиск игрока по нику (обёртка над player.tarkov.dev).
// Защита: Turnstile (капча) + app-level rate-limit по IP. Апстрим дёргается только
// с сервера (CORS/хостнейм-локи апстрима обходятся). Возвращает [{ aid, name }].
import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { bodyTooLarge } from "@/lib/http";
import { searchPlayersByName, UpstreamError } from "@/lib/tarkov/player-source";
import { isValidPlayerName } from "@/lib/tarkov/player-stats";
import { isGameMode } from "@/types/eft-player";

export const runtime = "nodejs";

const BODY_CAP = 4 * 1024; // тело крошечное: { name, gameMode, captchaToken }

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  if (bodyTooLarge(req, BODY_CAP)) return err(413, "too large");

  const ip = clientIp(req);
  // 20 поисков за 10 минут на IP — с запасом для живого юзера, глушит флуд апстрима.
  if (!(await rateLimit(`player-search:ip:${ip}`, 20, 600))) {
    return err(429, "Слишком много запросов, подождите минуту");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "bad json");
  }
  if (typeof body !== "object" || body === null) return err(422, "bad payload");

  const { name, gameMode, captchaToken } = body as {
    name?: unknown;
    gameMode?: unknown;
    captchaToken?: unknown;
  };

  if (typeof name !== "string" || !isValidPlayerName(name)) {
    return err(422, "Ник: 3–15 символов, латиница/цифры/-/_");
  }
  const mode = typeof gameMode === "string" && isGameMode(gameMode) ? gameMode : "regular";

  if (!(await verifyTurnstile(typeof captchaToken === "string" ? captchaToken : null, ip))) {
    return err(401, "Проверка капчи не пройдена");
  }

  try {
    const hits = await searchPlayersByName(name, mode);
    hits.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ hits });
  } catch (error) {
    if (error instanceof UpstreamError) return err(error.status === 404 ? 200 : error.status, error.message);
    return err(502, "Ошибка апстрима");
  }
}
