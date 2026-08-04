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
  /** Hero-баннер 9:16 для рулетки (webp). Проставляется withBanners по id. */
  banner?: string;
  /** Короткий тайтл-оверлей для карточки ленты. */
  short?: string;
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
    perks: ['kappa-protocol', 'incompetent', 'third-leg', 'dr-jekyll'],
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
      'osteoporosis',
      'hemophilia',
      'well-that-hurt',
      'third-leg',
      'dr-jekyll',
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
      'dr-jekyll',
    ],
  },
  {
    id: 'pain-department',
    name: 'Отдел страданий',
    tagline: 'Ноль позитивных. 49 очков боли уходят в никуда — последний негатив несовместим с остальными. Награда — только право хвастаться в чате.',
    vibe: 'pain',
    perks: [
      'no-flea-market',
      'incompetent',
      'broken-secure-container',
      'exhaustion',
      'osteoporosis',
      'allergic',
      'hemophilia',
      'well-that-hurt',
      'personality-vacuum',
      'polydipsia',
      'chronic-fatigue',
      'dr-jekyll',
      'unlucky',
    ],
  },
  {
    id: 'zero-sum',
    name: 'Ровно по нулям',
    tagline: 'Дешёвая боль, честно потраченная на кости и скорость. Ноль в балансе — ноль вопросов.',
    vibe: 'meme',
    perks: ['sturdy-bones', 'sprinter', 'polydipsia', 'chronic-fatigue', 'unlucky', 'dr-jekyll'],
  },
  {
    id: 'therapist-affair',
    name: 'Особые отношения с Терапевтом',
    tagline: '−1% к скорости и скидка у Терапевта. Реддит нашёл в этом больше, чем задумывала BSG.',
    vibe: 'meme',
    perks: ['third-leg', 'dr-jekyll', 'polydipsia', 'unlucky', 'sturdy-bones', 'juice-time'],
  },
  {
    id: 'bush-looter',
    name: 'Из кустов по лут',
    tagline: 'Бесшумный по траве, вскрывает сейфы, бегает вечно. Тебя не услышат — но и на барахолку не сходишь.',
    vibe: 'loot',
    perks: ['bushborne', 'safecracker', 'marathon-runner', 'no-flea-market', 'osteoporosis'],
  },
  {
    id: 'never-tired',
    name: 'Вечный движ',
    tagline: 'Не устаёт, не задыхается, шуршит тише мыши. Единственная усталость — от чтения этого списка.',
    vibe: 'comfort',
    perks: [
      'marathon-runner',
      'sturdy-bones',
      'youth',
      'bushborne',
      'no-flea-market',
      'broken-secure-container',
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
      'hemophilia',
      'well-that-hurt',
      'allergic',
      'third-leg',
      'dr-jekyll',
      'unlucky',
    ],
  },
  {
    id: 'mosin-boyar',
    name: 'Мосинбоярин',
    tagline: 'Болтовки качаются вдвое, Сила и Выносливость на старте. Барахолки нет — только ты, Мосинка и вера.',
    vibe: 'meme',
    perks: ['tarkov-shooter', 'hercules', 'sturdy-bones', 'no-flea-market'],
  },
  {
    id: 'champion-liver',
    name: 'Печень чемпиона',
    tagline: 'Экономная жратва, лечебная рыбка, сок-обезбол — и аллергия на три случайных продукта. Кто-то умрёт от батончика.',
    vibe: 'meme',
    perks: [
      'diet',
      'juice-time',
      'sailors-nostalgia',
      'polyphagia',
      'hypodipsia',
      'allergic',
      'broken-secure-container',
      'dr-jekyll',
    ],
  },
  {
    id: 'sniper-tower',
    name: 'Снайперская вышка',
    tagline: 'Болтовки качаются вдвое, Сила и Выносливость с запасом. Дыхалка сдаёт, а контейнер урезан — но с вышки этого не видно.',
    vibe: 'meta',
    perks: ['tarkov-shooter', 'hercules', 'sprinter', 'diet', 'exhaustion', 'broken-secure-container', 'dr-jekyll'],
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
    tagline: 'Каппа с порога — и разгрузка цела. Платишь здоровьем и барахолкой, зато таскаешь всё как белый человек.',
    vibe: 'loot',
    perks: ['kappa-protocol', 'sturdy-bones', 'no-flea-market', 'hemophilia', 'allergic'],
  },
  {
    id: 'ghost-exit',
    name: 'Тихий выход',
    tagline: 'Призрак по кустам: не шумит, не устаёт, воду бережёт. Барахолки нет — добычу выносишь ногами.',
    vibe: 'speed',
    perks: ['bushborne', 'marathon-runner', 'hypodipsia', 'no-flea-market'],
  },
  {
    id: 'passive-income',
    name: 'Пассивный доход',
    tagline: 'Дикие отстёгивают за крышу, сейфы вскрываются без ключей — рубли капают сами. Ты только чуть медленнее и подтекаешь.',
    vibe: 'loot',
    perks: ['street-tax', 'safecracker', 'third-leg', 'hemophilia', 'polydipsia', 'dr-jekyll'],
  },
  {
    id: 'field-medic',
    name: 'Полевой медик',
    tagline: 'Не течёшь, сок глушит боль, рыбка латает. Ирония: аптечки жрёт как не в себя, а свежая рана не заживает до эвака.',
    vibe: 'comfort',
    perks: ['thrombophilia', 'juice-time', 'sailors-nostalgia', 'diet', 'well-that-hurt', 'dr-jekyll', 'allergic', 'personality-vacuum'],
  },
  // ── Новые билды под сезонные вводные (убежище без FIR, дефицит брони,
  //    Чёрная дивизия, +25% опыта). Считаны от бюджета: баланс 0, есть негативы. ──
  {
    id: 'foreman',
    name: 'Прораб без бумажек',
    tagline: 'Убежище строится без «в рейде», крафты вдвое быстрее — пока сосед сидит в бункере, ты уже кладёшь плитку в бассейне. Сейфы без ключей, дань с Диких и скидка у Терапевта гонят рубли на стройку.',
    vibe: 'loot',
    perks: [
      'safecracker',
      'diet',
      'street-tax',
      'third-leg',
      'polydipsia',
      'chronic-fatigue',
      'hemophilia',
      'dr-jekyll',
    ],
  },
  {
    id: 'barefoot-infantry',
    name: 'Босая пехота',
    tagline: 'Брони у торговцев не достать — значит броня это ноги. Не ломаешься, прёшь как лось, таскаешь железо Геркулесом. Барахолки и разгрузки нет: что нашёл — выносишь на себе.',
    vibe: 'speed',
    perks: [
      'sturdy-bones',
      'marathon-runner',
      'hercules',
      'diet',
      'no-flea-market',
      'broken-secure-container',
    ],
  },
  {
    id: 'black-division-assault',
    name: 'Штурм Чёрной дивизии',
    tagline: 'Чёрная дивизия расплодилась, а за фраги капает +25% опыта — грех не пушить. Сок глушит боль в бою, кровь не хлещет, дыхалки хватает на все рывки. Барахолки нет — трофеи снимаешь с тел.',
    vibe: 'meta',
    perks: [
      'sturdy-bones',
      'marathon-runner',
      'juice-time',
      'thrombophilia',
      'no-flea-market',
    ],
  },
];

