// Сезоны EFT (раздел «Прогресс» → «Сезоны»).
//
// МЕХАНИКА (Season 1 «Kord Breach», патч 1.1.0):
//   • Сезонный персонаж — ОТДЕЛЬНЫЙ и добровольный: уровень 1, пустой схрон, только PvP.
//     Основной профиль (стаж, схрон, убежище, Каппа) не трогается вообще.
//   • Сезонные модификаторы навязаны всем — их не выбирают.
//   • Личные модификаторы — БЮДЖЕТ: старт 0 очков, негативные ДАЮТ очки, позитивные ТРАТЯТ.
//     Баланс обязан остаться ≥ 0. Хочешь Каппу (−12) — набери +12 болью.
//
// ✔ Цифры и формулировки сверены с релизом 1.1.0.0 (экран «Личные модификаторы» в игре).
// Иконки: SVG-ассеты сезона 1 (отрисованы V4DYA) — монохром, красятся в UI CSS-маской
// по типу перка (баф → зелёный, дебаф → красный, сезонный/глобальный → lightkeeper).
// Имена файлов не равны id — маппинг ниже (S1_PERK_ICON).

export type PerkKind = 'season' | 'positive' | 'negative';

export interface SeasonPerk {
  id: string;
  name: string;
  /** Очки: позитивные тратят (< 0), негативные дают (> 0), сезонные — 0. */
  cost: number;
  kind: PerkKind;
  /** Эффекты списком — так их читает и игрок, и карточка. */
  effects: string[];
  /** Путь к монохромному SVG перка; в UI красится CSS-маской по kind. */
  iconUrl?: string;
  /**
   * Перки с ВЗАИМНО ГАСЯЩИМИ эффектами (наша логика, не запрет BSG): брать оба
   * бессмысленно — «−25% кровотечения» и «+25% кровотечения» просто вычитаются,
   * а очки тратятся впустую. Конструктор такие пары блокирует и объясняет почему.
   */
  excludes?: string[];
}

export interface Season {
  id: string;
  /** URL-сегмент: /eft/progress/seasons/{slug}. */
  slug: string;
  number: number;
  name: string;
  patch: string;
  /** Цветной SVG-логотип сезона (вордмарк). Рендерится как <img>, не маска. */
  logoUrl?: string;
  /** Стартовое событие сезона. */
  kickoffEvent?: string;
  /** ISO-дата старта. null — BSG объявила окно, но не день. */
  startAt: string | null;
  /** Заявленная минимальная длительность. */
  minDays: number;
  status: 'announced' | 'live' | 'ended';
  summary: string[];
  perks: SeasonPerk[];
}

