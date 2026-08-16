// Агрегат «боевой эффективности оперативника» — читает уже-анти-фарменные сигналы
// существующих систем (XP-тир, обе кармы, аркада-рекорды, туториал, ачивки) и сводит
// их в единый ранг. Чистая детерминированная функция, БЕЗ собственного накопления и
// сайд-эффектов: накрутить нельзя — каждый сигнал ограничен в своей системе (§2 спеки).
//
// Здесь же живёт доменная логика разблокировок (unlockedBy) — §4.7 «разметка не считает».

/** Сырые сигналы из существующих сторов. Собираются селектором usePlayerStandingSignals. */
export interface StandingSignals {
  /** Тир XP-экономики бартера (1..11), useGamificationStore → getCurrentTier. */
  xpTier: number;
  /** Прогресс внутри текущего тира 0..100. */
  xpProgress: number;
  /** Карма comlink (сумма karma_events). null — аноним/нет данных, сервер не отдал. */
  karmaComlink: number | null;
  /** Карма companion (микро-грайнд OCR-контрибуций). null — аноним/нет данных. */
  karmaCompanion: number | null;
  /** Лучший аркадный результат (сумма bestScore по играм зала), localStorage. */
  arcadeBest: number;
  /** Пройдено этапов «Пути Новобранца», 0..10 (useRookieStore.completed.length). */
  tutorialDone: number;
  /** Число закрытых достижений (useAchievementStore.completedIds.length). */
  achievements: number;
}

/** Одна строка разбивки вкладов для панели Standing. */
export interface StandingContribution {
  key: string;
  label: string;
  /** Вклад в total (уже взвешенный, целые очки). */
  value: number;
}

/** Итог агрегата: ранг + разбивка. */
export interface PlayerStanding {
  /** Суммарные очки боевой эффективности. */
  total: number;
  /** Ранг 1..N по лестнице STANDING_RANKS. */
  rank: number;
  /** Подпись текущего ранга («боевая эффективность»). */
  tierLabel: string;
  /** Разбивка вкладов (для data-readout панели). Все ключи присутствуют всегда. */
  contributions: StandingContribution[];
}

// ─── Веса вкладов ────────────────────────────────────────────
// Подобраны так, чтобы «дешёвые» сигналы (туториал) давали ощутимый старт, а «дорогие»
// (XP-тир, карма-ветеран) уходили в потолок только у вложившихся. Значения — очки standing.
const WEIGHTS = {
  /** За каждый тир XP сверх первого. */
  xpTierStep: 40,
  /** Доля очков за прогресс внутри тира (0..100 → 0..this). */
  xpProgressMax: 20,
  /** Множитель кармы comlink (репутация сайта весит заметно). */
  karmaComlink: 2,
  /** Множитель кармы companion (микро-грайнд — мелкий вклад). */
  karmaCompanion: 0.5,
  /** Аркада: очки за корень из лучшего счёта (сглаживаем рекордсменов). */
  arcadeRoot: 1.2,
  /** За каждый пройденный этап туториала. */
  tutorialStep: 12,
  /** За каждое достижение. */
  achievement: 8,
} as const;

/** Лестница рангов боевой эффективности (пороги в очках standing). */
export const STANDING_RANKS: readonly { rank: number; label: string; min: number }[] = [
  { rank: 1, label: 'НЕОБСТРЕЛЯННЫЙ', min: 0 },
  { rank: 2, label: 'ОПЕРАТИВНИК', min: 60 },
  { rank: 3, label: 'ЗАКАЛЁННЫЙ', min: 180 },
  { rank: 4, label: 'ВЕТЕРАН ЗОНЫ', min: 380 },
  { rank: 5, label: 'ЭЛИТА ЧВК', min: 700 },
  { rank: 6, label: 'ЛЕГЕНДА', min: 1200 },
] as const;

function rankFor(total: number): { rank: number; label: string } {
  let current = STANDING_RANKS[0];
  for (const r of STANDING_RANKS) {
    if (total >= r.min) current = r;
  }
  return { rank: current.rank, label: current.label };
}

/**
 * Свести сигналы в ранг + разбивку. Чистая, детерминированная: одинаковый вход → одинаковый
 * выход, без Date/random/I/O. Отсутствующий сигнал (карма null) = вклад 0 с пометкой в label.
 */
