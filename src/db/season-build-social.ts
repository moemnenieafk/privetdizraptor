// Соц-слой сборок сезонных перков: канонизация сборки в строку (slug↔code) + реакции
// (лайк/дизлайк). Только сервер. Комментарии идут через общий полиморфный слой
// (entity_comments, тип цели `season-build`, target_id = slug) — тут только реакции и
// сама строка-якорь.
//
// Сборка stateless (весь билд в URL-коде). Строку заводим ЛЕНИВО — при первом заходе на
// страницу валидной сборки или первой реакции. Идемпотентно: unique(code) + ретрай гонки.
import { and, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { db } from "@/db";
import { seasonBuilds, seasonBuildReactions } from "@/db/schema";

// Короткий url-safe slug без похожих символов (как в public-builds).
const SLUG_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function genSlug(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)];
  return s;
}

export type ReactionValue = -1 | 0 | 1;

export interface SeasonBuildState {
  slug: string;
  up: number;
  down: number;
  /** Реакция зрителя: 1 лайк, -1 дизлайк, 0 нет. */
  myValue: ReactionValue;
}

interface BuildRow {
  id: string;
  slug: string;
  up: number;
  down: number;
}

/**
 * Строка-якорь сборки по КАНОН-коду (encodeBuild). Создаёт при отсутствии.
 * Возвращает null только при сбое БД (устойчивость: соц-блок молча прячется).
 */
async function ensureBuild(seasonSlug: string, canonCode: string): Promise<BuildRow | null> {
  try {
    const [existing] = await db
      .select({ id: seasonBuilds.id, slug: seasonBuilds.slug, up: seasonBuilds.up, down: seasonBuilds.down })
      .from(seasonBuilds)
      .where(eq(seasonBuilds.code, canonCode))
      .limit(1);
    if (existing) return existing;

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = genSlug();
      try {
        const [row] = await db
          .insert(seasonBuilds)
          .values({ slug, code: canonCode, seasonSlug })
          .returning({ id: seasonBuilds.id, slug: seasonBuilds.slug, up: seasonBuilds.up, down: seasonBuilds.down });
        if (row) return row;
      } catch (e) {
        const code = (e as { cause?: { code?: string } }).cause?.code;
        if (code === "23505") {
          // Гонка: либо slug-коллизия (ретрай новый slug), либо параллельно создали ту же
          // сборку по code — перечитываем и отдаём её.
          const [row] = await db
            .select({ id: seasonBuilds.id, slug: seasonBuilds.slug, up: seasonBuilds.up, down: seasonBuilds.down })
            .from(seasonBuilds)
            .where(eq(seasonBuilds.code, canonCode))
            .limit(1);
          if (row) return row;
          continue; // slug-коллизия без строки по code → следующий slug
        }
        throw e;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Реакция зрителя на сборку. 0 — нет или аноним. */
async function viewerReaction(buildId: string, viewerId: string | null): Promise<ReactionValue> {
  if (!viewerId) return 0;
  const [r] = await db
    .select({ value: seasonBuildReactions.value })
    .from(seasonBuildReactions)
    .where(and(eq(seasonBuildReactions.buildId, buildId), eq(seasonBuildReactions.userId, viewerId)))
    .limit(1);
  return (r?.value as ReactionValue) ?? 0;
}

/**
 * Состояние сборки для рендера (счётчики + реакция зрителя). Заводит строку лениво.
 * null — код невалиден пришёл пустым или сбой БД → страница прячет соц-блок.
 */
export async function getSeasonBuildState(
  seasonSlug: string,
  canonCode: string,
  viewerId: string | null,
): Promise<SeasonBuildState | null> {
  const b = await ensureBuild(seasonSlug, canonCode);
  if (!b) return null;
  return { slug: b.slug, up: b.up, down: b.down, myValue: await viewerReaction(b.id, viewerId) };
}

/** Код+сезон по slug (лента модерации / slug-параметр страницы). null — нет строки. */
export async function getSeasonBuildBySlug(
  slug: string,
): Promise<{ code: string; seasonSlug: string } | null> {
  try {
    const [r] = await db
      .select({ code: seasonBuilds.code, seasonSlug: seasonBuilds.seasonSlug })
      .from(seasonBuilds)
      .where(eq(seasonBuilds.slug, slug))
      .limit(1);
    return r ?? null;
  } catch {
    return null;
  }
}

/** Существование строки по slug — для targetExists комментов. */
export async function seasonBuildExists(slug: string): Promise<boolean> {
  return (await getSeasonBuildBySlug(slug)) !== null;
}

/**
 * Тоггл/смена реакции. next — желаемое значение (1 лайк / -1 дизлайк). Повтор той же
 * реакции снимает её (toggle off). Пересчитывает денорм-счётчики up/down.
 * Возвращает финальное состояние для оптимистичного UI.
 */
export async function setReaction(
  userId: string,
  seasonSlug: string,
  canonCode: string,
  next: 1 | -1,
): Promise<{ ok: boolean; state?: SeasonBuildState; error?: string }> {
  try {
    const b = await ensureBuild(seasonSlug, canonCode);
    if (!b) return { ok: false, error: "Сборка недоступна" };

    const current = await viewerReaction(b.id, userId);

    if (current === next) {
      // Тот же клик — снять.
      await db
        .delete(seasonBuildReactions)
        .where(and(eq(seasonBuildReactions.buildId, b.id), eq(seasonBuildReactions.userId, userId)));
    } else {
      await db
        .insert(seasonBuildReactions)
        .values({ buildId: b.id, userId, value: next })
        .onConflictDoUpdate({
          target: [seasonBuildReactions.buildId, seasonBuildReactions.userId],
          set: { value: next },
        });
    }

    // Пересчёт счётчиков одним запросом.
    const [agg] = await db
      .select({
        up: sql<number>`coalesce(sum(case when ${seasonBuildReactions.value} = 1 then 1 else 0 end), 0)::int`,
        down: sql<number>`coalesce(sum(case when ${seasonBuildReactions.value} = -1 then 1 else 0 end), 0)::int`,
      })
      .from(seasonBuildReactions)
      .where(eq(seasonBuildReactions.buildId, b.id));
    const up = agg?.up ?? 0;
    const down = agg?.down ?? 0;

    await db.update(seasonBuilds).set({ up, down }).where(eq(seasonBuilds.id, b.id));

    const myValue: ReactionValue = current === next ? 0 : next;
    return { ok: true, state: { slug: b.slug, up, down, myValue } };
  } catch {
    return { ok: false, error: "Не удалось учесть реакцию" };
  }
}