const KORD_BREACH_PERKS: SeasonPerk[] = [
  /* ── Сезонные: действуют на всех, выбора нет ────────────────────── */
  {
    id: 'no-insurance',
    name: 'Неработающая страховка',
    cost: 0,
    kind: 'season',
    effects: ['Страховать снаряжение перед рейдом нельзя — потерянное не вернётся.'],
  },
  {
    id: 'black-division',
    name: 'Black Division',
    cost: 0,
    kind: 'season',
    effects: ['Бойцы «Чёрной дивизии» встречаются на большем числе локаций, чем в основной игре.'],
  },
  {
    id: 'no-fir-hideout',
    name: 'Убежище без FIR',
    cost: 0,
    kind: 'season',
    effects: ['Модулям убежища не нужен статус «Найдено в рейде».'],
  },
  {
    id: 'armor-shortage',
    name: 'Дефицит брони',
    cost: 0,
    kind: 'season',
    effects: ['У торговцев резко меньше брони в ассортименте.'],
  },
  {
    id: 'handyman',
    name: 'На все руки мастер',
    cost: 0,
    kind: 'season',
    effects: ['Время крафта предметов вдвое меньше.', 'Навык «Крафт» стартует с 51 уровня.'],
  },
  {
    id: 'seasoned-pmcs',
    name: 'Опытные ЧВК',
    cost: 0,
    kind: 'season',
    effects: ['Персонаж получает на 25% больше опыта за рейд.'],
  },

  /* ── Позитивные: тратят очки (по возрастанию цены) ──────────────── */
  {
    id: 'street-tax',
    name: 'Бизнесмен',
    cost: -1,
    kind: 'positive',
    effects: ['Раз в неделю часть Диких отстёгивает вам за «крышу».'],
  },
  {
    id: 'lucky',
    name: 'Везучий',
    cost: -1,
    kind: 'positive',
    effects: ['Fortes fortuna adiuvat.'],
    excludes: ['unlucky'],
  },
  {
    id: 'diet',
    name: 'Диета',
    cost: -2,
    kind: 'positive',
    effects: ['Вся провизия расходуется вдвое экономнее.'],
  },
  {
    id: 'juice-time',
    name: 'Juice Time',
    cost: -2,
    kind: 'positive',
    effects: ['Выпитый сок даёт эффект обезболивающего на 60 секунд.'],
  },
  {
    id: 'sailors-nostalgia',
    name: 'Ностальгия моряка',
    cost: -2,
    kind: 'positive',
    effects: ['Консервированная рыба даёт регенерацию здоровья (+2) на 30 секунд.'],
  },
  {
    id: 'thrombophilia',
    name: 'Тромбофилия',
    cost: -2,
    kind: 'positive',
    effects: ['Шанс кровотечения ниже на 25%.'],
    excludes: ['hemophilia'],
  },
  {
    id: 'hypodipsia',
    name: 'Гиподипсия',
    cost: -2,
    kind: 'positive',
    effects: ['Гидратация расходуется на 20% медленнее.'],
    excludes: ['polydipsia'],
  },
  {
    id: 'polyphagia',
    name: 'Полифагия',
    cost: -2,
    kind: 'positive',
    effects: ['Энергия расходуется на 20% медленнее.'],
    excludes: ['chronic-fatigue'],
  },
  {
    id: 'tarkov-shooter',
    name: 'Тарковский стрелок',
    cost: -2,
    kind: 'positive',
    effects: [
      'Навык «Болтовые винтовки» качается вдвое быстрее.',
      'Навык стартует с 25 уровня.',
    ],
  },
  {
    id: 'sprinter',
    name: 'Спринтер',
    cost: -3,
    kind: 'positive',
    effects: ['Скорость бега выше на 5%.'],
  },
  {
    id: 'marathon-runner',
    name: 'Марафонец',
    cost: -3,
    kind: 'positive',
    effects: ['Выносливость рук и ног тратится на 20% медленнее.'],
    excludes: ['exhaustion'],
  },
  {
    id: 'sturdy-bones',
    name: 'Крепкие кости',
    cost: -3,
    kind: 'positive',
    effects: ['Шанс перелома ниже на 25%.', 'Урон от падения меньше на 20%.'],
    excludes: ['osteoporosis'],
  },
  {
    id: 'youth',
    name: 'Молодость',
    cost: -5,
    kind: 'positive',
    effects: ['Энергия расходуется на 20% медленнее.', 'Выносливость рук и ног выше на 10.'],
    excludes: ['exhaustion', 'chronic-fatigue'],
  },
  {
    id: 'hercules',
    name: 'Геркулес',
    cost: -5,
    kind: 'positive',
    effects: ['Навыки «Сила» и «Выносливость» стартуют с 15 уровня.'],
  },
  {
    id: 'wunderkind',
    name: 'Вундеркинд',
    cost: -5,
    kind: 'positive',
    effects: ['Опыт умений начисляется на 30% быстрее.'],
    excludes: ['incompetent', 'average'],
  },
  {
    id: 'bushborne',
    name: 'Кусторождённый',
    cost: -5,
    kind: 'positive',
    effects: ['Задевание веток, травы и кустов на 75% тише и меньше замедляет.'],
  },
  {
    id: 'safecracker',
    name: 'Медвежатник',
    cost: -5,
    kind: 'positive',
    effects: ['Механические ключи с шансом 25% не тратят прочность (карты-ключи не в счёт).'],
  },
  {
    id: 'average',
    name: 'Середнячок',
    cost: -12,
    kind: 'positive',
    effects: [
      'Все навыки сразу на 25 уровне, но дальше не растут (кроме «Крафта»).',
    ],
    excludes: ['incompetent', 'wunderkind'],
  },
  {
    id: 'kappa-protocol',
    name: 'Kappa Protocol',
    cost: -12,
    kind: 'positive',
    effects: ['Разгрузочный контейнер «Каппа» выдаётся сразу.'],
  },

  /* ── Негативные: дают очки (по возрастанию награды) ─────────────── */
  {
    id: 'dr-jekyll',
    name: 'Доктор Джекил',
    cost: 1,
    kind: 'negative',
    effects: ['Статус «Свежая рана» не снимается до конца рейда.'],
  },
  {
    id: 'third-leg',
    name: 'Третья нога',
    cost: 1,
    kind: 'negative',
    effects: ['Скорость передвижения ниже на 1%.', 'Покупки у Терапевта дешевле на 5%.'],
  },
  {
    id: 'unlucky',
    name: 'Невезучий',
    cost: 1,
    kind: 'negative',
    effects: ['Ваше невезение иногда оборачивается плачевными последствиями.'],
    excludes: ['lucky'],
  },
  {
    id: 'polydipsia',
    name: 'Полидипсия',
    cost: 2,
    kind: 'negative',
    effects: ['Гидратация расходуется на 15% быстрее.'],
    excludes: ['hypodipsia'],
  },
  {
    id: 'chronic-fatigue',
    name: 'Синдром хронической усталости',
    cost: 2,
    kind: 'negative',
    effects: ['Энергия расходуется на 20% быстрее.'],
    excludes: ['polyphagia', 'youth'],
  },
  {
    id: 'hemophilia',
    name: 'Гемофилия',
    cost: 2,
    kind: 'negative',
    effects: ['Шанс кровотечения выше на 25%.'],
    excludes: ['thrombophilia'],
  },
  {
    id: 'well-that-hurt',
    name: 'Ай, болит!',
    cost: 2,
    kind: 'negative',
    effects: ['Аптечки тратят на 25% больше ресурса за использование.'],
  },
  {
    id: 'personality-vacuum',
    name: 'Карлик нос',
    cost: 2,
    kind: 'negative',
    effects: ['Навык «Харизма» не растёт.', 'Товары торговцев дороже на 20%.'],
  },
  {
    id: 'osteoporosis',
    name: 'Остеопороз',
    cost: 3,
    kind: 'negative',
    effects: ['Шанс перелома выше на 25%.', 'Урон от падения больше на 20%.'],
    excludes: ['sturdy-bones'],
  },
  {
    id: 'allergic',
    name: 'Аллергик',
    cost: 3,
    kind: 'negative',
    effects: ['Аллергия на 3 случайных предмета из провизии или медикаментов.'],
  },
  {
    id: 'exhaustion',
    name: 'Истощение',
    cost: 5,
    kind: 'negative',
    effects: [
      'Выносливость рук и ног восстанавливается на 20% медленнее.',
      'Запас выносливости меньше на 10.',
    ],
    excludes: ['marathon-runner', 'youth'],
  },
  {
    id: 'broken-secure-container',
    name: 'Сломанный защищённый контейнер',
    cost: 6,
    kind: 'negative',
    effects: [
      'В разгрузочный контейнер влезают только деньги, ключи, жетоны, спецснаряжение, часть контейнеров и документы Боевого пропуска.',
    ],
  },
  {
    id: 'incompetent',
    name: 'Необучаемый',
    cost: 10,
    kind: 'negative',
    effects: [
      'Все навыки качаются на 25% медленнее (кроме «Болтовых винтовок»).',
      'Навыки не поднимаются выше 30 уровня (кроме «Крафта»).',
    ],
    excludes: ['average', 'wunderkind'],
  },
  {
    id: 'no-flea-market',
    name: 'Неработающая барахолка',
    cost: 10,
    kind: 'negative',
    effects: ['Торговля с игроками на барахолке недоступна.'],
  },
];

