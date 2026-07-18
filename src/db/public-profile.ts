// Агрегатор публичного профиля /u/[username]. Только для сервера (Drizzle owner-ролью,
// мимо RLS — страница публична и рендерится на сервере). Отдаёт game-независимую шапку
// (profiles) + секции по играм. Пер-игровые данные переиспользуют читалки «Связи»
// (карма, верификация). Мультигейм: добавить игру = дописать builder в SECTION_BUILDERS.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, profiles } from "@/db/schema";
import { comlinkProfiles, comlinkRaids, type ComlinkGoal } from "@/db/schema-comlink";
import { getKarmaMap, type KarmaInfo } from "@/db/comlink";
import { getVerifiedMap } from "@/db/verification";
import { eftGameId } from "@/db/eft";

export interface PublicGameSection {
  gameCode: string;
  gameName: string;
  /** Подтверждён ли ЧВК-профиль в этой игре (галочка). */
  verified: boolean;
  verifiedNickname: string | null;
  karma: KarmaInfo;
  confirmedRaids: number;
  /** Снимок игрового профиля из анкеты (ник/уровень/фракция/режим). */
  snapshot: { nickname: string; level: string; faction: string; mode: string } | null;
  /** Публичная анкета «Связи». null — анкеты в этой игре нет (но может быть верификация). */
  anketa: {
    goal: ComlinkGoal;
    about: string;
    voice: boolean;
    maps: string[];
    playStyle: string[];
    playTime: string[];
  } | null;
}

export interface PublicProfile {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: string;
  memberSince: string | null;
  socials: {
    twitch: string | null;
    youtube: string | null;
    discord: string | null;
    steam: string | null;
  };
  /** Подтверждён хотя бы в одной игре — общая галочка в шапке. */
  verifiedAnywhere: boolean;
  /** Публичный статус «Стример» (подтверждённый Twitch) — бейдж + твич-рамка. */
  streamer: boolean;
  sections: PublicGameSection[];
}

/** Подтверждённых рейдов через ЦТА (та же логика, что в списке кандидатов). */
async function confirmedRaidCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(comlinkRaids)
    .where(
      and(
        eq(comlinkRaids.status, "confirmed"),
        sql`(${comlinkRaids.initiatorId} = ${userId} or ${comlinkRaids.partnerId} = ${userId})`,
      ),
    );
  return row?.n ?? 0;
}

/** EFT-секция: анкета «Связи» + верификация + карма/рейды. null — показывать нечего. */
async function buildEftSection(userId: string): Promise<PublicGameSection | null> {
  const gameId = await eftGameId();

  const [game] = await db.select({ name: games.name }).from(games).where(eq(games.id, gameId)).limit(1);

  const [anketaRow] = await db
    .select()
    .from(comlinkProfiles)
    .where(and(eq(comlinkProfiles.userId, userId), eq(comlinkProfiles.gameId, gameId)))
    .limit(1);

  const [verifiedMap, karmaMap] = await Promise.all([
    getVerifiedMap([userId]),
    getKarmaMap([userId]),
  ]);
  const verifiedNickname = verifiedMap.get(userId) ?? null;

  // Показываем анкету только если она активна (как в публичном списке кандидатов).
  const anketaActive = anketaRow?.active === true;

  // Нечего показывать: ни активной анкеты, ни подтверждения.
  if (!anketaActive && verifiedNickname === null) return null;

  const confirmedRaids = await confirmedRaidCount(userId);

  return {
    gameCode: "eft",
    gameName: game?.name ?? "Escape from Tarkov",
    verified: verifiedNickname !== null,
    verifiedNickname,
    karma: karmaMap.get(userId) ?? { total: 0, tierId: "wild", tierLabel: "Дикий" },
    confirmedRaids,
    snapshot: anketaActive ? anketaRow.gameSnapshot : null,
    anketa: anketaActive
      ? {
          goal: anketaRow.goal,
          about: anketaRow.about,
          voice: anketaRow.voice,
          maps: anketaRow.maps,
          playStyle: anketaRow.playStyle,
          playTime: anketaRow.playTime,
        }
      : null,
  };
}

// Реестр билдеров секций по играм. Новая игра — добавить сюда свой builder.
const SECTION_BUILDERS: ((userId: string) => Promise<PublicGameSection | null>)[] = [buildEftSection];

/**
 * Публичный профиль по логину (регистр не важен). null — юзер не найден ИЛИ не
 * включил публичность (opt-in). Приватность соц-раздела: без public_profile=true
 * страница не отдаётся.
 */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const handle = username.trim();
  if (!handle) return null;

  const [p] = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      role: profiles.role,
      createdAt: profiles.createdAt,
      publicProfile: profiles.publicProfile,
      streamer: profiles.streamer,
      twitch: profiles.twitch,
      youtube: profiles.youtube,
      discord: profiles.discord,
      steam: profiles.steam,
    })
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${handle})`)
    .limit(1);

  if (!p || !p.publicProfile || !p.username) return null;

  const built = await Promise.all(SECTION_BUILDERS.map((b) => b(p.id)));
  const sections = built.filter((s): s is PublicGameSection => s !== null);

  return {
    userId: p.id,
    username: p.username,
    avatarUrl: p.avatarUrl,
    role: p.role,
    memberSince: p.createdAt ? p.createdAt.toISOString() : null,
    socials: { twitch: p.twitch, youtube: p.youtube, discord: p.discord, steam: p.steam },
    verifiedAnywhere: sections.some((s) => s.verified),
    streamer: p.streamer === true,
    sections,
  };
}
