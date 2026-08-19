// Маппинг Id навыка EFT → категория + путь к иконке (арт V4DYA из public/images/character/skills).
// Чистый модуль (§4.7): разметка секции навыков читает отсюда, сама ничего не решает.
//
// Категории: physical / mental → *.webp (kebab-case);
//            practical / combat → *.webp (snake_case, арт V4DYA — desktop.ini игнор).
//
// Навык без записи здесь (Особые/редкие, нет файла) → рендерится в безиконочном списке «Прочие навыки».
// Id — как в profile.json (skills.Common[].Id).

export type SkillCat = 'physical' | 'mental' | 'practical' | 'combat';

export interface SkillIcon {
  cat: SkillCat;
  /** Абсолютный путь под /public. */
  src: string;
}

const P = '/images/character/skills';

export const SKILL_ICONS: Record<string, SkillIcon> = {
  // ── Физические ─────────────────────────────────────────────
  Endurance: { cat: 'physical', src: `${P}/physical/endurance.webp` },
  Strength: { cat: 'physical', src: `${P}/physical/strength.webp` },
  Vitality: { cat: 'physical', src: `${P}/physical/vitality.webp` },
  Health: { cat: 'physical', src: `${P}/physical/health.webp` },
  Immunity: { cat: 'physical', src: `${P}/physical/immunity.webp` },
  Metabolism: { cat: 'physical', src: `${P}/physical/metabolism.webp` },
  StressResistance: { cat: 'physical', src: `${P}/physical/stress-resistance.webp` },

  // ── Ментальные ─────────────────────────────────────────────
  Perception: { cat: 'mental', src: `${P}/mental/perception.webp` },
  Intellect: { cat: 'mental', src: `${P}/mental/intellect.webp` },
  Attention: { cat: 'mental', src: `${P}/mental/attention.webp` },
  Charisma: { cat: 'mental', src: `${P}/mental/charisma.webp` },
  Memory: { cat: 'mental', src: `${P}/mental/memory.webp` },

  // ── Практические ───────────────────────────────────────────
  Search: { cat: 'practical', src: `${P}/practical/search.webp` },
  MagDrills: { cat: 'practical', src: `${P}/practical/mag-drills.webp` },
  Crafting: { cat: 'practical', src: `${P}/practical/crafting.webp` },
  Surgery: { cat: 'practical', src: `${P}/practical/surgery.webp` },
  HideoutManagement: { cat: 'practical', src: `${P}/practical/hideout-management.webp` },
  CovertMovement: { cat: 'practical', src: `${P}/practical/covet-movement.webp` },
  // Обслуживание оружия — практический навык (файл weapon-maintenance.webp).
  WeaponTreatment: { cat: 'practical', src: `${P}/practical/weapon-maintenance.webp` },
  // Иконки V4DYA (practical, snake_case webp). Броня/медицина/аукционы/взлом.
  HeavyVests: { cat: 'practical', src: `${P}/practical/heavy_armor.webp` },
  LightVests: { cat: 'practical', src: `${P}/practical/light_armor.webp` },
  FirstAid: { cat: 'practical', src: `${P}/practical/basic_medical.webp` },
  FieldMedicine: { cat: 'practical', src: `${P}/practical/field_medical.webp` },
  Auctions: { cat: 'practical', src: `${P}/practical/auctions.webp` },
  Lockpicking: { cat: 'practical', src: `${P}/practical/lockpicking.webp` },
  // Новые practical-иконки V4DYA. ⚠ Id — предположительные (по имени файла): выверить
  // против живого профиля (skills.Common[].Id), полного сэмпла с этими навыками пока нет.
  CleanOperations: { cat: 'practical', src: `${P}/practical/clean_operations.webp` },
  SilentOperations: { cat: 'practical', src: `${P}/practical/silent_operations.webp` },
  NightOperations: { cat: 'practical', src: `${P}/practical/night_operations.webp` },
  ShadowConnections: { cat: 'practical', src: `${P}/practical/shadow_connections.webp` },
  TaskPerformance: { cat: 'practical', src: `${P}/practical/task_performance.webp` },
  EquipmentManagement: { cat: 'practical', src: `${P}/practical/equipment_management.webp` },
  ElectronicHacking: { cat: 'practical', src: `${P}/practical/electronic_hacking.webp` },

  // ── Боевые (combat/*.webp, snake_case) ─────────────────────
  Sniper: { cat: 'combat', src: `${P}/combat/sniper_rifles.webp` },
  Assault: { cat: 'combat', src: `${P}/combat/assault_rifles.webp` },
  Pistol: { cat: 'combat', src: `${P}/combat/pistols.webp` },
  Revolver: { cat: 'combat', src: `${P}/combat/revolvers.webp` },
  SMG: { cat: 'combat', src: `${P}/combat/smgs.webp` },
  LMG: { cat: 'combat', src: `${P}/combat/lmgs.webp` },
  HMG: { cat: 'combat', src: `${P}/combat/hmgs.webp` },
  Shotgun: { cat: 'combat', src: `${P}/combat/shotguns.webp` },
  DMR: { cat: 'combat', src: `${P}/combat/dmrs.webp` },
  Throwing: { cat: 'combat', src: `${P}/combat/grenades.webp` },
  Melee: { cat: 'combat', src: `${P}/combat/melee.webp` },
  Launcher: { cat: 'combat', src: `${P}/combat/launchers.webp` },
  GrenadeLauncher: { cat: 'combat', src: `${P}/combat/launchers.webp` },
  Troubleshooting: { cat: 'combat', src: `${P}/combat/troubleshooting.webp` },
  WeaponDrawing: { cat: 'combat', src: `${P}/combat/weapon_drawing.webp` },
  WeaponSwitch: { cat: 'combat', src: `${P}/combat/weapon_switch.webp` },
  UGL: { cat: 'combat', src: `${P}/combat/ugls.webp` },
  // Реальные Id из профиля (фикс регистра/имён): подствольник + устранение неполадок.
  AttachedLauncher: { cat: 'combat', src: `${P}/combat/ugls.webp` },
  TroubleShooting: { cat: 'combat', src: `${P}/combat/troubleshooting.webp` },

  // ── Иконки в корне skills/ (не в категорийной подпапке) ────
  // Стрельба — общий боевой навык (иконка shooting.webp).
  AimDrills: { cat: 'combat', src: `${P}/shooting.webp` },
  // ⚠ Издаваемый шум (bot_sound.webp) — Id/RU/категория предположительные, выверить по живому профилю.
  BotSound: { cat: 'practical', src: `${P}/bot_sound.webp` },
};