// SVG-иконки перков сезона 1. Имена файлов заданы дизайнером и не совпадают с id,
// поэтому маппинг явный. Монохром → красятся CSS-маской по kind в UI.
// ⚠ Файл вундеркинда назван personal-buff-vunderkind.svg (через «v») — маппинг это учитывает.
const S1_ICON_DIR = '/icons/eft/04-progression/seasons/season01/perks';
const S1_PERK_ICON: Record<string, string> = {
  /* Позитивные (buffs) */
  'street-tax': `${S1_ICON_DIR}/buffs/personal-buff-businessman.svg`,
  diet: `${S1_ICON_DIR}/buffs/personal-buff-diet.svg`,
  'juice-time': `${S1_ICON_DIR}/buffs/personal-buff-juice-time.svg`,
  'sailors-nostalgia': `${S1_ICON_DIR}/buffs/personal-buff-sailors-nostalgia.svg`,
  sprinter: `${S1_ICON_DIR}/buffs/personal-buff-sprinter.svg`,
  thrombophilia: `${S1_ICON_DIR}/buffs/personal-buff-thrombophilia.svg`,
  hypodipsia: `${S1_ICON_DIR}/buffs/personal-buff-hypodipsia.svg`,
  polyphagia: `${S1_ICON_DIR}/buffs/personal-buff-polyphagia.svg`,
  'marathon-runner': `${S1_ICON_DIR}/buffs/personal-buff-marathoner.svg`,
  youth: `${S1_ICON_DIR}/buffs/personal-buff-youth.svg`,
  'tarkov-shooter': `${S1_ICON_DIR}/buffs/personal-buff-tarkov-shooter.svg`,
  hercules: `${S1_ICON_DIR}/buffs/personal-buff-hercules.svg`,
  'sturdy-bones': `${S1_ICON_DIR}/buffs/personal-buff-strong-bones.svg`,
  bushborne: `${S1_ICON_DIR}/buffs/personal-buff-bushborn.svg`,
  safecracker: `${S1_ICON_DIR}/buffs/personal-buff-safecracker.svg`,
  average: `${S1_ICON_DIR}/buffs/personal-buff-average-joe.svg`,
  'kappa-protocol': `${S1_ICON_DIR}/buffs/personal-buff-kappa-protocol.svg`,
  lucky: `${S1_ICON_DIR}/buffs/personal-buff-lucky.svg`,
  wunderkind: `${S1_ICON_DIR}/buffs/personal-buff-vunderkind.svg`,

  /* Негативные (debuff) */
  polydipsia: `${S1_ICON_DIR}/debuff/personal-debuff-polydipsia.svg`,
  'chronic-fatigue': `${S1_ICON_DIR}/debuff/personal-debuff-chronic-fatigue-syndrome.svg`,
  'dr-jekyll': `${S1_ICON_DIR}/debuff/personal-debuff-dr-jekyll.svg`,
  'third-leg': `${S1_ICON_DIR}/debuff/personal-debuff-well-endowed.svg`,
  hemophilia: `${S1_ICON_DIR}/debuff/personal-debuff-hemophilia.svg`,
  'well-that-hurt': `${S1_ICON_DIR}/debuff/personal-debuff-ouch-it-hurts.svg`,
  'personality-vacuum': `${S1_ICON_DIR}/debuff/personal-debuff-dwarf-nose.svg`,
  osteoporosis: `${S1_ICON_DIR}/debuff/personal-debuff-osteoporosis.svg`,
  allergic: `${S1_ICON_DIR}/debuff/personal-debuff-allergic.svg`,
  exhaustion: `${S1_ICON_DIR}/debuff/personal-debuff-exhaustion.svg`,
  incompetent: `${S1_ICON_DIR}/debuff/personal-debuff-slow-learner.svg`,
  'broken-secure-container': `${S1_ICON_DIR}/debuff/personal-debuff-broken-secure-container.svg`,
  'no-flea-market': `${S1_ICON_DIR}/debuff/personal-debuff-broken-flea-market.svg`,
  unlucky: `${S1_ICON_DIR}/debuff/personal-debuff-unlucky.svg`,

  /* Сезонные / глобальные (global) */
  'no-insurance': `${S1_ICON_DIR}/global/global-perk-broken-ensurance.svg`,
  'black-division': `${S1_ICON_DIR}/global/global-perk-black-division.svg`,
  'no-fir-hideout': `${S1_ICON_DIR}/global/global-perk-hideout-without-fir.svg`,
  'armor-shortage': `${S1_ICON_DIR}/global/global-perk-armor-deficit.svg`,
  handyman: `${S1_ICON_DIR}/global/global-perk-jack-of-all-trades.svg`,
  'seasoned-pmcs': `${S1_ICON_DIR}/global/global-perk-experienced-pmcs.svg`,
};

