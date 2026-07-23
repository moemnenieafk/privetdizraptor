// Агрегатор краудсорс-цен компаньона: сырьё `companion_flea_offers` → «живая» цена.
// Фаза 0 ([[eft-live-price-companion]]): ТОЛЬКО захват + агрегат. Перезапись боевой
// цены в `prices` — Фаза 2 (после quality-гейтов). Здесь ничего не мутируем в prices.
import { sql } from "drizzle-orm";
import { db } from "./index";
import { companionFleaOffers } from "./schema";
import { eftGameId } from "./eft";
import { memoTTL } from "../lib/server-cache";

/** Старше этого — «устарело» в worklist (2× окна свежести). */
const WORKLIST_STALE_MIN = 60;

export interface WorklistItem {
  inGameId: string;
  slug: string; // normalizedName для ссылки /eft/items/item/<slug>
  name: string; // ru-имя
  value: number; // ценность (tarkov.dev avg24h/lastLow) — для приоритета
  lastAt: string | null; // ISO последнего оффера или null
  status: "stale" | "no-data";
}

/**
 * «Цены, которые стоит обновить»: дорогие предметы БЕЗ свежей companion-цены
 * (нет данных ИЛИ устарело). Приоритет по ценности — обновлять дорогое важнее хлама.
 */
export async function getCompanionWorklist(limit = 30): Promise<WorklistItem[]> {
  try {
    const gameId = await eftGameId();
    const rows = (await db.execute(sql`
      select p.in_game_id as "inGameId", p.normalized_name as "slug", i.name as "name",
        coalesce(p.avg24h_price, p.last_low_price)::int as "value",
        c.last_at as "lastAt"
      from public.prices p
      join public.items i on i.in_game_id = p.in_game_id and i.game_id = p.game_id
      left join (
        select in_game_id, max(submitted_at) as last_at
        from public.companion_flea_offers where game_id = ${gameId} group by in_game_id
      ) c on c.in_game_id = p.in_game_id
      where p.game_id = ${gameId}
        and coalesce(p.avg24h_price, p.last_low_price) > 0
        and p.normalized_name is not null
        and (c.last_at is null or c.last_at < now() - make_interval(mins => ${WORKLIST_STALE_MIN}::int))
      order by "value" desc
      limit ${limit}
    `)) as unknown as Array<{ inGameId: string; slug: string; name: string; value: number; lastAt: string | Date | null }>;

    return rows.map((r) => ({
      inGameId: r.inGameId,
      slug: r.slug,
      name: r.name,
      value: r.value,
      lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
      status: r.lastAt ? "stale" : "no-data",
    }));
  } catch (e) {
    console.error("[getCompanionWorklist]", e);
    return [];
  }
}

export type CompanionGameMode = "regular" | "pve";

// ── Конфиг доверия (тюнится тут; дефолты — из решения V4DYA 2026-07-23) ──────────
export const TRUST = {
  /** Мин. число НЕЗАВИСИМЫХ авторов сабмита на предмет, чтобы цена считалась «живой». */
  MIN_SUBMITTERS: 3,
  /** Окно свежести: офферы старше — не участвуют в агрегате. */
  WINDOW_MIN: 30,
  /** Санити-границы цены за штуку (₽) — грубый отсев мусора OCR на приёме. */
  PRICE_MIN: 1,
  PRICE_MAX: 1_000_000_000,
  /** Максимум офферов в одном сабмите (анти-флуд на приёме). */
  MAX_OFFERS_PER_REQUEST: 500,
  /** Якорь на tarkov.dev: companion-цена публикуется только в этом коридоре от ref
   *  (avg24h/lastLow). Широкий (1/3…3×) — пропускает реальные колебания рынка, но
   *  ловит грубые OCR-мисриды (пропуск разряда = 10×) и накрутку. Применяется ко ВСЕМ,
   *  включая trusted (OCR-ошибка бывает и у модератора — его тест-цена 139002 попадётся). */
  ANCHOR_LOW: 1 / 3,
  ANCHOR_HIGH: 3,
} as const;

/**
 * Publication-гейт: companion-цена в разумном коридоре от tarkov.dev-референса.
 * `ref` falsy → якоря нет (публикуем как есть — других данных по предмету нет).
 */
export function withinAnchor(companionPrice: number, ref: number | undefined): boolean {
  if (!ref || ref <= 0) return true;
  return companionPrice >= ref * TRUST.ANCHOR_LOW && companionPrice <= ref * TRUST.ANCHOR_HIGH;
}

