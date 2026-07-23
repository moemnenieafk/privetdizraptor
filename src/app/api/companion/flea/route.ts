// /api/companion/flea — приём краудсорс-офферов барахолки от ПАССИВНОГО компаньона.
//   POST { gameMode?: 'regular'|'pve', offers: [{ inGameId, price }] } → { ok, accepted, received }
//
// §4.11: это запись в наше зеркало (staging `companion_flea_offers`), НЕ рантайм-фетч
// наружу. Игрок сам делает скриншот барахолки → ридер (Фаза 1) OCR-ит → шлёт сюда.
// Гейт по логину серверный: собираем только от идентифицированных авторов (порог
// доверия «N независимых» иначе не работает). См. [[eft-live-price-companion]].
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { eftGameId } from "@/db/eft";
import {
  insertCompanionOffers,
  TRUST,
  type CompanionGameMode,
  type CompanionOfferInput,
} from "@/db/companion-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const IN_GAME_ID_RE = /^[0-9a-f]{24}$/i;

function parseOffers(raw: unknown): CompanionOfferInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CompanionOfferInput[] = [];
  for (const o of raw) {
    if (typeof o !== "object" || o === null) return null;
    const { inGameId, price } = o as { inGameId?: unknown; price?: unknown };
    if (typeof inGameId !== "string" || !IN_GAME_ID_RE.test(inGameId)) return null;
    if (typeof price !== "number" || !Number.isInteger(price)) return null;
    if (price < TRUST.PRICE_MIN || price > TRUST.PRICE_MAX) return null;
    out.push({ inGameId, price });
  }
  return out;
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы отправлять цены");

  if (bodyTooLarge(req, JSON_BODY_CAP)) return err(413, "Слишком большой запрос");
  let body: { gameMode?: unknown; offers?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return err(400, "Некорректный запрос");
  }

  const gameMode: CompanionGameMode = body.gameMode === "pve" ? "pve" : "regular";

  const offers = parseOffers(body.offers);
  if (!offers) return err(422, "Некорректные офферы");
  if (offers.length === 0) return err(422, "Пустой список офферов");
  if (offers.length > TRUST.MAX_OFFERS_PER_REQUEST) return err(422, "Слишком много офферов за раз");

  // Лимит по автору: сабмит на предмет разрешаем щедро (игрок листает барахолку),
  // но частоту запросов ограничиваем — анти-флуд.
  if (!(await rateLimit(`companion:${me.id}`, 120, 3600))) {
    return err(429, "Слишком часто. Передохни");
  }

  const gameId = await eftGameId();
  const accepted = await insertCompanionOffers(gameId, gameMode, me.id, offers);

  return NextResponse.json({ ok: true, accepted, received: offers.length });
}