/**
 * Проставляет iconUrl каждому перку по его id из карты SVG-ассетов.
 * Уже заданный вручную iconUrl не перетирается.
 */
const withIcons = (perks: SeasonPerk[], icons: Record<string, string>): SeasonPerk[] =>
  perks.map((p) => ({
    ...p,
    iconUrl: p.iconUrl ?? icons[p.id],
  }));

export const EFT_SEASONS: Season[] = [
  {
    id: 'kord-breach',
    slug: 'kord-breach',
    number: 1,
    name: 'Kord Breach',
    patch: '1.1.0',
    logoUrl: '/icons/eft/04-progression/seasons/season01/KORD_BREACH_Season01_logo.svg',
    kickoffEvent: 'Blackout',
    // Окно объявлено (июль 2026), конкретный день BSG не назвала.
    startAt: null,
    minDays: 74,
    status: 'announced',
    summary: [
      'Сезонный персонаж — отдельный и добровольный: 1 уровень, пустой схрон, только PvP.',
      'Основной профиль не трогается: уровень, схрон, убежище и «Каппа» остаются как есть.',
      'Свой трек наград и сезонные задачи; заработанное переносится на основного персонажа.',
      'Минимальная длительность — 74 дня. Заявлено два сезона в год, бесплатно.',
    ],
    perks: withIcons(KORD_BREACH_PERKS, S1_PERK_ICON),
  },
];

export const getSeason = (slug: string): Season | undefined =>
  EFT_SEASONS.find((s) => s.slug === slug);

/** Текущий (единственный на сегодня) сезон — на него ведут хаб и меню. */
export const CURRENT_SEASON = EFT_SEASONS[0];
