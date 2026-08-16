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
  /** Множитель кармы comlink (репутация сайта весит заметно). Вклад МОЖЕТ БЫТЬ <0 (грифер). */
  karmaComlink: 2,
  /**
   * База кармы companion: очки = round(√karma × this) — §7 спеки «осмысленный вклад».
   * АНКЕР ТЮНИНГА: карма companion микро (per-upload cap 0.01, day-cap 0.05, репутация 1.0 =
   * недели-месяцы реального вклада — companion-gamification.md). При √-нормировке активный
   * «Аналитик рынка» на karma≈1.0 даёт ≈120 очков (уровень среднего под-трека, цель спеки),
   * один день грайнда (karma≈0.05) — уже ≈27 (не 0), а тяжёлый вкладчик (karma≈4) — ≈240
   * (√ гасит доминирование, как arcadeRoot гасит рекордсменов). Точная база тюнится на данных.
   */
  karmaCompanionRoot: 120,
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
  // comlink вычитает: репутация сайта может уходить в минус (грифер теряет ранг). Без max(0,…).
  const comlink = s.karmaComlink != null ? Math.round(s.karmaComlink * WEIGHTS.karmaComlink) : 0;
  // companion: √-нормировка (осмысленный вклад, §7). Карма ≥0 по механике; на всякий — max(0,…).
  const companion = s.karmaCompanion != null
    ? Math.round(Math.sqrt(Math.max(0, s.karmaCompanion)) * WEIGHTS.karmaCompanionRoot)
    : 0;
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

  // floor 0: ранг не ниже НЕОБСТРЕЛЯННЫЙ, но отдельные вклады (comlink) допустимо <0 (§2 спеки).
  const total = Math.max(0, contributions.reduce((sum, c) => sum + c.value, 0));
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

/**
 * Ключи доп-функций досье, открываемых прогрессом и/или подпиской.
 * earned-набор — стартовая карта ранг→power-user из спеки (раздел «Ранг → анлоки»);
 * paid-набор (косметика/слоты «по подписке») оставлен как есть.
 */
export type UnlockableFeature =
  // ─ earned: открываются ТОЛЬКО рангом standing (плата НЕ байпасит) ─
  | 'standing-history' // личный журнал/история standing — ранг 2
  | 'detailed-radar' // детальный радар компетенций — ранг 3
  | 'dossier-slots' // доп-слоты персонализации Досье/главной (заработанные) — ранг 3
  | 'squad-priority' // приоритет в Отряде — ранг 4
  | 'analytics-trends' // расширенная аналитика/тренды — ранг 4
  | 'community-tools' // комьюнити-инструменты (предложить билд в ростер) — ранг 5
  // ─ paid: ранг ИЛИ платный тир (косметика/слоты «по подписке») ─
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
  'dossier-slots': 'earned',
  'squad-priority': 'earned',
  'analytics-trends': 'earned',
  'community-tools': 'earned',
  'home-slots': 'paid',
  'tag-frames': 'paid',
};

