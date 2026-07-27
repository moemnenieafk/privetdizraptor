/**
 * Медицинские эффекты медикаментов EFT — СЛОВАРЬ ПОДАЧИ + сборка блока.
 *
 * Данные (типы эффектов, шансы, длительности, цены снятия в HP) живут в нашем
 * зеркале: `properties_raw.medEffects`, залито из игровой базы SPT скриптом
 * scripts/dump-med-effects-spt.mjs. Здесь только презентация — как назвать
 * `SkillRate/Endurance` по-русски, какой иконкой показать и в какую колонку
 * положить. Новый медикамент подхватывается автоматически: цифры приезжают
 * с дампом, подписи берутся отсюда.
 *
 * Иконки — ГОЛЫЕ имена классов из src/styles/icons.css, без размерных утилит:
 * размер задаёт компонент, иначе строки попадут под сканер Tailwind.
 */

export type EffectPolarity = 'positive' | 'negative';
export type TileAccent = 'success' | 'warning' | 'neutral';

/* ─── Сырьё из зеркала (properties_raw.medEffects) ─── */

export interface MedEffectDamage {
  effect: string;
  cost: number;
  delay: number;
  duration: number;
  healthPenaltyMin: number | null;
  healthPenaltyMax: number | null;
}

export interface MedEffectHealth {
  resource: string;
  value: number;
}

export interface MedEffectBuff {
  type: string;
  skill: string | null;
  chance: number;
  delay: number;
  duration: number;
  value: number;
  absolute: boolean;
}

export interface MedEffectsRaw {
  /** `__typename` предмета — подставляет маппер карточки, от него зависят плитки и заголовки групп. */
  typename: string;
  /** MedKit — запас HP аптечки; остальные типы — количество применений (0 = одноразовый). */
  hpResource: number;
  hpPerUse: number;
  useTime: number;
  damage: MedEffectDamage[];
  health: MedEffectHealth[];
  buffs: MedEffectBuff[];
}

/* ─── Форма для рендера ─── */

export interface MedicalTile {
  icon: string;
  label: string;
  value: string;
  valueAlt?: string;
  note?: string;
  accent: TileAccent;
}

export interface MedicalRow {
  icon: string;
  label: string;
  note?: string;
  value?: string;
}

export interface MedicalGroup {
  title: string;
  polarity: EffectPolarity;
  column: 'left' | 'right';
  rows: MedicalRow[];
}

export interface MedicalEffects {
  tiles: MedicalTile[];
  groups: MedicalGroup[];
}

/* ─── Словари подачи ─── */

/**
 * Состояния из `effects_damage`. `order` — порядок вывода по макету: игра отдаёт
 * ключи в своём порядке, а список должен читаться одинаково на всех медикаментах.
 */
const DAMAGE_DICT: Record<string, { label: string; icon: string; order: number }> = {
  LightBleeding: { label: 'Кровотечение', icon: 'icon-eft-effect-light-bleeding', order: 1 },
  HeavyBleeding: { label: 'Сильное кровотечение', icon: 'icon-eft-effect-heavy-bleeding', order: 2 },
  Fracture: { label: 'Перелом', icon: 'icon-eft-effect-fracture', order: 3 },
  Contusion: { label: 'Контузия', icon: 'icon-eft-effect-concussion', order: 4 },
  Pain: { label: 'Боль', icon: 'icon-eft-effect-pain', order: 5 },
  RadExposure: { label: 'Радиационное поражение', icon: 'icon-eft-effect-radiation', order: 6 },
  Intoxication: { label: 'Отравление', icon: 'icon-eft-effect-poisoning', order: 7 },
  DestroyedPart: {
    label: 'Восстанавливает уничтоженные конечности',
    icon: 'icon-eft-effect-recover-destroyed-body-part',
    order: 8,
  },
};

/** Мгновенные шкалы из `effects_health`. */
const HEALTH_DICT: Record<string, { label: string; icon: string }> = {
  Energy: { label: 'Энергия', icon: 'icon-eft-effect-energy' },
  Hydration: { label: 'Гидрация', icon: 'icon-eft-effect-hydration' },
};

