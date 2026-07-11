// Престиж EFT (PvP; в PvE вводится поэтапно). Актуализировано 2026-07-03 по зеркалу
// живой игры 1.0.x: престижи 1-4 активны — квесты «Новое начало» (new-beginning 1-4)
// у Барахольщика в нашем EFT_QUESTS; требования ниже = точные objectives этих квестов.
// Престижи 5-6 — запланированы (иконки в клиенте есть, квестов нет). Сброс/перенос/
// награды — кросс-чек веб-источников (timesaver.gg, skycoach, tarkov.help, 2026).
// Старая система (Коллекционер + 55 лвл + рубли) упразднена в Icebreaker-обновлении.

export interface PrestigeRequirement {
  label: string;
  /** Если задан — авто-чек по уровню игрока (телеметрия). */
  minLevel?: number;
}

export interface PrestigeLevel {
  level: number;
  /** Мин. уровень ЧВК для взятия квеста престижа. */
  minLevel?: number;
  /** id квеста «Новое начало» в EFT_QUESTS (кросс-линк на карту квестов). */
  questId?: string;
  /** Запланирован разработчиками, в игре пока недоступен. */
  planned?: boolean;
  requirements: PrestigeRequirement[];
  rewards: string[];
}

export const PRESTIGE_RESETS = [
  'Уровень персонажа (до 1)',
  'Схрон и деньги',
  'Убежище',
  'Прогресс квестов',
  'Инвентарь (кроме переносимого снаряжения)',
];

export const PRESTIGE_KEEPS = [
  'Статистика профиля',
  'Достижения',
  'Уровни престижа (навсегда, не сбрасываются сезонами)',
  'Прогресс Armory (Arena)',
  'Часть навыков и мастерства оружия (%)',
  'Выбранное снаряжение (объём растёт с каждым престижем)',
];

// Общие награды каждого престижа (растут косметикой от уровня к уровню).
const COMMON_REWARDS = [
  'Эмблема престижа у никнейма (перманентно)',
  '+1 ежедневное и +1 еженедельное задание',
  '+1 уровень Харизмы в начале каждого сезона',
  'Косметика: армбанд, жесты, стили убежища',
  'Специальное холодное оружие',
  'Достижение',
];

export const PRESTIGE_LEVELS: PrestigeLevel[] = [
  {
    level: 1,
    minLevel: 25,
    questId: '6761f28a022f60bb320f3e95',
    requirements: [
      { label: 'Уровень ЧВК 25+', minLevel: 25 },
      { label: 'Квест «Новое начало» у Барахольщика:' },
      { label: 'Убить Диких' },
      { label: 'Посетить Лабораторию и выжить' },
      { label: 'Сдать фигурки: боец BEAR, Дикий, Килла, Прапор — по 1 шт.' },
    ],
    rewards: COMMON_REWARDS,
  },
  {
    level: 2,
    minLevel: 30,
    questId: '6761ff17cdc36bd66102e9d0',
    requirements: [
      { label: 'Престиж 1 + уровень ЧВК 30+', minLevel: 30 },
      { label: 'Квест «Новое начало» (2):' },
      { label: 'Убить бойцов ЧВК' },
      { label: 'Посетить Лабораторию и выжить' },
      { label: 'Сдать фигурки (найденные в рейде): BEAR, Дикий, Килла, Прапор — по 2 шт.' },
    ],
    rewards: COMMON_REWARDS,
  },
  {
    level: 3,
    minLevel: 35,
    questId: '6848100b00afffa81f09e365',
    requirements: [
      { label: 'Престиж 2 + уровень ЧВК 35+', minLevel: 35 },
      { label: 'Квест «Новое начало» (3):' },
      { label: 'Убить бойцов ЧВК и Рейдеров' },
      { label: 'Совершить переход Лаборатория → Улицы Таркова' },
      { label: 'Выжить и выйти на Улицах Таркова' },
      { label: 'Сдать фигурки (найденные в рейде): BEAR, Дикий, Килла, Прапор — по 3 шт.' },
    ],
    rewards: COMMON_REWARDS,
  },
  {
    level: 4,
    minLevel: 40,
    questId: '68481881f43abfdda2058369',
    requirements: [
      { label: 'Престиж 3 + уровень ЧВК 40+', minLevel: 40 },
      { label: 'Квест «Новое начало» (4):' },
      { label: 'Убить бойцов ЧВК и Отступников' },
      { label: 'Переходы: Лаборатория → Улицы Таркова → Развязка' },
      { label: 'Сдать лимитированную фигурку из Лабиринта (найденную в рейде)' },
      { label: 'Сдать фигурки (найденные в рейде): BEAR, Дикий, Килла, Прапор — по 3 шт.' },
    ],
    rewards: COMMON_REWARDS,
  },
  {
    level: 5,
    planned: true,
    requirements: [
      { label: 'Запланирован разработчиками — требования не объявлены (иконка уже в клиенте игры)' },
    ],
    rewards: ['Появятся с вводом престижа в игру'],
  },
  {
    level: 6,
    planned: true,
    requirements: [
      { label: 'Запланирован разработчиками — требования не объявлены (иконка уже в клиенте игры)' },
    ],
    rewards: ['Появятся с вводом престижа в игру'],
  },
];