/** Порядок и RU-заголовки категорий (для микро-подзаголовков секции). */
export const SKILL_CAT_ORDER: ReadonlyArray<{ cat: SkillCat; label: string }> = [
  { cat: 'physical', label: 'Физические' },
  { cat: 'mental', label: 'Ментальные' },
  { cat: 'practical', label: 'Практические' },
  { cat: 'combat', label: 'Боевые' },
];

// RU-имена навыков (зеркалит SKILL_RU из ProfileStats + добивает combat/особые).
// Незнакомый Id → показываем сам Id (§4.5).
export const SKILL_RU: Record<string, string> = {
  Endurance: 'Выносливость',
  Strength: 'Сила',
  Vitality: 'Живучесть',
  Health: 'Здоровье',
  StressResistance: 'Стрессоустойчивость',
  Metabolism: 'Метаболизм',
  Immunity: 'Иммунитет',
  Perception: 'Восприятие',
  Intellect: 'Интеллект',
  Attention: 'Внимание',
  Charisma: 'Харизма',
  Memory: 'Память',
  Search: 'Поиск',
  MagDrills: 'Работа с магазинами',
  Crafting: 'Крафт',
  Surgery: 'Хирургия',
  HideoutManagement: 'Управление убежищем',
  CovertMovement: 'Скрытность',
  WeaponTreatment: 'Обслуживание оружия',
  Sniper: 'Снайпинг',
  Assault: 'Штурмовые винтовки',
  AimDrills: 'Стрельба',
  Recoil: 'Контроль отдачи',
  FirstAid: 'Первая помощь',
  FieldMedicine: 'Полевая медицина',
  Throwing: 'Метание',
  MedicalStim: 'Стимуляторы',
  ProneMovement: 'Ползание',
  Sprinting: 'Спринт',
  BodyBuilding: 'Бодибилдинг',
  Freetrading: 'Торговля',
  Auctions: 'Аукционы',
  Pistol: 'Пистолеты',
  Revolver: 'Револьверы',
  SMG: 'ПП',
  LMG: 'Пулемёты',
  HMG: 'Крупнокалиберные пулемёты',
  Shotgun: 'Дробовики',
  DMR: 'Марксманские винтовки',
  Melee: 'Ближний бой',
  Launcher: 'Гранатомёты',
  GrenadeLauncher: 'Гранатомёты',
  UGL: 'Подствольники',
  Troubleshooting: 'Ремонт оружия',
  WeaponDrawing: 'Извлечение оружия',
  WeaponSwitch: 'Смена оружия',
  TroubleShooting: 'Устранение неполадок',
  AttachedLauncher: 'Подствольные гранатомёты',
  HeavyVests: 'Тяжёлые бронежилеты',
  LightVests: 'Лёгкие бронежилеты',
  Lockpicking: 'Взлом замков',
  // Новые practical-навыки (RU предварительный — выверить вместе с Id).
  CleanOperations: 'Чистая работа',
  SilentOperations: 'Тихая работа',
  NightOperations: 'Ночная работа',
  ShadowConnections: 'Теневые связи',
  TaskPerformance: 'Исполнительность',
  EquipmentManagement: 'Управление снаряжением',
  ElectronicHacking: 'Электронный взлом',
  BotSound: 'Издаваемый шум', // ⚠ выверить Id/RU по живому профилю
};