/** Навыки (SkillName у баффов типа SkillRate). */
const SKILL_DICT: Record<string, { label: string; icon: string }> = {
  Attention: { label: 'Внимательность', icon: 'icon-eft-skill-attention' },
  Charisma: { label: 'Харизма', icon: 'icon-eft-skill-charisma' },
  Endurance: { label: 'Выносливость', icon: 'icon-eft-skill-endurance' },
  Health: { label: 'Здоровье', icon: 'icon-eft-skill-health' },
  Immunity: { label: 'Иммунитет', icon: 'icon-eft-skill-immunity' },
  Intellect: { label: 'Интеллект', icon: 'icon-eft-skill-intellect' },
  MagDrills: { label: 'Заряжание магазинов', icon: 'icon-eft-skill-mag-drills' },
  Memory: { label: 'Память', icon: 'icon-eft-skill-memory' },
  Metabolism: { label: 'Метаболизм', icon: 'icon-eft-skill-metabolism' },
  Perception: { label: 'Восприятие', icon: 'icon-eft-skill-perception' },
  Strength: { label: 'Сила', icon: 'icon-eft-skill-strength' },
  StressResistance: { label: 'Стрессоустойчивость', icon: 'icon-eft-skill-stress-resistance' },
  Vitality: { label: 'Живучесть', icon: 'icon-eft-skill-vitality' },
};

interface BuffPresentation {
  label: string;
  /** Подпись, когда значение отрицательное (напр. «Снижает регенерацию здоровья»). */
  negativeLabel?: string;
  icon: string;
  /** Хвост после значения: «/ сек», «кг», «%». */
  unit?: string;
  /** Полярность не по знаку, а всегда такая (тремор, входящий урон). */
  force?: EffectPolarity;
  /** Значение не показываем (эффект-флаг). */
  flag?: boolean;
}

/** Типы стим-баффов (globals → Stimulator.Buffs[].BuffType). */
const BUFF_DICT: Record<string, BuffPresentation> = {
  HealthRate: {
    label: 'Регенерация здоровья',
    negativeLabel: 'Снижает регенерацию здоровья',
    icon: 'icon-eft-effect-regeneration',
    unit: ' / сек',
  },
  StaminaRate: { label: 'Восстановление выносливости', icon: 'icon-eft-effect-stamina-recovery', unit: ' / сек' },
  EnergyRate: { label: 'Восстановление энергии', icon: 'icon-eft-effect-energy', unit: ' / сек' },
  HydrationRate: { label: 'Восстановление гидрации', icon: 'icon-eft-effect-hydration', unit: ' / сек' },
  MaxStamina: { label: 'Запас выносливости', icon: 'icon-eft-effect-max-energy' },
  WeightLimit: { label: 'Лимит веса', icon: 'icon-eft-effect-buff-weight', unit: ' кг' },
  BodyTemperature: { label: 'Температура тела', icon: 'icon-eft-effect-temperature-default' },
  DamageModifier: { label: 'Входящий урон, кроме головы', icon: 'icon-eft-effect-damage-income-without-head', force: 'negative' },
  HandsTremor: { label: 'Тремор', icon: 'icon-eft-effect-hands-tremor', force: 'negative', flag: true },
  QuantumTunnelling: { label: 'Туннельное зрение', icon: 'icon-eft-effect-tunnel-vision', force: 'negative', flag: true },
  Contusion: { label: 'Контузия', icon: 'icon-eft-effect-concussion', force: 'negative', flag: true },
  Fracture: { label: 'Перелом', icon: 'icon-eft-effect-fracture', force: 'negative', flag: true },
  Pain: { label: 'Боль', icon: 'icon-eft-effect-pain', force: 'negative', flag: true },
  ZombieInfection: { label: 'Заражение', icon: 'icon-eft-effect-debuff', force: 'negative', flag: true },
  FrostbiteBuff: { label: 'Обморожение', icon: 'icon-eft-effect-temperature-low', force: 'negative', flag: true },
  UnknownToxin: { label: 'Неизвестный токсин', icon: 'icon-eft-effect-poisoning', force: 'negative', flag: true },
  LightBleeding: { label: 'Кровотечение', icon: 'icon-eft-effect-light-bleeding', force: 'negative', flag: true },
  HeavyBleeding: { label: 'Сильное кровотечение', icon: 'icon-eft-effect-heavy-bleeding', force: 'negative', flag: true },
  Antidote: { label: 'Антидот', icon: 'icon-eft-effect-poisoning', force: 'positive', flag: true },
  RemoveAllBloodLosses: {
    label: 'Останавливает все кровотечения',
    icon: 'icon-eft-effect-heavy-bleeding',
    force: 'positive',
    flag: true,
  },
};

