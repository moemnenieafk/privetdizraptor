// Чистые хелперы разбора личного профиля (без серверных импортов, безопасны на клиенте).
import type {
  PlayerMasteringView,
  PlayerSkillView,
  PlayerView,
  ProfileEdition,
  RaidSide,
  RaidStatLine,
  RawCounterItem,
  RawPlayerProfile,
  RawSideStats,
} from "@/types/eft-player";

/** Битфлаги memberCategory → бейджи (издания/статусы). */
const MEMBER_FLAGS: ReadonlyArray<{ bit: number; label: string }> = [
  { bit: 2, label: "EOD" },
  { bit: 1024, label: "Unheard" },
  { bit: 256, label: "Sherpa" },
  { bit: 512, label: "Emissary" },
  { bit: 1, label: "Developer" },
  { bit: 32, label: "Moderator" },
];

export function memberBadges(memberCategory: number): string[] {
  if (!Number.isFinite(memberCategory) || memberCategory <= 0) return [];
  return MEMBER_FLAGS.filter((f) => (memberCategory & f.bit) === f.bit).map((f) => f.label);
}

export function sideLabel(side: string): string {
  const s = (side || "").toLowerCase();
  if (s === "savage") return "SCAV";
  return side ? side.toUpperCase() : "—";
}

// Кумулятивный опыт для уровней 1..79 (EFT 1.0, EFT-wiki). Индекс = уровень−1.
const LEVEL_CUM: readonly number[] = [
  0, 1000, 4017, 8432, 14256, 21477, 30023, 39936, 51204, 63723, 77563, 93279, 115302, 143253,
  177337, 217885, 264432, 316851, 374400, 437465, 505161, 577978, 656347, 741150, 836066, 944133,
  1066259, 1199423, 1343743, 1499338, 1666320, 1846664, 2043349, 2258436, 2492126, 2750217, 3032022,
  3337766, 3663831, 4010401, 4377662, 4765799, 5182399, 5627732, 6102063, 6630287, 7189442, 7779792,
  8401607, 9055144, 9740666, 10458431, 11219666, 12024744, 12874041, 13767918, 14706741, 15690872,
  16720667, 17816442, 19041492, 20360945, 21792266, 23350443, 25098462, 27100775, 29581231, 33028574,
  37953544, 44260543, 51901513, 60887711, 71228846, 82933459, 96009180, 110462910, 126300949,
  144924572, 172016256,
];