/**
 * Канонический список навыков для РУЧНОГО редактора (Слой C): все известные навыки по категориям,
 * БЕЗ алиасов-дублей (Launcher, не GrenadeLauncher; UGL, не AttachedLauncher; TroubleShooting).
 * Только id с иконкой (SKILL_ICONS) и RU-именем (SKILL_RU) — гарантия рендера. Порядок категорий —
 * SKILL_CAT_ORDER; уровни оверлеятся из профиля, отсутствующие = 0.
 * ⚠ Выверить против реального полного профиля на Слое C (живого сэмпла с полным набором пока нет).
 */
export const SKILL_CATALOG: Readonly<Record<SkillCat, readonly string[]>> = {
  physical: ['Endurance', 'Strength', 'Vitality', 'Health', 'Immunity', 'Metabolism', 'StressResistance'],
  mental: ['Perception', 'Intellect', 'Attention', 'Charisma', 'Memory'],
  practical: [
    'Search', 'MagDrills', 'Crafting', 'Surgery', 'HideoutManagement', 'CovertMovement',
    'WeaponTreatment', 'LightVests', 'HeavyVests', 'FirstAid', 'FieldMedicine', 'Auctions', 'Lockpicking',
    // ⚠ Id предварительные — выверить против живого профиля.
    'CleanOperations', 'SilentOperations', 'NightOperations', 'ShadowConnections',
    'TaskPerformance', 'EquipmentManagement', 'ElectronicHacking', 'BotSound',
  ],
  combat: [
    'Assault', 'Sniper', 'Pistol', 'Revolver', 'SMG', 'Shotgun', 'DMR', 'LMG', 'HMG',
    'Launcher', 'UGL', 'Throwing', 'Melee', 'WeaponDrawing', 'WeaponSwitch', 'TroubleShooting',
    'AimDrills',
  ],
};