/* ─── Форматтеры ─── */

// Без разделителя тысяч: в макете «+1800 HP», а не «+1 800 HP».
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, useGrouping: false });
const signed = (v: number) => `${v > 0 ? '+' : ''}${nf.format(v)}`;
const seconds = (v: number) => `${nf.format(v)} сек.`;

function minutes(sec: number): string {
  if (sec < 60) return seconds(sec);
  return `${nf.format(sec / 60)} мин.`;
}

/** Уточнение у строки: шанс срабатывания, а если он гарантированный — длительность. */
function buffNote(chance: number, duration: number): string | undefined {
  if (chance < 1) return `${Math.round(chance * 100)}% Шанс`;
  return duration > 0 ? seconds(duration) : undefined;
}

/* ─── Сборка ─── */

function buffRow(buff: MedEffectBuff): { row: MedicalRow; polarity: EffectPolarity } | null {
  const isSkill = buff.type === 'SkillRate';
  const preset = isSkill ? SKILL_DICT[buff.skill ?? ''] : BUFF_DICT[buff.type];
  if (!preset) return null;

  const flag = !isSkill && (preset as BuffPresentation).flag === true;
  const force = isSkill ? undefined : (preset as BuffPresentation).force;
  const unit = isSkill ? '' : ((preset as BuffPresentation).unit ?? '');
  const negativeLabel = isSkill ? undefined : (preset as BuffPresentation).negativeLabel;

  const polarity: EffectPolarity = force ?? (buff.value < 0 ? 'negative' : 'positive');
  const label = buff.value < 0 && negativeLabel ? negativeLabel : preset.label;

  // Не абсолютные значения — это доля: 0.2 → +20%.
  const value = flag ? undefined : buff.absolute ? `${signed(buff.value)}${unit}` : `${signed(buff.value * 100)}%`;

  return { row: { icon: preset.icon, label, note: buffNote(buff.chance, buff.duration), value }, polarity };
}

/**
 * Собирает блок «Медицинские эффекты» из зеркальных данных.
 * Раскладка колонок повторяет макеты MEDICAL_EFFECT: отрицательные всегда
 * справа; если их нет — справа уезжает «Добавляет».
 */
