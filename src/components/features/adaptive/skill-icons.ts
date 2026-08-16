// Маппинг Id навыка EFT → категория + путь к иконке (арт V4DYA из public/images/character/skills).
// Чистый модуль (§4.7): разметка секции навыков читает отсюда, сама ничего не решает.
//
// Категории: physical / mental / practical → *.webp (kebab-case);
//            combat → skill_combat_*.png (провизорные, V4DYA переделает — combat/desktop.ini игнор).
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
  // Новые PNG-иконки V4DYA (practical). Броня/медицина/аукционы/взлом.
  HeavyVests: { cat: 'practical', src: `${P}/practical/skill_practical_heavyarmor.png` },
  LightVests: { cat: 'practical', src: `${P}/practical/skill_practical_lightarmor.png` },
  FirstAid: { cat: 'practical', src: `${P}/practical/skill_practical_basicmedical.png` },
  FieldMedicine: { cat: 'practical', src: `${P}/practical/skill_practical_fieldmedical.png` },
  Auctions: { cat: 'practical', src: `${P}/practical/skill_practical_auctions.png` },
  Lockpicking: { cat: 'practical', src: `${P}/practical/skill_practical_lockpicking.png` },

  // ── Боевые (combat/*.png провизорные) ──────────────────────
  Sniper: { cat: 'combat', src: `${P}/combat/skill_combat_sniperrifles.png` },
  Assault: { cat: 'combat', src: `${P}/combat/skill_combat_assaultrifles.png` },
  Pistol: { cat: 'combat', src: `${P}/combat/skill_combat_pistols.png` },
  Revolver: { cat: 'combat', src: `${P}/combat/skill_combat_revolvers.png` },
  SMG: { cat: 'combat', src: `${P}/combat/skill_combat_smgs.png` },
  LMG: { cat: 'combat', src: `${P}/combat/skill_combat_lmgs.png` },
  HMG: { cat: 'combat', src: `${P}/combat/skill_combat_hmgs.png` },
  Shotgun: { cat: 'combat', src: `${P}/combat/skill_combat_shotguns.png` },
  DMR: { cat: 'combat', src: `${P}/combat/skill_combat_dmrs.png` },
  Throwing: { cat: 'combat', src: `${P}/combat/skill_combat_grenades.png` },
  Melee: { cat: 'combat', src: `${P}/combat/skill_combat_melee.png` },
  Launcher: { cat: 'combat', src: `${P}/combat/skill_combat_launchers.png` },
  GrenadeLauncher: { cat: 'combat', src: `${P}/combat/skill_combat_launchers.png` },
  Troubleshooting: { cat: 'combat', src: `${P}/combat/skill_combat_troubleshooting.png` },
  WeaponDrawing: { cat: 'combat', src: `${P}/combat/skill_combat_weapondrawing.png` },
  WeaponSwitch: { cat: 'combat', src: `${P}/combat/skill_combat_weaponswitch.png` },
  UGL: { cat: 'combat', src: `${P}/combat/skill_combat_ugls.png` },
  // Реальные Id из профиля (фикс регистра/имён): подствольник + устранение неполадок.
  AttachedLauncher: { cat: 'combat', src: `${P}/combat/skill_combat_ugls.png` },
  TroubleShooting: { cat: 'combat', src: `${P}/combat/skill_combat_troubleshooting.png` },
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
  ],
  combat: [
    'Assault', 'Sniper', 'Pistol', 'Revolver', 'SMG', 'Shotgun', 'DMR', 'LMG', 'HMG',
    'Launcher', 'UGL', 'Throwing', 'Melee', 'WeaponDrawing', 'WeaponSwitch', 'TroubleShooting',
  ],
};