export function computeStanding(s: StandingSignals): PlayerStanding {
  const xp = Math.max(0, s.xpTier - 1) * WEIGHTS.xpTierStep
    + Math.round((clamp01(s.xpProgress / 100)) * WEIGHTS.xpProgressMax);
  const comlink = s.karmaComlink != null ? Math.round(Math.max(0, s.karmaComlink) * WEIGHTS.karmaComlink) : 0;
  const companion = s.karmaCompanion != null ? Math.round(Math.max(0, s.karmaCompanion) * WEIGHTS.karmaCompanion) : 0;
  const arcade = Math.round(Math.sqrt(Math.max(0, s.arcadeBest)) * WEIGHTS.arcadeRoot);
  const tutorial = clamp(s.tutorialDone, 0, 10) * WEIGHTS.tutorialStep;
  const achievements = Math.max(0, s.achievements) * WEIGHTS.achievement;

  const contributions: StandingContribution[] = [
    { key: 'xp', label: 'XP-тир', value: xp },
    { key: 'karmaComlink', label: s.karmaComlink != null ? 'Карма (Связь)' : 'Карма (Связь) — войди', value: comlink },
    { key: 'karmaCompanion', label: s.karmaCompanion != null ? 'Карма (Компаньон)' : 'Карма (Компаньон) — войди', value: companion },
    { key: 'arcade', label: 'Аркада', value: arcade },
    { key: 'tutorial', label: 'Путь Новобранца', value: tutorial },
    { key: 'achievements', label: 'Достижения', value: achievements },
  ];

  const total = contributions.reduce((sum, c) => sum + c.value, 0);
  const { rank, label } = rankFor(total);

  return { total, rank, tierLabel: label, contributions };
}

/** Следующий ранг сверх текущего total (для «до следующего ранга»), null на максималке. */
export function nextStandingRank(total: number): { rank: number; label: string; min: number } | null {
  return STANDING_RANKS.find((r) => r.min > total) ?? null;
}

// ─── Разблокировки (R08) ─────────────────────────────────────
// ⚠️ КЛИЕНТСКАЯ ВИТРИНА, НЕ security-граница. Отдаёт «что показать/открыть в UI» по очкам
// и тиру подписки. Настоящий enforce платных/tamper-proof фич — серверным слоем позже
// (deferred, §5 спеки: упирается в серверное хранилище очков). Здесь только показ.

/** Тир подписки, как в auth/subscription (клиентская проекция). */
export type AccessTier = 'free' | 'operative' | 'veteran';

/** Ключи доп-функций досье, открываемых прогрессом и/или подпиской. */
export type UnlockableFeature =
  | 'standing-history' // вкладка истории standing — ЗАРАБОТАННАЯ прогрессом
  | 'detailed-radar' // детальный радар компетенций — ЗАРАБОТАННАЯ прогрессом
  | 'home-slots' // доп-слоты персонализации главной — платная/косметика
  | 'tag-frames'; // рамки/темы жетона — платная/косметика

/**
 * Природа фичи (R08, §4 спеки + interfaces.md):
 *  - 'earned' — открывается ТОЛЬКО прогрессом (standing.rank), плата НЕ байпасит. Иначе R08
 *    сужается до «плати ИЛИ гриндь» — заработанные фичи должны быть заработаны.
 *  - 'paid' — платный тир может снять ранг-требование (косметика/слоты «по подписке».
 */
const FEATURE_KIND: Record<UnlockableFeature, 'earned' | 'paid'> = {
  'standing-history': 'earned',
  'detailed-radar': 'earned',
  'home-slots': 'paid',
  'tag-frames': 'paid',
};

/** Минимальный ранг standing для каждой доп-функции. */
const FEATURE_MIN_RANK: Record<UnlockableFeature, number> = {
  'standing-history': 2,
  'detailed-radar': 3,
  'home-slots': 4,
  'tag-frames': 2,
};

/**
 * Открыта ли доп-функция при данном standing и тире подписки.
 * ⚠️ Клиентская витрина, не security: определяет ВИДимость/доступ в UI, не право на платное.
 * ЗАРАБОТАННЫЕ ('earned') фичи гейтятся ТОЛЬКО рангом — платный тир их НЕ байпасит (R08:
 * открываются прогрессом, не платой). Платный/тир-байпас — лишь для 'paid' (косметика/слоты).
 */
export function unlockedBy(
  standing: Pick<PlayerStanding, 'rank'>,
  tier: AccessTier,
  feature: UnlockableFeature,
): boolean {
  const byRank = standing.rank >= FEATURE_MIN_RANK[feature];
  if (FEATURE_KIND[feature] === 'earned') return byRank;
  // 'paid': платный тир снимает ранг-требование (витрина «доступно по подписке»).
  const paid = tier === 'operative' || tier === 'veteran';
  return byRank || paid;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