export function buildMedicalEffects(raw: MedEffectsRaw): MedicalEffects {
  const isMedKit = raw.typename === 'ItemPropertiesMedKit';
  const isSurgical = raw.typename === 'ItemPropertiesSurgicalKit';
  const isStim = raw.typename === 'ItemPropertiesStim';

  /* Плитки */
  const tiles: MedicalTile[] = [];

  if (isMedKit) {
    if (raw.hpResource > 0) {
      tiles.push({
        icon: 'icon-eft-health-regeneration',
        label: 'Восстановление',
        value: `+${nf.format(raw.hpResource)} HP`,
        accent: 'success',
      });
    }
    if (raw.hpPerUse > 0) {
      tiles.push({
        icon: 'icon-eft-quests-loot',
        label: 'За применение',
        value: `${nf.format(raw.hpPerUse)} HP`,
        accent: 'warning',
      });
    }
  } else if (isStim && raw.buffs.length > 0) {
    const duration = Math.max(...raw.buffs.map((b) => b.duration));
    const delay = Math.max(...raw.buffs.map((b) => b.delay));
    tiles.push({
      icon: 'icon-eft-time-effect',
      label: 'Длительность',
      note: delay > 0 ? `Задержка ${nf.format(delay)} сек` : 'Без задержки',
      valueAlt: seconds(duration),
      value: minutes(duration),
      accent: 'neutral',
    });
  } else {
    const uses = raw.hpResource > 0 ? raw.hpResource : 1;
    tiles.push({
      icon: 'icon-eft-quests-loot',
      label: 'Кол-во использований',
      value: `${uses}/${uses}`,
      accent: 'warning',
    });
  }

  if (raw.useTime > 0 && !isStim) {
    tiles.push({
      icon: 'icon-eft-time-effect',
      label: 'Время использования',
      value: seconds(raw.useTime),
      accent: 'neutral',
    });
  }

  /* Строки. Порядок «Добавляет» по макету: состояния → баффы → шкалы. */
  const cures: MedicalRow[] = [];
  const addsFromDamage: MedicalRow[] = [];
  const addsFromBuffs: MedicalRow[] = [];
  const addsFromHealth: MedicalRow[] = [];
  const negatives: MedicalRow[] = [];

  const damage = [...raw.damage].sort(
    (a, b) => (DAMAGE_DICT[a.effect]?.order ?? 99) - (DAMAGE_DICT[b.effect]?.order ?? 99),
  );

  for (const d of damage) {
    const preset = DAMAGE_DICT[d.effect];
    if (!preset) continue;

    // Восстановление конечности — это то, что набор ДАЁТ, а не снимает.
    if (d.effect === 'DestroyedPart') {
      addsFromDamage.push({ icon: preset.icon, label: preset.label });
      continue;
    }

    cures.push({ icon: preset.icon, label: preset.label, value: d.cost > 0 ? `${nf.format(d.cost)} HP` : undefined });

    // Обезболивающее не только снимает боль, но и вешает состояние на время.
    if (d.effect === 'Pain' && d.duration > 0) {
      addsFromDamage.push({
        icon: 'icon-eft-effect-on-painkillers',
        label: 'На болеутоляющих',
        value: seconds(d.duration),
      });
    }
  }

  if (isMedKit && raw.hpResource > 0) {
    addsFromDamage.push({ icon: 'icon-eft-effect-restore-hp', label: 'Восстановление HP' });
    if (raw.damage.some((d) => d.effect === 'HeavyBleeding')) {
      addsFromDamage.push({
        icon: 'icon-eft-effect-fresh-wound',
        label: 'Свежая рана',
        value: 'Если было сильное кровотечение',
      });
    }
  }

  for (const b of raw.buffs) {
    const built = buffRow(b);
    if (!built) continue;
    (built.polarity === 'negative' ? negatives : addsFromBuffs).push(built.row);
  }

  for (const h of raw.health) {
    const preset = HEALTH_DICT[h.resource];
    if (!preset) continue;
    const row: MedicalRow = { icon: preset.icon, label: preset.label, value: signed(h.value) };
    (h.value < 0 ? negatives : addsFromHealth).push(row);
  }

  const adds = [...addsFromDamage, ...addsFromBuffs, ...addsFromHealth];

  /* Колонки: отрицательные всегда справа, иначе справа уезжает «Добавляет». */
  const groups: MedicalGroup[] = [];
  const hasNegatives = negatives.length > 0;
  const addsTitle = isStim ? 'Положительные' : 'Добавляет';

  if (cures.length > 0) {
    groups.push({ title: isSurgical ? 'Лечит' : 'Снимает', polarity: 'positive', column: 'left', rows: cures });
  }
  if (adds.length > 0) {
    groups.push({
      title: addsTitle,
      polarity: 'positive',
      column: hasNegatives || cures.length === 0 ? 'left' : 'right',
      rows: adds,
    });
  }
  if (hasNegatives) {
    groups.push({
      title: isStim ? 'Отрицательные' : 'Отрицательные действия',
      polarity: 'negative',
      column: 'right',
      rows: negatives,
    });
  }

  return { tiles, groups };
}