// Hero-баннеры сезона 1 (webp в /public/images/seasons/season01/builds) + короткие
// тайтлы. Имена файлов заданы при генерации (NN-vibe-id) и не равны id — маппинг явный.
const S1_BUILD_DIR = '/images/seasons/season01/builds';
const S1_BUILD_BANNER: Record<string, { file: string; short: string }> = {
  'kappa-doorstep': { file: '01-meta-kappa-doorstep', short: 'Каппа с порога' },
  'all-in': { file: '02-meta-all-in', short: 'Всё и сразу' },
  'safecracker-shift': { file: '03-speed-safecracker-shift', short: 'Медвежатник' },
  'average-joe': { file: '04-comfort-average-joe', short: 'Середнячок' },
  'pain-department': { file: '05-pain-pain-department', short: 'Отдел страданий' },
  'zero-sum': { file: '06-meme-zero-sum', short: 'Ровно по нулям' },
  'therapist-affair': { file: '07-meme-therapist-affair', short: 'Роман с Терапевтом' },
  'bush-looter': { file: '08-loot-bush-looter', short: 'Из кустов' },
  'never-tired': { file: '09-comfort-never-tired', short: 'Вечный движ' },
  'soft-landing': { file: '10-comfort-soft-landing', short: 'Мягкая посадка' },
  'mosin-boyar': { file: '11-meme-mosin-boyar', short: 'Мосинбоярин' },
  'champion-liver': { file: '12-meme-champion-liver', short: 'Печень чемпиона' },
  'sniper-tower': { file: '13-meta-sniper-tower', short: 'Снайперская вышка' },
  'boar-tank': { file: '14-comfort-boar-tank', short: 'Ходячий кабан' },
  'kappa-intact': { file: '15-loot-kappa-intact', short: 'Каппа без жертв' },
  'ghost-exit': { file: '16-speed-ghost-exit', short: 'Тихий выход' },
  'passive-income': { file: '17-loot-passive-income', short: 'Пассивный доход' },
  'field-medic': { file: '18-comfort-field-medic', short: 'Полевой медик' },
  foreman: { file: '19-loot-foreman', short: 'Прораб' },
  'barefoot-infantry': { file: '20-speed-barefoot-infantry', short: 'Босая пехота' },
  'black-division-assault': { file: '21-meta-black-division-assault', short: 'Штурм' },
};

const withBanners = (builds: CuratedBuild[]): CuratedBuild[] =>
  builds.map((b) => {
    const meta = S1_BUILD_BANNER[b.id];
    return meta ? { ...b, banner: `${S1_BUILD_DIR}/${meta.file}.webp`, short: meta.short } : b;
  });

export const SEASON_BUILDS: Record<string, CuratedBuild[]> = {
  'kord-breach': withBanners(KORD_BREACH),
};

export const getSeasonBuilds = (slug: string): CuratedBuild[] => SEASON_BUILDS[slug] ?? [];