// ── Визуальные награды престижа (WebP). big = showcase-рендеры, small = grid-косметика.
// Кросс-уровневый маппинг item→престиж пока не заведён — секция показывает весь набор.
export const PRESTIGE_SHOWCASE: string[] = [
  '/icons/eft/prestige/reward/big/67673232a49c2307370ea305.webp',
  '/icons/eft/prestige/reward/big/67673239b3ee94a38c056c27.webp',
  '/icons/eft/prestige/reward/big/6767323ff6f30887d5038c38.webp',
  '/icons/eft/prestige/reward/big/67673244378a51df670bc6c8.webp',
  '/icons/eft/prestige/reward/big/676732538073dabc2e06df28.webp',
  '/icons/eft/prestige/reward/big/676732574ae0a2016608ebd7.webp',
  '/icons/eft/prestige/reward/big/6767325b9680f649230b1c89.webp',
  '/icons/eft/prestige/reward/big/676732609b1325e747028435.webp',
  '/icons/eft/prestige/reward/big/67673265a49c2307370ea307.webp',
  '/icons/eft/prestige/reward/big/6767326b276497e8c60a7e68.webp',
  '/icons/eft/prestige/reward/big/676732768073dabc2e06df29.webp',
  '/icons/eft/prestige/reward/big/67673283aa94e661930dadfc.webp',
  '/icons/eft/prestige/reward/big/6767328e276497e8c60a7e69.webp',
  '/icons/eft/prestige/reward/big/676732928073dabc2e06df2a.webp',
  '/icons/eft/prestige/reward/big/676732974fe29db8170e5a09.webp',
  '/icons/eft/prestige/reward/big/6767329bed053537070a13d5.webp',
  '/icons/eft/prestige/reward/big/676aaff96fd0e0b7f20715db.webp',
  '/icons/eft/prestige/reward/big/676c7ff49767102f9807a17a.webp',
  '/icons/eft/prestige/reward/big/676c7ffa005e2661180b0d5c.webp',
  '/icons/eft/prestige/reward/big/676c8005fa48d79dfa063bce.webp',
  '/icons/eft/prestige/reward/big/683db41d9248b507f60a19c6.webp',
  '/icons/eft/prestige/reward/big/683db42b4c69f3a07408fc3f.webp',
  '/icons/eft/prestige/reward/big/683db43a8abee978cc0b310c.webp',
  '/icons/eft/prestige/reward/big/683db44168d0c86684039740.webp',
  '/icons/eft/prestige/reward/big/683db45c7db340a9a202f952.webp',
  '/icons/eft/prestige/reward/big/683db462d079529a0907a7ff.webp',
  '/icons/eft/prestige/reward/big/683db46b2c255eb9220a3495.webp',
  '/icons/eft/prestige/reward/big/683db4773b269cb0d201af74.webp',
  '/icons/eft/prestige/reward/big/683db5d355241b17d40de945.webp',
  '/icons/eft/prestige/reward/big/683db5f5675dbd613909cac1.webp',
  '/icons/eft/prestige/reward/big/683db62557f38ea79c0073e5.webp',
  '/icons/eft/prestige/reward/big/683db6d5bc09186e3502392a.webp',
  '/icons/eft/prestige/reward/big/683db75f3102b7f7030b0e0a.webp',
  '/icons/eft/prestige/reward/big/683db767774e9c6edc0e878a.webp',
  '/icons/eft/prestige/reward/big/683db774f014f6c51008371a.webp',
  '/icons/eft/prestige/reward/big/683db77bdc5dfe2acd0debca.webp',
  '/icons/eft/prestige/reward/big/683db7f2a8ab4447590fef6c.webp',
  '/icons/eft/prestige/reward/big/684abd7e93163fb11c02e2fa.webp',
  '/icons/eft/prestige/reward/big/684abd87ed4bb101840211ea.webp',
  '/icons/eft/prestige/reward/big/684abd91b59b2cdfc10ce74a.webp',
  '/icons/eft/prestige/reward/big/684abd982968803c700d002b.webp',
];

