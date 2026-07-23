// Агрегатор краудсорс-цен компаньона: сырьё `companion_flea_offers` → «живая» цена.
// Фаза 0 ([[eft-live-price-companion]]): ТОЛЬКО захват + агрегат. Перезапись боевой
// цены в `prices` — Фаза 2 (после quality-гейтов). Здесь ничего не мутируем в prices.
import { sql, and, eq, inArray } from "drizzle-orm";
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
  /** Разброс-гейт: если цены предмета в окне расходятся сильнее чем в SPREAD_MAX раз
   *  (max/min), цена НЕнадёжна — смешаны состояния (ключ 314: 1/10 исп. ~770к vs 10/10
   *  ~5кк, разное состояние брони/оружия) или манипуляция. Не публикуем такой агрегат.
   *  Полноценный учёт состояния (OCR использований) — отдельно. */
  SPREAD_MAX: 3,
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

/** Взвешенная медиана: первое значение, где накопленный вес достигает половины суммы. */
function weightedMedian(items: { value: number; weight: number }[]): number {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  let acc = 0;
  for (const it of sorted) {
    acc += it.weight;
    if (acc >= total / 2) return it.value;
  }
  return sorted[sorted.length - 1].value;
}

/**
 * Насколько карма тилтит вес голоса: `вес = 1 + карма × TILT`. Floor = 1 → новичок
 * (карма ~0) всё равно голосует, ветеран весит больше. TILT=1 — мягкий тилт под
 * Скупщик-философию медленного грайнда (карма 2–3 → вес 3–4 против новичка 1). Тюнится.
 */
export const KARMA_VOTE_TILT = 1;

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
/** Микро-бонус: обновил устаревшую цену (>60мин) — чуточку больше. */
const KARMA_STALE_BONUS = 0.01;
/** Обновил ОЧЕНЬ старую (>6ч) или предмет без данных — направляем усилие туда, где нужнее. */
const KARMA_VERY_STALE_BONUS = 0.02;
const VERY_STALE_MIN = 360;

/** Атомарно +amount к репутации автора. Возвращает новое значение. */
export async function addCompanionKarma(userId: string, amount: number = KARMA_PER_UPLOAD): Promise<number> {
  const rows = (await db.execute(sql`
    update public.profiles set companion_karma = companion_karma + ${amount}
    where id = ${userId} returning companion_karma as "karma"
  `)) as unknown as Array<{ karma: number }>;
  return rows[0]?.karma ?? 0;
}

/**
 * Сколько кармы дать за выгрузку: база + бонус по СТЕПЕНИ устаревания обновлённого
 * (берём самый протухший предмет пачки). Вызывать ДО вставки — считает прежнее состояние.
 * Свежие обновления — только база; чем старее была цена, тем щедрее (доска заказов).
 */
export async function uploadKarmaFor(
  gameId: string,
  gameMode: CompanionGameMode,
  inGameIds: string[],
): Promise<number> {
  const ids = [...new Set(inGameIds)];
  if (ids.length === 0) return KARMA_PER_UPLOAD;
  try {
    const rows = await db
      .select({ inGameId: companionFleaOffers.inGameId, lastAt: sql<string>`max(${companionFleaOffers.submittedAt})` })
      .from(companionFleaOffers)
      .where(
        and(
          eq(companionFleaOffers.gameId, gameId),
          eq(companionFleaOffers.gameMode, gameMode),
          inArray(companionFleaOffers.inGameId, ids),
        ),
      )
      .groupBy(companionFleaOffers.inGameId);
    const lastMap = new Map(rows.map((r) => [r.inGameId, new Date(r.lastAt).getTime()]));
    const now = Date.now();
    let bonus = 0;
    for (const id of ids) {
      const last = lastMap.get(id);
      const ageMin = last == null ? Infinity : (now - last) / 60000; // нет данных = максимально «старо»
      if (ageMin >= VERY_STALE_MIN) bonus = Math.max(bonus, KARMA_VERY_STALE_BONUS);
      else if (ageMin >= WORKLIST_STALE_MIN) bonus = Math.max(bonus, KARMA_STALE_BONUS);
    }
    return Math.round((KARMA_PER_UPLOAD + bonus) * 1000) / 1000;
  } catch {
    return KARMA_PER_UPLOAD;
  }
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
    // Тянем сырьё окна + карму автора; взвешенную медиану считаем в JS (percentile_cont
    // с весами в SQL нет). Цена: доверенные (mod/admin) → их медиана (истина, минуя толпу);
    // иначе — медиана толпы, ВЗВЕШЕННАЯ по карме (вес = 1 + карма×TILT). Квалификация:
    // есть доверенный ЛИБО ≥N независимых авторов.
    const raw = (await db.execute(sql`
      select o.in_game_id as "inGameId", o.price::int as "price", o.trusted as "trusted",
        o.submitted_by as "submittedBy", o.submitted_at as "submittedAt",
        coalesce(pr.companion_karma, 0)::float8 as "karma"
      from public.companion_flea_offers o
      left join public.profiles pr on pr.id = o.submitted_by
      where o.game_id = ${gameId}
        and o.game_mode = ${gameMode}
        and o.submitted_at >= now() - make_interval(mins => ${TRUST.WINDOW_MIN}::int)
    `)) as unknown as Array<{
      inGameId: string;
      price: number;
      trusted: boolean;
      submittedBy: string;
      submittedAt: string | Date;
      karma: number;
    }>;

    // Группируем по предмету.
    const groups = new Map<string, typeof raw>();
    for (const o of raw) {
      const g = groups.get(o.inGameId);
      if (g) g.push(o);
      else groups.set(o.inGameId, [o]);
    }

    const map = new Map<string, CompanionPrice>();
    for (const [inGameId, offers] of groups) {
      const submitters = new Set(offers.map((o) => o.submittedBy)).size;
      const trustedOffers = offers.filter((o) => o.trusted);
      const hasTrusted = trustedOffers.length > 0;
      if (!hasTrusted && submitters < TRUST.MIN_SUBMITTERS) continue; // не квалифицируется

      // Разброс-гейт: смешаны состояния (ключи/износ) или манипуляция → цена ненадёжна.
      const usedPrices = (hasTrusted ? trustedOffers : offers).map((o) => o.price);
      const lo = Math.min(...usedPrices);
      const hi = Math.max(...usedPrices);
      if (lo > 0 && hi / lo > TRUST.SPREAD_MAX) continue;

      const price = hasTrusted
        ? median(trustedOffers.map((o) => o.price))
        : weightedMedian(offers.map((o) => ({ value: o.price, weight: 1 + o.karma * KARMA_VOTE_TILT })));

      const freshestAt = new Date(Math.max(...offers.map((o) => new Date(o.submittedAt).getTime())));
      map.set(inGameId, { price, offers: offers.length, submitters, trusted: hasTrusted, freshestAt });
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
