// Каталог билдов сезонных перков — курируемые «архетипы» и мемные сборки.
// Это НЕ данные BSG: id перков настоящие (из eft-seasons.ts), а сами комбинации,
// названия и подписи — наш редакционный слой (по мотивам разбора комьюнити
// Kord Breach: «троица снабженца» Каппа→Медвежатник→Смотритель, мем «Середнячок
// для тех, у кого есть работа», мем «Третьей ноги» и т.д.).
//
// ⚠ ИНВАРИАНТ: каждый билд обязан быть валиден математикой бюджета
// (computeBudget(season, perks).valid === true) и без взаимоисключений.
// Проверяется скриптом перед коммитом — не правь perks на глаз.

export type BuildVibe = 'meta' | 'speed' | 'comfort' | 'pain' | 'meme' | 'loot';

export interface CuratedBuild {
  id: string;
  name: string;
  /** Короткая подпись под названием — с характером. */
  tagline: string;
  vibe: BuildVibe;
  /** id личных перков (позитивные + негативные). Сезонные сюда не входят. */
  perks: string[];
}

export const VIBE_META: Record<
  BuildVibe,
  { label: string; color: string }
> = {
  meta: { label: 'Мета', color: 'var(--primary)' },
  speed: { label: 'Спидран', color: 'var(--color-mode-pve)' },
  comfort: { label: 'Комфорт', color: 'var(--color-success)' },
  pain: { label: 'Боль', color: 'var(--color-danger)' },
  meme: { label: 'Мем', color: 'var(--color-rarity-rare-badge)' },
  loot: { label: 'Лут', color: 'var(--color-kappa)' },
};