/** Минимальный ранг standing для каждой доп-функции (стартовая карта из спеки — тюнится). */
const FEATURE_MIN_RANK: Record<UnlockableFeature, number> = {
  'standing-history': 2,
  'detailed-radar': 3,
  'dossier-slots': 3,
  'squad-priority': 4,
  'analytics-trends': 4,
  'community-tools': 5,
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

// ─── Звания под-треков (§5 спеки «глубина → под-треки») ──────
// «Ширина осваивается заголовком (ранг standing), глубина — под-треками со своими званиями».
// Данные, не JSX (§4.7): будущий UI Досье рисует «специалист горд под-треком». Ключи звания
// совпадают с ключами StandingContribution — панель мэтчит вклад ↔ звание один-в-один.
// XP-тир НЕ дублируем: его звание уже отдаёт getCurrentTier(xp).label (trader-тир) — источник
// правды один, здесь только под-трек-title. Пороги companion/comlink — из механик кармы.

/** Ключ под-трека (совпадает с StandingContribution.key). */
export type SubTrackKey = StandingContribution['key'];

/** Ступень звания внутри под-трека: порог сигнала → подпись. */
export interface SubTrackTitle {
  /** Мин. значение сырого сигнала под-трека для этой ступени. */
  min: number;
  /** Подпись звания (Nightfall-стиль). */
  label: string;
}

/** Мета под-трека: имя дорожки + лестница званий (по возрастанию min). */
export interface SubTrackMeta {
  key: SubTrackKey;
  /** Имя под-трека для заголовка секции. */
  track: string;
  /** Какой сырой сигнал измеряется (для резолва звания). */
  signal: keyof StandingSignals;
  /** Лестница званий; [] — звание берётся извне (XP: getCurrentTier). */
  titles: readonly SubTrackTitle[];
}

/**
 * Конфиг под-трек-званий. Companion получает «Аналитик рынка» (§7 спеки). Comlink-ступени
 * зеркалят карма-тиры Дикий/Боец/Ветеран/Легенда (спека, траст-гейты) — те же пороги, что
 * серверный `can(action, karmaTier)` получит позже. Пороги — стартовые, тюнятся на данных.
 */
export const SUB_TRACKS: Record<SubTrackKey, SubTrackMeta> = {
  xp: { key: 'xp', track: 'Экономика бартера', signal: 'xpTier', titles: [] },
  karmaComlink: {
    key: 'karmaComlink',
    track: 'Репутация Связи',
    signal: 'karmaComlink',
    titles: [
      { min: 0, label: 'ДИКИЙ' },
      { min: 50, label: 'БОЕЦ' },
      { min: 200, label: 'ВЕТЕРАН' },
      { min: 500, label: 'ЛЕГЕНДА' },
    ],
  },
  karmaCompanion: {
    key: 'karmaCompanion',
    track: 'Вклад в данные',
    signal: 'karmaCompanion',
    titles: [
      { min: 0, label: 'НАБЛЮДАТЕЛЬ' },
      { min: 0.05, label: 'ИНФОРМАТОР' },
      { min: 0.5, label: 'АНАЛИТИК РЫНКА' },
      { min: 2, label: 'СМОТРЯЩИЙ РЫНКА' },
    ],
  },
  arcade: {
    key: 'arcade',
    track: 'Полигон',
    signal: 'arcadeBest',
    titles: [
      { min: 0, label: 'СТАЖЁР' },
      { min: 2500, label: 'СТРЕЛОК' },
      { min: 10000, label: 'СНАЙПЕР' },
    ],
  },
  tutorial: {
    key: 'tutorial',
    track: 'Путь Новобранца',
    signal: 'tutorialDone',
    titles: [
      { min: 0, label: 'НОВОБРАНЕЦ' },
      { min: 10, label: 'АДАПТИРОВАН' },
    ],
  },
  achievements: {
    key: 'achievements',
    track: 'Достижения',
    signal: 'achievements',
    titles: [
      { min: 0, label: 'БЕЗ НАГРАД' },
      { min: 5, label: 'ОТМЕЧЕННЫЙ' },
      { min: 20, label: 'ЗАСЛУЖЕННЫЙ' },
    ],
  },
};

/**
 * Звание под-трека по сырому значению сигнала. Для XP (titles: []) — null (звание брать из
 * getCurrentTier(xp).label). null-сигнал кармы → первая ступень (аноним = базовое звание).
 */
export function subTrackTitle(key: SubTrackKey, signalValue: number | null): string | null {
  const meta = SUB_TRACKS[key];
  if (meta.titles.length === 0) return null;
  const v = signalValue ?? 0;
  let current = meta.titles[0];
  for (const t of meta.titles) {
    if (v >= t.min) current = t;
  }
  return current.label;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
