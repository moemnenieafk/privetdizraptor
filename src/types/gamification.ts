export type BadgeId = 'wholesaler' | 'speculator' | 'lighthouse-master';

export interface BadgeState {
  id: BadgeId;
  label: string;
  description: string;
  unlockedAt: number | null;
}

export interface TraderTier {
  level: number;
  label: string;
  xpRequired: number;
}

export const BADGE_DEFINITIONS: Omit<BadgeState, 'unlockedAt'>[] = [
  { id: 'wholesaler', label: 'Оптовик', description: 'Зафиксировал бартер с 5+ компонентами' },
  { id: 'speculator', label: 'Спекулянт', description: 'ROI превысил 200% по бартерной сделке' },
  { id: 'lighthouse-master', label: 'Мастер Маяка', description: 'Выполнил все бартеры Смотрителя' },
];

// ─── Торговый путь: возрастающая прогрессия к 500M → 1B → 2B+ ──
// XP = накопленная прибыль в рублях. Лестница растёт геометрически.
export const TRADER_TIERS: TraderTier[] = [
  { level: 1, label: 'НОВОБРАНЕЦ', xpRequired: 0 },
  { level: 2, label: 'БАРЫГА', xpRequired: 100_000 },
  { level: 3, label: 'ТОРГОВЕЦ', xpRequired: 500_000 },
  { level: 4, label: 'СНАБЖЕНЕЦ', xpRequired: 2_000_000 },
  { level: 5, label: 'ДЕЛЕЦ', xpRequired: 10_000_000 },
  { level: 6, label: 'КОММЕРСАНТ', xpRequired: 50_000_000 },
  { level: 7, label: 'МАГНАТ', xpRequired: 100_000_000 },
  { level: 8, label: 'ОЛИГАРХ', xpRequired: 250_000_000 },
  { level: 9, label: 'БАРОН', xpRequired: 500_000_000 },
  { level: 10, label: 'КАРТЕЛЬ', xpRequired: 1_000_000_000 },
  { level: 11, label: 'ТЕНЕВОЙ БАНКИР', xpRequired: 2_000_000_000 },
];

const LAST_TIER = TRADER_TIERS[TRADER_TIERS.length - 1];

export function getCurrentTier(xp: number): TraderTier {
  let current = TRADER_TIERS[0];
  for (const tier of TRADER_TIERS) {
    if (xp >= tier.xpRequired) current = tier;
  }
  return current;
}

export function getNextTier(xp: number): TraderTier | null {
  return TRADER_TIERS.find((t) => t.xpRequired > xp) ?? null;
}

/** Прогресс 0..100 внутри текущего тира (или 100 на максималке). */
export function getTierProgress(xp: number): number {
  const current = getCurrentTier(xp);
  const next = getNextTier(xp);
  if (!next) return 100;
  return Math.min(
    100,
    ((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100,
  );
}

export interface RankInfo {
  tier: TraderTier;
  /** Звёзды престижа за каждым удвоением сверх последнего тира (0 до максималки). */
  prestige: number;
  /** Полный лейбл с престижем, напр. «ТЕНЕВОЙ БАНКИР ✦✦». */
  label: string;
}

/** Бесконечный «хвост»: за последним тиром каждое удвоение XP добавляет звезду престижа. */
export function getRankInfo(xp: number): RankInfo {
  const tier = getCurrentTier(xp);
  if (xp < LAST_TIER.xpRequired) {
    return { tier, prestige: 0, label: tier.label };
  }
  const prestige = Math.floor(Math.log2(xp / LAST_TIER.xpRequired));
  const stars = prestige > 0 ? ` ${'✦'.repeat(Math.min(prestige, 5))}` : '';
  return { tier, prestige, label: `${tier.label}${stars}` };
}

// ─── Горизонт: ближайшая мега-веха фантазии ──────────────────
const NAMED_MILESTONES: { value: number; label: string }[] = [
  { value: 500_000_000, label: 'ПОЛМИЛЛИАРДА' },
  { value: 1_000_000_000, label: 'МИЛЛИАРД' },
  { value: 2_000_000_000, label: 'ДВА МИЛЛИАРДА' },
];

export interface Horizon {
  target: number;
  label: string;
  /** Прогресс к этой вехе от предыдущей, 0..100. */
  pct: number;
}

/** Ближайшая мега-веха выше текущего XP (после 2B — удваивается бесконечно). */
export function getHorizon(xp: number): Horizon {
  let prev = 0;
  for (const m of NAMED_MILESTONES) {
    if (xp < m.value) {
      const pct = Math.min(100, ((xp - prev) / (m.value - prev)) * 100);
      return { target: m.value, label: m.label, pct };
    }
    prev = m.value;
  }
  // За пределами именованных вех — удваиваем (5B, 10B, …)
  let target = NAMED_MILESTONES[NAMED_MILESTONES.length - 1].value;
  let lower = target;
  while (xp >= target) {
    lower = target;
    target *= 2;
  }
  const pct = Math.min(100, ((xp - lower) / (target - lower)) * 100);
  return { target, label: `${target / 1_000_000_000} МЛРД`, pct };
}

/** Дневная цель прибыли, масштабируется от темпа прокачки текущего тира. */
export function getDailyGoal(xp: number): number {
  const current = getCurrentTier(xp);
  const next = getNextTier(xp);
  if (!next) return 50_000_000;
  const gap = next.xpRequired - current.xpRequired;
  return Math.max(50_000, Math.round(gap / 20));
}

// ─── PRO Meta-Progress ──────────────────────────────────

export interface ProChallenge {
  id: string;
  label: string;
  description: string;
}

export const PRO_CHALLENGES: ProChallenge[] = [
  { id: 'first-deal',   label: 'Первая сделка',  description: 'Зафиксировать первый бартер' },
  { id: 'wholesaler',   label: 'Оптовик',         description: 'Бартер с 5+ компонентами' },
  { id: 'speculator',   label: 'Спекулянт',       description: 'ROI > 200% по сделке' },
  { id: 'profit-100k',  label: 'Сотня тысяч',     description: 'Набрать 100 000 XP' },
  { id: 'profit-1m',    label: 'Миллион',          description: 'Набрать 1 000 000 XP' },
  { id: 'lighthouse',   label: 'Мастер Маяка',    description: 'Все бартеры Смотрителя' },
];

export const PRO_UNLOCK_AT = 4;

export function computeProStatus(
  xp: number,
  confirmedBarterIds: string[],
  badges: BadgeState[],
): { challenges: (ProChallenge & { completed: boolean })[]; completedCount: number; isUnlocked: boolean } {
  const badgeUnlocked = (id: BadgeId) =>
    badges.find((b) => b.id === id)?.unlockedAt !== null;

  const challenges = PRO_CHALLENGES.map((c) => {
    let completed = false;
    if (c.id === 'first-deal')  completed = confirmedBarterIds.length >= 1;
    if (c.id === 'wholesaler')  completed = badgeUnlocked('wholesaler');
    if (c.id === 'speculator')  completed = badgeUnlocked('speculator');
    if (c.id === 'profit-100k') completed = xp >= 100_000;
    if (c.id === 'profit-1m')   completed = xp >= 1_000_000;
    if (c.id === 'lighthouse')  completed = badgeUnlocked('lighthouse-master');
    return { ...c, completed };
  });

  const completedCount = challenges.filter((c) => c.completed).length;
  return { challenges, completedCount, isUnlocked: completedCount >= PRO_UNLOCK_AT };
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatRemainingChallenges(n: number): string {
  return `${n} ${pluralRu(n, 'челлендж', 'челленджа', 'челленджей')} до PRO`;
}