export interface CompanionPrice {
  price: number; // медиана по окну (робастна к выбросам OCR)
  offers: number; // сколько офферов легло в расчёт
  submitters: number; // сколько независимых авторов (порог доверия)
  trusted: boolean; // цена от доверенной роли (moderator/admin) — авторитетна, не толпа
  freshestAt: Date; // самый свежий оффер в окне
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export interface CompanionOfferInput {
  inGameId: string;
  price: number;
}

/**
 * Карма за ОДНУ выгрузку (submit с ≥1 принятым предложением). Микро-начисление —
 * как лояльность Скупщика в EFT (0.01). Медленный грайнд: вес голоса не накрутить
 * мультиаккаунтами. Тюнится (до 0.001). Начисляем только за принятое (прошло валидацию).
 */
export const KARMA_PER_UPLOAD = 0.01;

/** Атомарно +KARMA_PER_UPLOAD к репутации автора. Возвращает новое значение. */
export async function addCompanionKarma(userId: string): Promise<number> {
  const rows = (await db.execute(sql`
    update public.profiles set companion_karma = companion_karma + ${KARMA_PER_UPLOAD}
    where id = ${userId} returning companion_karma as "karma"
  `)) as unknown as Array<{ karma: number }>;
  return rows[0]?.karma ?? 0;
}

/** Текущая репутация автора. */
export async function getCompanionKarma(userId: string): Promise<number> {
  try {
    const rows = (await db.execute(sql`
      select companion_karma as "karma" from public.profiles where id = ${userId}
    `)) as unknown as Array<{ karma: number }>;
    return rows[0]?.karma ?? 0;
  } catch {
    return 0;
  }
}

/** Мемо-обёртка агрегата под EFT (резолвит gameId, кэш 60с — окно свежести 30 мин). */
export function getEftCompanionMap(
  gameMode: CompanionGameMode = "regular",
): Promise<Map<string, CompanionPrice>> {
  return memoTTL(`companion-map-${gameMode}`, 60_000, async () => {
    const gameId = await eftGameId();
    return getCompanionPriceMap(gameId, gameMode);
  });
}

/**
 * Агрегат по окну: median цены на предмет там, где ≥ MIN_SUBMITTERS независимых авторов.
 * Считаем в SQL (percentile_cont) — по всем предметам разом, без вытаскивания сырья в JS.
 * Возвращает Map<inGameId, CompanionPrice>. Пусто (cold-start) — норм, не бросаем.
 */
export async function getCompanionPriceMap(
  gameId: string,
  gameMode: CompanionGameMode = "regular",
): Promise<Map<string, CompanionPrice>> {
  try {
    // Квалификация строки: есть доверенный оффер (moderator/admin) ЛИБО ≥N независимых
    // авторов. Цена: если есть доверенные — их медиана (истина, минуя толпу), иначе —
    // медиана толпы. Медиану доверенных считаем в JS из массива (FILTER на percentile_cont
    // ненадёжен), толпу — percentile_cont в SQL.
    const rows = (await db.execute(sql`
      select
        in_game_id                                             as "inGameId",
        percentile_cont(0.5) within group (order by price)::int as "crowdMedian",
        array_agg(price) filter (where trusted)                as "trustedPrices",
        count(*)::int                                          as "offers",
        count(distinct submitted_by)::int                     as "submitters",
        bool_or(trusted)                                       as "hasTrusted",
        max(submitted_at)                                     as "freshestAt"
      from public.companion_flea_offers
      where game_id = ${gameId}
        and game_mode = ${gameMode}
        and submitted_at >= now() - make_interval(mins => ${TRUST.WINDOW_MIN}::int)
      group by in_game_id
      having bool_or(trusted) or count(distinct submitted_by) >= ${TRUST.MIN_SUBMITTERS}
    `)) as unknown as Array<{
      inGameId: string;
      crowdMedian: number;
      trustedPrices: number[] | null;
      offers: number;
      submitters: number;
      hasTrusted: boolean;
      freshestAt: string | Date;
    }>;

    const map = new Map<string, CompanionPrice>();
    for (const r of rows) {
      const trusted = r.hasTrusted && !!r.trustedPrices?.length;
      map.set(r.inGameId, {
        price: trusted ? median(r.trustedPrices as number[]) : r.crowdMedian,
        offers: r.offers,
        submitters: r.submitters,
        trusted,
        freshestAt: new Date(r.freshestAt),
      });
    }
    return map;
  } catch (e) {
    console.error("[getCompanionPriceMap]", e);
    return new Map();
  }
}

/**
 * Вставка сырых офферов от одного автора. Валидация границ — на вызывающей стороне
 * (route); здесь финальная страховка + bulk insert. Возвращает число принятых строк.
 */
export async function insertCompanionOffers(
  gameId: string,
  gameMode: CompanionGameMode,
  submittedBy: string,
  offers: CompanionOfferInput[],
  trusted = false,
): Promise<number> {
  const rows = offers
    .filter(
      (o) =>
        /^[0-9a-f]{24}$/i.test(o.inGameId) &&
        Number.isInteger(o.price) &&
        o.price >= TRUST.PRICE_MIN &&
        o.price <= TRUST.PRICE_MAX,
    )
    .map((o) => ({ gameId, inGameId: o.inGameId, gameMode, price: o.price, submittedBy, trusted }));

  if (rows.length === 0) return 0;
  await db.insert(companionFleaOffers).values(rows);
  return rows.length;
}