export const PRESTIGE_COSMETICS: string[] = [
  '/icons/eft/prestige/reward/small/676733dca49c2307370ea30f.webp',
  '/icons/eft/prestige/reward/small/676733e15b13f778d10f194e.webp',
  '/icons/eft/prestige/reward/small/676733e5276497e8c60a7e6d.webp',
  '/icons/eft/prestige/reward/small/676733ea1814da542d050f2c.webp',
  '/icons/eft/prestige/reward/small/676733fb8073dabc2e06df2c.webp',
  '/icons/eft/prestige/reward/small/676733ff4fe29db8170e5a0f.webp',
  '/icons/eft/prestige/reward/small/6767340793816ce19c0c8660.webp',
  '/icons/eft/prestige/reward/small/6767340bed053537070a13da.webp',
  '/icons/eft/prestige/reward/small/67673412a49c2307370ea310.webp',
  '/icons/eft/prestige/reward/small/6767341d5b13f778d10f1950.webp',
  '/icons/eft/prestige/reward/small/676734278073dabc2e06df2d.webp',
  '/icons/eft/prestige/reward/small/6767342c4fe29db8170e5a10.webp',
  '/icons/eft/prestige/reward/small/67673431a49c2307370ea311.webp',
  '/icons/eft/prestige/reward/small/676734355b13f778d10f1951.webp',
  '/icons/eft/prestige/reward/small/67673438276497e8c60a7e6f.webp',
  '/icons/eft/prestige/reward/small/6767343d9680f649230b1c8f.webp',
  '/icons/eft/prestige/reward/small/676ab01ff444b79e7306741b.webp',
  '/icons/eft/prestige/reward/small/676c801645d80f6cea04f0bc.webp',
  '/icons/eft/prestige/reward/small/676c801b77d346999f0ac3b1.webp',
  '/icons/eft/prestige/reward/small/676c801f9767102f9807a17b.webp',
  '/icons/eft/prestige/reward/small/683db7bff014f6c51008371b.webp',
  '/icons/eft/prestige/reward/small/683db7d03102b7f7030b0e0b.webp',
  '/icons/eft/prestige/reward/small/683db7dc4efbd1959b0039ac.webp',
  '/icons/eft/prestige/reward/small/683db7f2a8ab4447590fef6c.webp',
  '/icons/eft/prestige/reward/small/683db7f9dc5dfe2acd0debcc.webp',
  '/icons/eft/prestige/reward/small/683db800bc09186e3502392d.webp',
  '/icons/eft/prestige/reward/small/683db80a164933a0450b3bad.webp',
  '/icons/eft/prestige/reward/small/683db9ce433949ccc70ccdf9.webp',
  '/icons/eft/prestige/reward/small/683db9d2f014f6c51008371d.webp',
  '/icons/eft/prestige/reward/small/683db9e43102b7f7030b0e0d.webp',
  '/icons/eft/prestige/reward/small/683db9f14efbd1959b0039ae.webp',
  '/icons/eft/prestige/reward/small/683dba06dc5dfe2acd0debce.webp',
  '/icons/eft/prestige/reward/small/6842ca183a9cb5e0a609b26c.webp',
  '/icons/eft/prestige/reward/small/6842ca1eb2ac2ad20403f949.webp',
  '/icons/eft/prestige/reward/small/6842ca2412825ba65b0c9f88.webp',
  '/icons/eft/prestige/reward/small/6842ca292a5c207ec7024bfa.webp',
  '/icons/eft/prestige/reward/small/684abda5ad66a32a180a7395.webp',
  '/icons/eft/prestige/reward/small/684abdc9ad66a32a180a7398.webp',
  '/icons/eft/prestige/reward/small/684abdd07b2090d3020a1d19.webp',
  '/icons/eft/prestige/reward/small/684abdd6e361378c540d21e9.webp',
];

