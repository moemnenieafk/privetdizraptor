// /api/companion/flea — приём краудсорс-офферов барахолки от ПАССИВНОГО компаньона.
//   POST { gameMode?: 'regular'|'pve', offers: [{ inGameId, price }] } → { ok, accepted, received }
//
// §4.11: это запись в наше зеркало (staging `companion_flea_offers`), НЕ рантайм-фетч
// наружу. Игрок сам делает скриншот барахолки → ридер (Фаза 1) OCR-ит → шлёт сюда.
// Гейт по логину серверный: собираем только от идентифицированных авторов (порог
// доверия «N независимых» иначе не работает). См. [[eft-live-price-companion]].
import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth/me";
import { canModerate } from "@/lib/auth/roles";
import { bodyTooLarge, JSON_BODY_CAP } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { eftGameId } from "@/db/eft";
import {
  insertCompanionOffers,
  addCompanionKarma,
  getCompanionKarma,
  uploadKarmaFor,
  TRUST,
  type CompanionGameMode,
  type CompanionOfferInput,
} from "@/db/companion-prices";
import { isBanned, detectCompanionAnomalies } from "@/db/companion-anomalies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const err = (status: number, error: string) => NextResponse.json({ error }, { status });
const IN_GAME_ID_RE = /^[0-9a-f]{24}$/i;

function parseOffers(raw: unknown): CompanionOfferInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CompanionOfferInput[] = [];
  for (const o of raw) {
    if (typeof o !== "object" || o === null) return null;
    const { inGameId, price, uses, maxUses } = o as {
      inGameId?: unknown;
      price?: unknown;
      uses?: unknown;
      maxUses?: unknown;
    };
    if (typeof inGameId !== "string" || !IN_GAME_ID_RE.test(inGameId)) return null;
    if (typeof price !== "number" || !Number.isInteger(price)) return null;
    if (price < TRUST.PRICE_MIN || price > TRUST.PRICE_MAX) return null;
    // Использования опциональны; принимаем только валидную пару X≤Y (иначе игнор).
    let u: number | undefined;
    let mx: number | undefined;
    if (
      typeof uses === "number" &&
      typeof maxUses === "number" &&
      Number.isInteger(uses) &&
      Number.isInteger(maxUses) &&
      maxUses > 0 &&
      maxUses <= 1000 &&
      uses >= 0 &&
      uses <= maxUses
    ) {
      u = uses;
      mx = maxUses;
    }
    out.push({ inGameId, price, uses: u, maxUses: mx });
  }
  return out;
}

export async function POST(req: Request): Promise<NextResponse> {
  const me = await getMe();
  if (!me) return err(401, "Войдите, чтобы отправлять цены");
  if (await isBanned(me.id)) return err(403, "Доступ к компаньону заблокирован");

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

  // Доверенная роль (moderator/admin) → авторитетный оффер: становится истиной сразу,
  // в обход порога ≥3 и медианы толпы (см. companion-prices.getCompanionPriceMap).
  const trusted = canModerate(me.role);
  const gameId = await eftGameId();

  // Карму считаем ДО вставки (по ПРЕЖНЕЙ свежести): только за устаревшее/без данных.
  const karmaAmount = await uploadKarmaFor(gameId, gameMode, offers.map((o) => o.inGameId));
  const accepted = await insertCompanionOffers(gameId, gameMode, me.id, offers, trusted);

  // Начисляем только за принятую выгрузку с ненулевой пользой; дневной потолок — внутри.
  let karma: number;
  let gained = 0;
  if (accepted > 0 && karmaAmount > 0) {
    const r = await addCompanionKarma(me.id, karmaAmount);
    karma = r.karma;
    gained = r.gained;
  } else {
    karma = await getCompanionKarma(me.id);
  }

  // Инлайн-детект аномалий по обновлённым предметам (плюс периодический крон-свип).
  if (accepted > 0) await detectCompanionAnomalies(gameMode, offers.map((o) => o.inGameId));

  return NextResponse.json({ ok: true, accepted, trusted, karma, gained, received: offers.length });
}
