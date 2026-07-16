// Движок роли «Ульты» (см. docs/decisions/adaptive-hub-ulta.md).
// Чистая детерминированная функция: (факты профиля + поведение) → роль + оси стиля.
// Без ML, без сайд-эффектов — правила прозрачны и объяснимы (reasons[]).

/** Роль игрока — дискриминированный юнион, никаких магических строк. */
export type PlayerRole =
  | 'rookie' // Новобранец
  | 'progressor' // Прогрессор (квестер)
  | 'trader' // Барыга (эконом)
  | 'gunsmith' // Оружейник (билдер)
  | 'engineer' // Инженер базы (хидаут)
  | 'raider' // Рейдер-хантер
  | 'viewer' // Зритель контента
  | 'rat' // Крыса (тихий соло-лутер/кемпер)
  | 'sherpa' // Шерп (наставник)
  | 'lore'; // Лорник (фанат вселенной)

export const PLAYER_ROLES: readonly PlayerRole[] = [
  'rookie',
  'progressor',
  'trader',
  'gunsmith',
  'engineer',
  'raider',
  'viewer',
  'rat',
  'sherpa',
  'lore',
] as const;

/** Русские подписи и текст адаптивной кнопки «Ульты». */
export const ROLE_LABELS: Record<PlayerRole, { name: string; button: string }> = {
  rookie: { name: 'Новобранец', button: 'Я новичок' },
  progressor: { name: 'Прогрессор', button: 'Я по квестам' },
  trader: { name: 'Барыга', button: 'Я барыга' },
  gunsmith: { name: 'Оружейник', button: 'Я оружейник' },
  engineer: { name: 'Инженер базы', button: 'Я строю базу' },
  raider: { name: 'Рейдер', button: 'Я бывалый' },
  viewer: { name: 'Зритель', button: 'Я за контентом' },
  rat: { name: 'Крыса', button: 'Я крыса' },
  sherpa: { name: 'Шерп', button: 'Я шерп' },
  lore: { name: 'Лорник', button: 'Я лорник' },
};

/** Стадия прогресса — грубый детерминированный слой по фактам профиля. */
export type PlayerStage = 'timmy' | 'mid' | 'endgame';

/** Поведенческие домены — что человек трогает на портале (источник: телеметрия). */
export type BehaviorDomain =
  | 'barters'
  | 'prices'
  | 'loadouts'
  | 'gunsmith'
  | 'quests'
  | 'questmap'
  | 'needed'
  | 'bosses'
  | 'maps'
  | 'loot'
  | 'videos'
  | 'codex'
  | 'rookie'
  | 'hideout'
  | 'comlink'
  | 'lore';

/** Счётчики визитов по доменам (уже с затуханием на стороне агрегатора). */
export type BehaviorSignals = Partial<Record<BehaviorDomain, number>>;

/** Оси стиля игры («психопрофиль» — про стиль, не про личность). Значения −1…+1. */
export interface RoleAxes {
  /** −1 осторожный … +1 агрессивный */
  cautionAggression: number;
  /** −1 эконом … +1 боевой */
  economyCombat: number;
  /** −1 спидран … +1 коллекционер */
  sprintCollect: number;
  /** −1 соло … +1 сокланы */
  soloClan: number;
}

/** Детерминированные факты профиля (из usePlayerStore / OCR). */
export interface ProfileFacts {
  hoursPlayed: number | null;
  level: number | null;
  prestige: number | null;
  mode: 'PVP' | 'PVE' | null;
  /** Средний уровень торговцев 0–4 (сигнал прогресса), null — неизвестно. */
  traderLevelAvg: number | null;
}

/** Результат инференса. */
export interface RoleInference {
  primary: PlayerRole;
  secondary: PlayerRole | null;
  /** 0…1 — насколько система уверена (мало данных → низкая). */
  confidence: number;
  stage: PlayerStage;
  axes: RoleAxes;
  /** Человекочитаемые причины — для прозрачности в UI. */
  reasons: string[];
}

/** Вклад одного домена поведения в роли (может бить в несколько). */
const DOMAIN_TO_ROLES: Record<BehaviorDomain, PlayerRole[]> = {
  barters: ['trader'],
  prices: ['trader', 'rat'],
  loadouts: ['gunsmith'],
  gunsmith: ['gunsmith'],
  quests: ['progressor'],
  questmap: ['progressor'],
  needed: ['progressor', 'engineer'],
  bosses: ['raider'],
  maps: ['raider', 'rat'],
  loot: ['raider', 'trader', 'rat'],
  videos: ['viewer'],
  codex: ['rookie'],
  rookie: ['rookie'],
  hideout: ['engineer'],
  comlink: ['sherpa'],
  lore: ['lore'],
};