// ── Геймификация: трекуемые цели престижа («Путь к Престижу»).
// kind='level' — авто-чек по телеметрии; 'flag' — ручной чекпойнт; 'count' — тап-счётчик.
// Только престижи 1-4 (у 5-6 нет квестов). Ключи id стабильны — не переименовывать.
export type PrestigeObjective =
  | { id: string; kind: 'level'; label: string; minLevel: number }
  | { id: string; kind: 'flag'; label: string }
  | { id: string; kind: 'count'; label: string; target: number; items?: string[] };

export const PRESTIGE_OBJECTIVES: Record<number, PrestigeObjective[]> = {
  1: [
    { id: 'lvl', kind: 'level', label: 'Уровень ЧВК 25', minLevel: 25 },
    { id: 'scavs', kind: 'flag', label: 'Убить Диких' },
    { id: 'lab', kind: 'flag', label: 'Лаборатория: выжить' },
    { id: 'figs', kind: 'count', label: 'Фигурки: BEAR/Дикий/Килла/Прапор', target: 4 , items: ['655c652d60d0ac437100fed7', '655c673673a43e23e857aebd', '66572c82ad599021091c6118', '68f25c64b2b53abd200b954f'] },
  ],
  2: [
    { id: 'lvl', kind: 'level', label: 'Уровень ЧВК 30', minLevel: 30 },
    { id: 'pmc', kind: 'flag', label: 'Убить бойцов ЧВК' },
    { id: 'lab', kind: 'flag', label: 'Лаборатория: выжить' },
    { id: 'figs', kind: 'count', label: 'Фигурки (по 2, найденные в рейде)', target: 8 , items: ['655c652d60d0ac437100fed7', '655c673673a43e23e857aebd', '66572c82ad599021091c6118', '68f25c64b2b53abd200b954f'] },
  ],
  3: [
    { id: 'lvl', kind: 'level', label: 'Уровень ЧВК 35', minLevel: 35 },
    { id: 'pmc', kind: 'flag', label: 'Убить ЧВК и Рейдеров' },
    { id: 'transit', kind: 'flag', label: 'Переход Лаборатория → Улицы' },
    { id: 'streets', kind: 'flag', label: 'Выжить и выйти на Улицах' },
    { id: 'figs', kind: 'count', label: 'Фигурки (по 3, найденные в рейде)', target: 12 , items: ['655c652d60d0ac437100fed7', '655c673673a43e23e857aebd', '66572c82ad599021091c6118', '68f25c64b2b53abd200b954f'] },
  ],
  4: [
    { id: 'lvl', kind: 'level', label: 'Уровень ЧВК 40', minLevel: 40 },
    { id: 'pmc', kind: 'flag', label: 'Убить ЧВК и Отступников' },
    { id: 'transit', kind: 'flag', label: 'Переходы: Лаба → Улицы → Развязка' },
    { id: 'labyrinth', kind: 'count', label: 'Лимитированная фигурка (Лабиринт)', target: 1 },
    { id: 'figs', kind: 'count', label: 'Фигурки (по 3, найденные в рейде)', target: 12 , items: ['655c652d60d0ac437100fed7', '655c673673a43e23e857aebd', '66572c82ad599021091c6118', '68f25c64b2b53abd200b954f'] },
  ],
};

/** Есть ли отслеживаемый путь к следующему престижу (квесты только у 1-4). */
export const PRESTIGE_MAX_ACTIVE = 4;


// Реальные предметы-фигурки для целей престижа (есть в каталоге → страница + «где найти»).
export const PRESTIGE_FIGURINE_NAMES: Record<string, string> = {
  '655c652d60d0ac437100fed7': 'BEAR',
  '655c673673a43e23e857aebd': 'Дикий',
  '66572c82ad599021091c6118': 'Килла',
  '68f25c64b2b53abd200b954f': 'Прапор',
};

/** Все id, которые надо резолвить в slug для линков (API /api/eft/prestige-items). */
export const PRESTIGE_LINKABLE_ITEM_IDS: string[] = Object.keys(PRESTIGE_FIGURINE_NAMES);
