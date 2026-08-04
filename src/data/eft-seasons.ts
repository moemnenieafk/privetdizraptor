// Сезоны EFT (раздел «Прогресс» → «Сезоны»).
//
// МЕХАНИКА (Season 1 «Kord Breach», патч 1.1.0):
//   • Сезонный персонаж — ОТДЕЛЬНЫЙ и добровольный: уровень 1, пустой схрон, только PvP.
//     Основной профиль (стаж, схрон, убежище, Каппа) не трогается вообще.
//   • Сезонные модификаторы навязаны всем — их не выбирают.
//   • Личные модификаторы — БЮДЖЕТ: старт 0 очков, негативные ДАЮТ очки, позитивные ТРАТЯТ.
//     Баланс обязан остаться ≥ 0. Хочешь Каппу (−12) — набери +12 болью.
//
// ✔ Названия, цифры и формулировки — 1:1 с экранами игры (релиз 1.1.0.0):
//   скриншоты в docs/eft/progress/seasons/build-constructor.
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
   * Несовместимые перки — РЕАЛЬНЫЙ запрет BSG (сверено кликами в клиенте 1.1.0),
   * а не наша эвристика: игра не даёт взять оба. Иногда эффекты взаимно гасятся
   * (−25% / +25% кровотечения), иногда это чистое дизайн-ограничение
   * (Спринтер ↔ Марафонец). ВАЖНО: связь симметрична — пара обязана стоять в
   * excludes у ОБОИХ перков, потому что стор и perkStates ищут конфликт только в
   * excludes добавляемого. Конструктор такие пары блокирует и поясняет почему.
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
    effects: ['Страховка предметов у всех Торговцев недоступна.'],
  },
  {
    id: 'black-division',
    name: 'Black Division',
    cost: 0,
    kind: 'season',
    effects: ['Бойцы подразделения Black Division встречаются на некоторых локациях.'],
  },
  {
    id: 'no-fir-hideout',
    name: 'Не по ГОСТу',
    cost: 0,
    kind: 'season',
    effects: ['Постройка модулей в Убежище не требует статуса «Найдено в рейде» у предметов.'],
  },
  {
    id: 'armor-shortage',
    name: 'Дефицит брони',
    cost: 0,
    kind: 'season',
    effects: ['В Таркове наблюдается дефицит брони у Торговцев.'],
  },
  {
    id: 'handyman',
    name: 'На все руки мастер',
    cost: 0,
    kind: 'season',
    effects: ['Время крафта сокращено на 50%.', 'Умение «Ручное производство» по умолчанию 51 уровня.'],
  },
  {
    id: 'seasoned-pmcs',
    name: 'Опытные ЧВК',
    cost: 0,
    kind: 'season',
    effects: ['Персонаж получает на 25% больше опыта.'],
  },

  /* ── Позитивные: тратят очки (по возрастанию цены) ──────────────── */
  {
    id: 'street-tax',
    name: 'Бизнесмен',
    cost: -1,
    kind: 'positive',
    effects: ['Один раз в неделю вы получаете откаты крышевание над некоторыми дикими.'],
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
    effects: ['Трата ресурса всей провизии меньше на 50%.'],
  },
  {
    id: 'juice-time',
    name: 'Juice Time',
    cost: -2,
    kind: 'positive',
    effects: ['При употреблении соков персонаж получает эффект «На болеутоляющих» на 60 секунд.'],
  },
  {
    id: 'sailors-nostalgia',
    name: 'Ностальгия моряка',
    cost: -2,
    kind: 'positive',
    effects: ['При употреблении рыбных консервов персонаж получает эффект «Регенерация здоровья» (+2) на 30 секунд.'],
  },
  {
    id: 'thrombophilia',
    name: 'Тромбофилия',
    cost: -2,
    kind: 'positive',
    effects: ['Шанс получить кровотечение уменьшается на 25%.'],
    excludes: ['hemophilia'],
  },
  {
    id: 'hypodipsia',
    name: 'Гиподипсия',
    cost: -2,
    kind: 'positive',
    effects: ['Гидратация тратится на 20% медленнее.'],
    excludes: ['polydipsia'],
  },
  {
    id: 'polyphagia',
    name: 'Полифагия',
    cost: -2,
    kind: 'positive',
    effects: ['Энергия тратится на 20% медленнее.'],
    excludes: ['chronic-fatigue', 'youth'],
  },
  {
    id: 'tarkov-shooter',
    name: 'Тарковский стрелок',
    cost: -2,
    kind: 'positive',
    effects: [
      'Скорость прокачки умения «Болтовые винтовки» выше на 100%.',
      'Умение «Болтовые винтовки» со старта имеет 25 уровень.',
    ],
    excludes: ['average'],
  },
  {
    id: 'sprinter',
    name: 'Спринтер',
    cost: -3,
    kind: 'positive',
    effects: ['Скорость бега персонажа выше на 5%.'],
    excludes: ['marathon-runner', 'third-leg'],
  },
  {
    id: 'marathon-runner',
    name: 'Марафонец',
    cost: -3,
    kind: 'positive',
    effects: ['Выносливость рук и ног тратится на 20% медленнее.'],
    excludes: ['exhaustion', 'sprinter'],
  },
  {
    id: 'sturdy-bones',
    name: 'Крепкие кости',
    cost: -3,
    kind: 'positive',
    effects: ['Шанс сломать любую из конечностей уменьшается на 25%.', 'Падение с высоты наносит на 20% меньше урона.'],
    excludes: ['osteoporosis'],
  },
  {
    id: 'youth',
    name: 'Молодость',
    cost: -5,
    kind: 'positive',
    effects: ['Энергия тратится на 20% медленнее.', 'Выносливость рук и ног выше на 10 единиц.'],
    excludes: ['exhaustion', 'chronic-fatigue', 'polyphagia'],
  },
  {
    id: 'hercules',
    name: 'Геркулес',
    cost: -5,
    kind: 'positive',
    effects: ['Умения «Сила» и «Выносливость» со старта имеют 15 уровень.'],
    excludes: ['average'],
  },
  {
    id: 'wunderkind',
    name: 'Вундеркинд',
    cost: -5,
    kind: 'positive',
    effects: ['Получение опыта для Умений увеличено на 30%.'],
    excludes: ['incompetent', 'average'],
  },
  {
    id: 'bushborne',
    name: 'Кусторождённый',
    cost: -5,
    kind: 'positive',
    effects: ['Задевание веток, травы и кустов вызывает на 75% меньше шума и замедления.'],
  },
  {
    id: 'safecracker',
    name: 'Медвежатник',
    cost: -5,
    kind: 'positive',
    effects: ['При использовании механического ключа есть 25% шанс, что он не потеряет прочность.'],
  },
  {
    id: 'average',
    name: 'Середнячок',
    cost: -12,
    kind: 'positive',
    effects: [
      'Все умения по умолчанию имеют 25 уровень, но их нельзя прокачивать (кроме умения «Ручное производство»).',
    ],
    excludes: ['incompetent', 'wunderkind', 'tarkov-shooter', 'hercules'],
  },
  {
    id: 'kappa-protocol',
    name: 'Kappa Protocol',
    cost: -12,
    kind: 'positive',
    effects: ['Персонаж получает со старта Защищённый контейнер «Каппа».'],
  },

  /* ── Негативные: дают очки (по возрастанию награды) ─────────────── */
  {
    id: 'dr-jekyll',
    name: 'Доктор Джекил',
    cost: 1,
    kind: 'negative',
    effects: ['Эффект свежие раны остаётся до конца рейда.'],
  },
  {
    id: 'third-leg',
    name: 'Третья нога',
    cost: 1,
    kind: 'negative',
    effects: ['Скорость бега меньше на 1%.', 'Скидка 5% на покупку предметов у Терапевта.'],
    excludes: ['sprinter', 'personality-vacuum'],
  },
  {
    id: 'unlucky',
    name: 'Невезучий',
    cost: 1,
    kind: 'negative',
    effects: ['Ваше невезение иногда приводит к плачевным последствиям.'],
    excludes: ['lucky'],
  },
  {
    id: 'polydipsia',
    name: 'Полидипсия',
    cost: 2,
    kind: 'negative',
    effects: ['Гидратация тратится на 15% быстрее.'],
    excludes: ['hypodipsia'],
  },
  {
    id: 'chronic-fatigue',
    name: 'Синдром хронической усталости',
    cost: 2,
    kind: 'negative',
    effects: ['Энергия тратится на 20% быстрее.'],
    excludes: ['polyphagia', 'youth'],
  },
  {
    id: 'hemophilia',
    name: 'Гемофилия',
    cost: 2,
    kind: 'negative',
    effects: ['Шанс получить кровотечение увеличивается на 25%.'],
    excludes: ['thrombophilia'],
  },
  {
    id: 'well-that-hurt',
    name: 'Ай, болит!',
    cost: 2,
    kind: 'negative',
    effects: ['Ресурс всех аптечек тратится на 25% сильнее.'],
  },
  {
    id: 'personality-vacuum',
    name: 'Карлик нос',
    cost: 2,
    kind: 'negative',
    effects: ['Харизма игрока не растёт.', 'Стоимость ассортимента всех торговцев дороже на 20%.'],
    excludes: ['third-leg'],
  },
  {
    id: 'osteoporosis',
    name: 'Остеопороз',
    cost: 3,
    kind: 'negative',
    effects: ['Шанс сломать любую из конечностей увеличивается на 25%.', 'Падение с высоты наносит на 20% больше урона.'],
    excludes: ['sturdy-bones'],
  },
  {
    id: 'allergic',
    name: 'Аллергик',
    cost: 3,
    kind: 'negative',
    effects: ['У персонажа есть аллергия на 3 случайных предмета из провизии или медицинских препаратов.'],
  },
  {
    id: 'exhaustion',
    name: 'Истощение',
    cost: 5,
    kind: 'negative',
    effects: [
      'Выносливость рук и ног восстанавливается на 20% медленнее.',
      'Выносливость рук и ног меньше на 10 единиц.',
    ],
    excludes: ['marathon-runner', 'youth'],
  },
  {
    id: 'broken-secure-container',
    name: 'Сломанный защищённый контейнер',
    cost: 6,
    kind: 'negative',
    effects: [
      'Защищённый контейнер ограничен деньгами, ключами, жетонами, спецоборудованием, некоторыми контейнерами и документами Боевого Пропуска.',
    ],
  },
  {
    id: 'incompetent',
    name: 'Необучаемый',
    cost: 10,
    kind: 'negative',
    effects: [
      'Получение опыта для Умений уменьшено на 25% (кроме умения «Болтовые винтовки»).',
      'Максимальный уровень умений 30 (кроме умения «Ручное производство»).',
    ],
    excludes: ['average', 'wunderkind'],
  },
  {
    id: 'no-flea-market',
    name: 'Неработающая барахолка',
    cost: 10,
    kind: 'negative',
    effects: ['Торговля на Барахолке с другими игроками недоступна.'],
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