function emptyScores(): Record<PlayerRole, number> {
  return { rookie: 0, progressor: 0, trader: 0, gunsmith: 0, engineer: 0, raider: 0, viewer: 0, rat: 0, sherpa: 0, lore: 0 };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Стадия по фактам. Нет фактов → 'mid' (нейтрально), уверенность добирается отдельно. */
export function inferStage(facts: ProfileFacts): PlayerStage {
  if ((facts.prestige ?? 0) > 0) return 'endgame';
  const lvl = facts.level;
  const hrs = facts.hoursPlayed;
  if (lvl !== null) {
    if (lvl <= 15) return 'timmy';
    if (lvl >= 42) return 'endgame';
    return 'mid';
  }
  if (hrs !== null) {
    if (hrs < 50) return 'timmy';
    if (hrs > 500) return 'endgame';
    return 'mid';
  }
  return 'mid';
}

function inferAxes(signals: BehaviorSignals, facts: ProfileFacts): RoleAxes {
  const g = (d: BehaviorDomain): number => signals[d] ?? 0;
  const total = Object.values(signals).reduce((a, b) => a + (b ?? 0), 0) || 1;

  // Осторожный↔агрессивный: PVE и хидаут/квесты тянут к осторожности; боссы/карты — к агрессии.
  const aggression = (g('bosses') + g('maps') + g('gunsmith')) / total;
  const caution = (g('hideout') + g('quests') + g('needed')) / total + (facts.mode === 'PVE' ? 0.3 : 0);
  // Эконом↔боевой: бартеры/цены vs билды/боссы.
  const economy = (g('barters') + g('prices') + g('loot')) / total;
  const combat = (g('loadouts') + g('gunsmith') + g('bosses')) / total;
  // Спидран↔коллекционер: квест-фокус vs needed/лут (складирование).
  const sprint = (g('quests') + g('questmap')) / total;
  const collect = (g('needed') + g('loot') + g('hideout')) / total;
  // Соло↔сокланы: пока только видео как слабый прокси «смотрит комьюнити».
  const clan = (g('videos') + g('comlink')) / total;

  return {
    cautionAggression: clamp(aggression - caution, -1, 1),
    economyCombat: clamp(combat - economy, -1, 1),
    sprintCollect: clamp(collect - sprint, -1, 1),
    soloClan: clamp(clan * 2 - 0.2, -1, 1),
  };
}

/**
 * Главная функция: считает роль из фактов профиля и поведения.
 * @param facts   детерминированные факты (могут быть null — тогда решает поведение)
 * @param signals счётчики визитов по доменам (с затуханием), могут быть пустыми
 */
export function computeRole(facts: ProfileFacts, signals: BehaviorSignals = {}): RoleInference {
  const stage = inferStage(facts);
  const reasons: string[] = [];
  const scores = emptyScores();

  // 1. Вклад поведения.
  let behaviorVolume = 0;
  (Object.keys(signals) as BehaviorDomain[]).forEach((domain) => {
    const weight = signals[domain] ?? 0;
    if (weight <= 0) return;
    behaviorVolume += weight;
    for (const role of DOMAIN_TO_ROLES[domain]) {
      scores[role] += weight;
    }
  });

  // 2. Новичок-байас: Timmy без выраженного поведения → онбординг.
  if (stage === 'timmy') {
    scores.rookie += behaviorVolume === 0 ? 3 : 1;
    reasons.push(
      facts.level !== null ? `низкий уровень (${facts.level})` : 'мало часов в игре',
    );
  }
  // 3. Эндгейм слегка усиливает «боевые» роли (у ветерана редко профиль новичка).
  if (stage === 'endgame') {
    scores.raider += 0.5;
    scores.gunsmith += 0.5;
    reasons.push(facts.prestige && facts.prestige > 0 ? `престиж ${facts.prestige}` : 'высокий прогресс');
  }

  // 4. Ранжирование.
  const ranked = (Object.entries(scores) as [PlayerRole, number][])
    .sort((a, b) => b[1] - a[1]);
  const [primary, primaryScore] = ranked[0];
  const [secondary, secondaryScore] = ranked[1];

  // 5. Уверенность: объём поведения + наличие фактов + отрыв лидера.
  const hasFacts = facts.level !== null || facts.hoursPlayed !== null || facts.prestige !== null;
  const volumeConf = clamp(behaviorVolume / 20, 0, 0.6); // до 0.6 от объёма кликов
  const gapConf = primaryScore > 0 ? clamp((primaryScore - secondaryScore) / (primaryScore + 1), 0, 0.3) : 0;
  const factConf = hasFacts ? 0.1 : 0;
  const confidence = clamp(volumeConf + gapConf + factConf, 0, 1);

  // Пояснения к поведению-лидеру.
  const topDomain = (Object.keys(signals) as BehaviorDomain[])
    .filter((d) => (signals[d] ?? 0) > 0)
    .sort((a, b) => (signals[b] ?? 0) - (signals[a] ?? 0))[0];
  if (topDomain) reasons.push(`чаще всего смотришь: ${topDomain}`);

  return {
    primary,
    secondary: secondaryScore > 0 && secondary !== primary ? secondary : null,
    confidence,
    stage,
    axes: inferAxes(signals, facts),
    reasons,
  };
}

/** Средний уровень торговцев из карты уровней (хелпер для сборки ProfileFacts). */
export function traderLevelAvg(levels: Record<string, number>): number | null {
  const vals = Object.values(levels);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
