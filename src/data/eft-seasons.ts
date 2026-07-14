// Сезоны EFT (раздел «Прогресс» → «Сезоны»).
//
// МЕХАНИКА (Season 1 «Kord Breach», патч 1.1.0):
//   • Сезонный персонаж — ОТДЕЛЬНЫЙ и добровольный: уровень 1, пустой схрон, только PvP.
//     Основной профиль (стаж, схрон, убежище, Каппа) не трогается вообще.
//   • Сезонные модификаторы навязаны всем — их не выбирают.
//   • Личные модификаторы — БЮДЖЕТ: старт 0 очков, негативные ДАЮТ очки, позитивные ТРАТЯТ.
//     Баланс обязан остаться ≥ 0. Хочешь Каппу (−21) — набери +21 болью.
//
// ⚠ Цифры и формулировки — из превью сезона; BSG может подкрутить их к релизу.
// Иконки: пока не заданы — карточка рендерится типизированной плашкой (цвет по типу).
// Появятся ассеты — проставить iconUrl, разметка не меняется.

export type PerkKind = 'season' | 'positive' | 'negative';

export interface SeasonPerk {
  id: string;
  name: string;
  /** Очки: позитивные тратят (< 0), негативные дают (> 0), сезонные — 0. */
  cost: number;
  kind: PerkKind;
  /** Эффекты списком — так их читает и игрок, и карточка. */
  effects: string[];
  /** Иконка появится после отрисовки ассетов; пока плашка. */
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
    name: 'Без страховки',
    cost: 0,
    kind: 'season',
    effects: ['Страховать снаряжение перед рейдом нельзя — потерянное не вернётся.'],
  },
  {
    id: 'black-division',
    name: 'Чёрная дивизия',
    cost: 0,
    kind: 'season',
    effects: ['Бойцы «Чёрной дивизии» встречаются на большем числе локаций, чем в основной игре.'],
  },
  {
    id: 'no-fir-hideout',
    name: 'Убежище без FiR',
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
    name: 'Мастеровитый',
    cost: 0,
    kind: 'season',
    effects: ['Время крафта предметов вдвое меньше.', 'Навык «Крафт» стартует с 51 уровня.'],
  },
  {
    id: 'seasoned-pmcs',
    name: 'Бывалые ЧВК',
    cost: 0,
    kind: 'season',
    effects: ['Персонаж получает на 25% больше опыта за рейд.'],
  },

  /* ── Позитивные: тратят очки ────────────────────────────────────── */
  {
    id: 'street-tax',
    name: 'Уличный налог',
    cost: -1,
    kind: 'positive',
    effects: ['Раз в неделю часть Диких отстёгивает вам за «крышу».'],
  },
  {
    id: 'diet',
    name: 'Диета',
    cost: -1,
    kind: 'positive',
    effects: ['Вся провизия расходуется вдвое экономнее.'],
  },
  {
    id: 'juice-time',
    name: 'Время сока',
    cost: -2,
    kind: 'positive',
    effects: ['Выпитый сок даёт эффект обезболивающего на 60 секунд.'],
  },
  {
    id: 'sailors-nostalgia',
    name: 'Ностальгия моряка',
    cost: -2,
    kind: 'positive',
    effects: ['Консервированная рыба даёт регенерацию здоровья (+2) на 10 секунд.'],
  },
  {
    id: 'sprinter',
    name: 'Спринтер',
    cost: -2,
    kind: 'positive',
    effects: ['Скорость бега выше на 5%.'],
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
    effects: ['Гидратация расходуется на 15% медленнее.'],
    excludes: ['polydipsia'],
  },
  {
    id: 'polyphagia',
    name: 'Полифагия',
    cost: -2,
    kind: 'positive',
    effects: ['Энергия расходуется на 15% медленнее.'],
    excludes: ['chronic-fatigue'],
  },
  {
    id: 'marathon-runner',
    name: 'Марафонец',
    cost: -3,
    kind: 'positive',
    effects: ['Выносливость рук и ног тратится на 15% медленнее.'],
    excludes: ['exhaustion'],
  },
  {
    id: 'youth',
    name: 'Молодость',
    cost: -3,
    kind: 'positive',
    effects: ['Энергия расходуется на 20% медленнее.', 'Выносливость рук и ног выше на 10.'],
    excludes: ['exhaustion', 'chronic-fatigue'],
  },
  {
    id: 'tarkov-shooter',
    name: 'Тарковский стрелок',
    cost: -3,
    kind: 'positive',
    effects: [
      'Навык «Болтовые винтовки» качается вдвое быстрее.',
      'Навык стартует с 10 уровня.',
    ],
  },
  {
    id: 'hercules',
    name: 'Геркулес',
    cost: -3,
    kind: 'positive',
    effects: ['Навыки «Сила» и «Выносливость» стартуют с 15 уровня.'],
  },
  {
    id: 'sturdy-bones',
    name: 'Крепкие кости',
    cost: -3,
    kind: 'positive',
    effects: ['Шанс перелома ниже на 15%.', 'Урон от падения меньше на 15%.'],
    excludes: ['osteoporosis'],
  },
  {
    id: 'bushborne',
    name: 'Рождённый в кустах',
    cost: -5,
    kind: 'positive',
    effects: ['Ходьба по растительности вдвое тише и вдвое меньше замедляет.'],
  },
  {
    id: 'safecracker',
    name: 'Медвежатник',
    cost: -6,
    kind: 'positive',
    effects: ['Механические ключи с шансом 20% не тратят прочность (карты-ключи не в счёт).'],
  },
  {
    id: 'average',
    name: 'Середнячок',
    cost: -10,
    kind: 'positive',
    effects: [
      'Все навыки сразу на 25 уровне, но дальше не растут (кроме «Крафта»).',
    ],
    excludes: ['incompetent'],
  },
  {
    id: 'kappa-protocol',
    name: 'Протокол «Каппа»',
    cost: -21,
    kind: 'positive',
    effects: ['Разгрузочный контейнер «Каппа» выдаётся сразу.'],
  },

  /* ── Негативные: дают очки ──────────────────────────────────────── */
  {
    id: 'polydipsia',
    name: 'Полидипсия',
    cost: 1,
    kind: 'negative',
    effects: ['Гидратация расходуется на 15% быстрее.'],
    excludes: ['hypodipsia'],
  },
  {
    id: 'chronic-fatigue',
    name: 'Синдром хронической усталости',
    cost: 1,
    kind: 'negative',
    effects: ['Энергия расходуется на 15% быстрее.'],
    excludes: ['polyphagia', 'youth'],
  },
  {
    id: 'dr-jekyll',
    name: 'Доктор Джекилл',
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
    id: 'hemophilia',
    name: 'Гемофилия',
    cost: 2,
    kind: 'negative',
    effects: ['Шанс кровотечения выше на 25%.'],
    excludes: ['thrombophilia'],
  },
  {
    id: 'well-that-hurt',
    name: 'Больно же!',
    cost: 2,
    kind: 'negative',
    effects: ['Аптечки тратят на 25% больше ресурса за использование.'],
  },
  {
    id: 'personality-vacuum',
    name: 'Пустая харизма',
    cost: 2,
    kind: 'negative',
    effects: ['Навык «Харизма» не растёт.', 'Товары торговцев дороже на 20%.'],
  },
  {
    id: 'osteoporosis',
    name: 'Остеопороз',
    cost: 3,
    kind: 'negative',
    effects: ['Шанс перелома выше на 15%.', 'Урон от падения больше на 15%.'],
    excludes: ['sturdy-bones'],
  },
  {
    id: 'allergic',
    name: 'Аллергик',
    cost: 3,
    kind: 'negative',
    effects: ['Аллергия на 2 случайных предмета из провизии или медикаментов.'],
  },
  {
    id: 'exhaustion',
    name: 'Истощение',
    cost: 4,
    kind: 'negative',
    effects: [
      'Выносливость рук и ног восстанавливается на 15% медленнее.',
      'Запас выносливости меньше на 10.',
    ],
    excludes: ['marathon-runner', 'youth'],
  },
  {
    id: 'incompetent',
    name: 'Бездарь',
    cost: 4,
    kind: 'negative',
    effects: [
      'Все навыки качаются на 25% медленнее (кроме «Болтовых винтовок»).',
      'Навыки не поднимаются выше 30 уровня (кроме «Крафта»).',
    ],
    excludes: ['average'],
  },
  {
    id: 'broken-secure-container',
    name: 'Сломанный контейнер',
    cost: 4,
    kind: 'negative',
    effects: [
      'В разгрузочный контейнер влезают только деньги, ключи, жетоны, спецснаряжение и часть контейнеров.',
    ],
  },
  {
    id: 'no-flea-market',
    name: 'Без барахолки',
    cost: 6,
    kind: 'negative',
    effects: ['Торговля с игроками на барахолке недоступна.'],
  },
];

export const EFT_SEASONS: Season[] = [
  {
    id: 'kord-breach',
    slug: 'kord-breach',
    number: 1,
    name: 'Kord Breach',
    patch: '1.1.0',
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
    perks: KORD_BREACH_PERKS,
  },
];

export const getSeason = (slug: string): Season | undefined =>
  EFT_SEASONS.find((s) => s.slug === slug);

/** Текущий (единственный на сегодня) сезон — на него ведут хаб и меню. */
export const CURRENT_SEASON = EFT_SEASONS[0];