const KORD_BREACH: CuratedBuild[] = [
  {
    id: 'kappa-doorstep',
    name: 'Каппа с порога',
    tagline: 'Галочка вместо самого длинного квеста в игре. Реддит уже пишет гневный пост.',
    vibe: 'meta',
    perks: [
      'kappa-protocol',
      'no-flea-market',
      'broken-secure-container',
      'incompetent',
      'exhaustion',
      'osteoporosis',
    ],
  },
  {
    id: 'all-in',
    name: 'Всё и сразу',
    tagline: 'Каппа, сейфы без ключей и Смотритель с первого дня — за это ты продал вообще всё остальное.',
    vibe: 'meta',
    perks: [
      'kappa-protocol',
      'safecracker',
      'sailors-nostalgia',
      'no-flea-market',
      'broken-secure-container',
      'incompetent',
      'exhaustion',
      'osteoporosis',
      'allergic',
      'hemophilia',
      'well-that-hurt',
      'third-leg',
    ],
  },
  {
    id: 'safecracker-shift',
    name: 'Медвежатник на смене',
    tagline: 'Сейфы без ключей, рыбка для Смотрителя, экономная жратва. Рубли идут сами.',
    vibe: 'speed',
    perks: [
      'safecracker',
      'sailors-nostalgia',
      'diet',
      'street-tax',
      'exhaustion',
      'osteoporosis',
      'hemophilia',
      'third-leg',
    ],
  },
  {
    id: 'average-joe',
    name: 'Середнячок с работой',
    tagline: 'Все навыки на 25 и ни шагом дальше. Идеально для тех, у кого есть работа. Оскорбительно для тех, у кого нет.',
    vibe: 'comfort',
    perks: [
      'average',
      'polyphagia',
      'sturdy-bones',
      'broken-secure-container',
      'exhaustion',
      'allergic',
      'personality-vacuum',
      'hemophilia',
    ],
  },
  {
    id: 'pain-department',
    name: 'Отдел страданий',
    tagline: 'Ноль позитивных. 34 очка боли уходят в никуда. Награда — только право хвастаться в чате.',
    vibe: 'pain',
    perks: [
      'no-flea-market',
      'broken-secure-container',
      'incompetent',
      'exhaustion',
      'osteoporosis',
      'allergic',
      'hemophilia',
      'well-that-hurt',
      'personality-vacuum',
      'polydipsia',
      'chronic-fatigue',
      'dr-jekyll',
      'third-leg',
    ],
  },
  {
    id: 'zero-sum',
    name: 'Ровно по нулям',
    tagline: 'Дешёвая боль, честно потраченная на кости и скорость. Ноль в балансе — ноль вопросов.',
    vibe: 'meme',
    perks: ['third-leg', 'broken-secure-container', 'sturdy-bones', 'sprinter'],
  },
  {
    id: 'therapist-affair',
    name: 'Особые отношения с Терапевтом',
    tagline: '−1% к скорости и скидка у Терапевта. Реддит нашёл в этом больше, чем задумывала BSG.',
    vibe: 'meme',
    perks: ['third-leg', 'dr-jekyll', 'polydipsia', 'chronic-fatigue', 'sprinter', 'juice-time'],
  },
  {
    id: 'bush-looter',
    name: 'Из кустов по лут',
    tagline: 'Бесшумный по траве, вскрывает сейфы, бегает вечно. Тебя не услышат — но и на барахолку не сходишь.',
    vibe: 'loot',
    perks: [
      'bushborne',
      'safecracker',
      'marathon-runner',
      'no-flea-market',
      'broken-secure-container',
      'osteoporosis',
      'dr-jekyll',
    ],
  },
  {
    id: 'never-tired',
    name: 'Вечный движ',
    tagline: 'Не устаёт, не задыхается, шуршит тише мыши. Единственная усталость — от чтения этого списка.',
    vibe: 'comfort',
    perks: [
      'marathon-runner',
      'sprinter',
      'youth',
      'bushborne',
      'no-flea-market',
      'broken-secure-container',
      'personality-vacuum',
      'third-leg',
    ],
  },
  {
    id: 'soft-landing',
    name: 'Мягкая посадка',
    tagline: 'Реже ломаешься, экономишь еду и воду, Дикие приносят дань. Боль — по мелочи, чтобы не расслабляться.',
    vibe: 'comfort',
    perks: [
      'sturdy-bones',
      'polyphagia',
      'hypodipsia',
      'diet',
      'street-tax',
      'personality-vacuum',
      'well-that-hurt',
      'allergic',
      'third-leg',
      'dr-jekyll',
    ],
  },
  {
    id: 'mosin-boyar',
    name: 'Мосинбоярин',
    tagline: 'Болтовки качаются вдвое, Сила и Выносливость на старте. Барахолки нет — только ты, Мосинка и вера.',
    vibe: 'meme',
    perks: ['tarkov-shooter', 'hercules', 'sturdy-bones', 'no-flea-market', 'allergic'],
  },
  {
    id: 'champion-liver',
    name: 'Печень чемпиона',
    tagline: 'Экономная жратва, лечебная рыбка, сок-обезбол — и аллергия на два случайных продукта. Кто-то умрёт от батончика.',
    vibe: 'meme',
    perks: [
      'diet',
      'juice-time',
      'sailors-nostalgia',
      'street-tax',
      'polyphagia',
      'hypodipsia',
      'broken-secure-container',
      'allergic',
      'hemophilia',
      'dr-jekyll',
    ],
  },
  {
    id: 'sniper-tower',
    name: 'Снайперская вышка',
    tagline: 'Болтовки качаются вдвое, Сила и Выносливость с запасом. Дыхалка сдаёт, а контейнер урезан — но с вышки этого не видно.',
    vibe: 'meta',
    perks: ['tarkov-shooter', 'hercules', 'sprinter', 'exhaustion', 'broken-secure-container'],
  },
  {
    id: 'boar-tank',
    name: 'Ходячий кабан',
    tagline: 'Не ломается, прёт как БТР, энергия не тает. Обаяния ноль — но кабану оно и не нужно.',
    vibe: 'comfort',
    perks: ['sturdy-bones', 'hercules', 'youth', 'no-flea-market', 'personality-vacuum', 'dr-jekyll'],
  },
  {
    id: 'kappa-intact',
    name: 'Каппа без жертв',
    tagline: 'Каппа с порога — и разгрузка цела. Платишь здоровьем, навыками и барахолкой, зато таскаешь всё как белый человек.',
    vibe: 'loot',
    perks: [
      'kappa-protocol',
      'no-flea-market',
      'incompetent',
      'exhaustion',
      'allergic',
      'hemophilia',
      'well-that-hurt',
    ],
  },
  {
    id: 'ghost-exit',
    name: 'Тихий выход',
    tagline: 'Призрак по кустам: не шумит, не устаёт, воду бережёт. Барахолки нет — добычу выносишь ногами.',
    vibe: 'speed',
    perks: ['bushborne', 'marathon-runner', 'hypodipsia', 'no-flea-market', 'broken-secure-container'],
  },
  {
    id: 'passive-income',
    name: 'Пассивный доход',
    tagline: 'Дикие отстёгивают за крышу, сейфы вскрываются без ключей — рубли капают сами. Ты только чуть медленнее и подтекаешь.',
    vibe: 'loot',
    perks: ['street-tax', 'safecracker', 'broken-secure-container', 'dr-jekyll', 'third-leg', 'polydipsia'],
  },
  {
    id: 'field-medic',
    name: 'Полевой медик',
    tagline: 'Не течёшь, сок глушит боль, рыбка латает. Ирония: аптечки жрёт как не в себя, а свежая рана не заживает до эвака.',
    vibe: 'comfort',
    perks: ['thrombophilia', 'juice-time', 'sailors-nostalgia', 'diet', 'broken-secure-container', 'well-that-hurt', 'dr-jekyll'],
  },
];

export const SEASON_BUILDS: Record<string, CuratedBuild[]> = {
  'kord-breach': KORD_BREACH,
};

export const getSeasonBuilds = (slug: string): CuratedBuild[] => SEASON_BUILDS[slug] ?? [];