/** Уровень PMC из накопленного опыта (в рамках текущего престижа). */
export function experienceToLevel(exp: number): number {
  if (!Number.isFinite(exp) || exp <= 0) return 1;
  let level = 1;
  for (let i = 0; i < LEVEL_CUM.length; i++) {
    if (exp >= LEVEL_CUM[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Издание из memberCategory-битов (для отображаемого — selectedMemberCategory приоритетнее). */
function editionFrom(memberCategory: number, selected?: number): ProfileEdition {
  const m = (selected ?? 0) > 0 ? (selected as number) : memberCategory;
  if ((m & 1024) === 1024) return "TUE"; // Unheard
  if ((m & 2) === 2) return "EOD"; // Edge of Darkness
  return "Standard";
}

/** Значение счётчика: элемент совпадает, если его Key содержит ВСЕ keyParts
 *  (сторона 'Pmc'/'Scav' в реальных ключах игнорируется — сторону задаёт объект). */
export function extractCounter(items: RawCounterItem[], keyParts: string[]): number {
  const found = items.find((s) => keyParts.every((part) => s.Key.includes(part)));
  return found?.Value ?? 0;
}

const STAT_KEYS: ReadonlyArray<{
  name: keyof Omit<RaidStatLine, "side" | "survivalRate" | "kdr">;
  key: string[];
}> = [
  { name: "raids", key: ["Sessions"] },
  { name: "survived", key: ["ExitStatus", "Survived"] },
  { name: "runthrough", key: ["ExitStatus", "Runner"] },
  { name: "transit", key: ["ExitStatus", "Transit"] },
  { name: "mia", key: ["ExitStatus", "MissingInAction"] },
  { name: "kia", key: ["Deaths"] },
  { name: "kills", key: ["Kills"] },
  { name: "killsPmc", key: ["KilledPmc"] },
  { name: "streak", key: ["LongestWinStreak"] },
];

function emptyLine(side: RaidSide): RaidStatLine {
  return {
    side,
    raids: 0,
    survived: 0,
    runthrough: 0,
    transit: 0,
    mia: 0,
    kia: 0,
    kills: 0,
    killsPmc: 0,
    streak: 0,
    survivalRate: 0,
    kdr: 0,
  };
}

function derive(line: RaidStatLine): RaidStatLine {
  const alive = line.survived + line.runthrough + line.transit;
  line.survivalRate = line.raids > 0 ? (alive / line.raids) * 100 : 0;
  line.kdr = line.kia > 0 ? line.kills / line.kia : line.kills;
  return line;
}

/** Собирает [Total, PMC, Scav] из pmcStats/scavStats. */
export function buildRaidStats(profile: RawPlayerProfile): RaidStatLine[] {
  const sides: Array<{ key: "pmcStats" | "scavStats"; side: RaidSide }> = [
    { key: "pmcStats", side: "PMC" },
    { key: "scavStats", side: "Scav" },
  ];
  const total = emptyLine("Total");
  const lines: RaidStatLine[] = [];

  for (const { key, side } of sides) {
    const items = (profile[key] as RawSideStats | undefined)?.eft?.overAllCounters?.Items;
    if (!items) continue;
    const line = emptyLine(side);
    for (const st of STAT_KEYS) {
      const v = extractCounter(items, st.key);
      line[st.name] = v;
      total[st.name] += v;
    }
    lines.push(derive(line));
  }

  total.streak = Math.max(...lines.map((l) => l.streak), 0);
  return [derive(total), ...lines];
}

export interface PlaytimeParts {
  hours: number;
  minutes: number;
}

export function playtime(totalSeconds: number): PlaytimeParts {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  return { hours: Math.trunc(safe / 3600), minutes: Math.trunc(safe / 60) % 60 };
}

/** Уровень навыка из накопленного Progress (100 = уровень, максимум 51/elite). */
function skillLevel(progress: number): number {
  return Math.min(51, Math.floor(progress / 100));
}

function skills(profile: RawPlayerProfile): PlayerSkillView[] {
  const common = profile.skills?.Common;
  if (!common) return [];
  return common
    .map((s) => ({ id: s.Id, level: skillLevel(s.Progress) }))
    .filter((s) => s.level > 0)
    .sort((a, b) => b.level - a.level);
}

function mastering(profile: RawPlayerProfile): PlayerMasteringView[] {
  const m = profile.skills?.Mastering;
  if (!m) return [];
  return m
    .filter((x) => x.Progress > 0)
    .map((x) => ({ id: x.Id, progress: Math.round(x.Progress) }))
    .sort((a, b) => b.progress - a.progress);
}

/** Проверка/типизация произвольного JSON как профиля. null — если это не профиль. */
export function parseProfile(data: unknown): RawPlayerProfile | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.aid !== "number") return null;
  if (typeof d.info !== "object" || d.info === null) return null;
  const info = d.info as Record<string, unknown>;
  if (typeof info.nickname !== "string") return null;
  return d as unknown as RawPlayerProfile;
}

/** RAW-профиль → вью-модель. */
export function normalizeProfile(profile: RawPlayerProfile): PlayerView {
  const totalTimeSeconds =
    profile.pmcStats?.eft?.totalInGameTime ?? profile.scavStats?.eft?.totalInGameTime ?? 0;

  return {
    aid: profile.aid,
    nickname: profile.info?.nickname ?? "—",
    side: profile.info?.side ?? "",
    sideLabel: sideLabel(profile.info?.side ?? ""),
    experience: profile.info?.experience ?? 0,
    level: experienceToLevel(profile.info?.experience ?? 0),
    edition: editionFrom(profile.info?.memberCategory ?? 0, profile.info?.selectedMemberCategory),
    prestige: profile.info?.prestigeLevel ?? 0,
    badges: memberBadges(profile.info?.memberCategory ?? 0),
    totalTimeSeconds,
    raidStats: buildRaidStats(profile),
    skills: skills(profile),
    mastering: mastering(profile),
    achievementsCount: profile.achievements ? Object.keys(profile.achievements).length : 0,
    updatedAt: profile.updated ?? null,
  };
}
