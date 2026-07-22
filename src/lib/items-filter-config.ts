// Пер-категорийная конфигурация фильтров каталога предметов.
// Импортируется клиентом. Декларирует, КАКИЕ контролы фильтра
// показывать в каждой UI-зоне и в каком порядке + доступные сортировки.
// Адаптивность: боевые категории берут DEFAULT, специфичные — свой профиль.
// Гейт поверх существующих рантайм-проверок (напр. armorClass всё равно
// показывается только для armor-категорий); конфиг может лишь ДОПОЛНИТЕЛЬНО скрыть.

import type { CategoryItemProperties } from '@/app/eft/items/[...category]/ItemsCategoryClient';

/** Все контролы фильтра. existing = уже есть стейт; NEW = добавляем в этой итерации. */
export type FilterControl =
  | 'search'             // existing — searchQuery (всегда виден)
  | 'armorClass'         // existing — activeArmorClasses (боевой)
  | 'barterOnly'         // existing — barterOnly
  | 'favorites'          // existing — favoritesOnly
  | 'availableOnly'      // existing — availableOnly
  | 'priceRange'         // existing — range-слайдер цены + переключатель валют
  | 'usedIn'             // NEW — чипы «используется в»: бартер / крафт / квест / GP-Реф
  | 'needMe'             // NEW — «нужно мне»: предмет нужен для незавершённых квестов
  | 'profitable';        // NEW — «только прибыльные»: маржа крафта/бартера > 0

/**
 * Кнопки «отображать только» — фиксированный набор для контрола `usedIn`.
 * iconClass = CSS-маска (тинтуется в цвет). tip = внятный тултип для обычного пользователя.
 */
export const USED_IN_OPTIONS = [
  { key: 'barter', label: 'Бартеры', iconClass: 'icon-eft-prog-barter', tip: 'Только предметы, которые используются в бартерах у торговцев' },
  { key: 'craft',  label: 'Крафты',  iconClass: 'icon-eft-prog-craft',  tip: 'Только предметы, нужные для крафтов в убежище' },
  { key: 'quest',  label: 'Квесты',  iconClass: 'icon-eft-quests', tip: 'Только предметы, которые требуются для заданий' },
  { key: 'gp',     label: 'GP-Реф',  iconClass: 'icon-eft-gpcoin',      tip: 'Только предметы, покупаемые за GP-монеты у торговца Реф' },
] as const;

export type UsedInKey = (typeof USED_IN_OPTIONS)[number]['key'];

/**
 * Опция «Выбор категорий» (иконочная плитка). Набор опций + принадлежность
 * предметов считаются СЕРВЕРНО (page.tsx → getSubcategoryMembership) из дерева
 * меню, а не хардкодятся здесь — работает для ЛЮБОГО неконечного раздела.
 */
export interface SubcatOption {
  /** slug дочерней категории (последний сегмент пути меню) */
  id: string;
  label: string;
  iconUrl: string;
  /** иконка со своей заливкой (напр. моды) → рендерить <img>, а не CSS-маску */
  preserveIconColor?: boolean;
}

// ─── Обобщённый enum-фасет (категорийный фильтр по перечислению) ────────────────
// Декларативная замена одноразовым рантайм-гейтам (caliber/armorClass): фасет
// описывается ДАННЫМИ (какое поле извлечь + как назвать значения), а рендер/фильтр —
// дженерик. Значение(я) достаём `extract(props)`; опции либо фиксированы (`options`),
// либо выводятся из данных (`labelMap` даёт RU-подписи известным значениям).

export interface EnumFacetOption {
  /** канонич. значение (то, что вернёт extract) */
  value: string;
  /** RU-подпись для UI */
  label: string;
}

export interface EnumFacet {
  /** стабильный id для стейта/сброса/счётчика (напр. 'grenadeType') */
  key: string;
  /** микро-заголовок блока / плейсхолдер дропдауна */
  label: string;
  /** где рендерить: чипы в панели «Фильтры» или выпадающий список */
  ui: 'chips' | 'dropdown';
  /** мульти-выбор (OR по выбранным) или одиночный */
  multi: boolean;
  /** извлечь значение(я) фасета из свойств предмета; null/[] = не участвует */
  extract: (p: CategoryItemProperties) => string | string[] | null;
  /** фикс-набор опций (с порядком/лейблами); если нет — выводятся из данных */
  options?: EnumFacetOption[];
  /** RU-подписи для авто-выведенных опций (value → label) */
  labelMap?: Record<string, string>;
  /** трансформ подписи авто-опции (напр. срезать префикс); приоритет над labelMap */
  labelFn?: (value: string) => string;
  /** кастомный порядок авто-опций (список value); не перечисленные — в конец по алфавиту */
  order?: string[];
}

export interface CategoryFilterConfig {
  /** контролы верхней панели (порядок = порядок отрисовки) */
  controlBar: FilterControl[];
  /** контролы раскрывающейся Advanced-панели */
  advanced: FilterControl[];
  /** доступные ключи сортировки (подмножество SORT_OPTIONS); порядок = порядок в дропдауне */
  sort: string[];
  /** категорийные enum-фасеты (рендер в панели «Фильтры»); пусто = нет */
  facets: EnumFacet[];
}

// ─── Определения фасетов ────────────────────────────────────────────────────────

const GRENADE_TYPE_RU: Record<string, string> = {
  Fragmentation: 'Осколочная',
  Smoke: 'Дымовая',
  Flash: 'Светошумовая',
  Impact: 'Ударная',
  Gas: 'Газовая',
  Distraction: 'Отвлекающая',
};

/** Гранаты → тип. Значения выводятся из данных, RU-подписи по карте (raw fallback). */
const GRENADE_TYPE_FACET: EnumFacet = {
  key: 'grenadeType',
  label: 'Тип гранаты',
  ui: 'chips',
  multi: true,
  extract: (p) => p.type ?? null,
  labelMap: GRENADE_TYPE_RU,
};

/** Броня/плиты → материал (Мягкая/Пластина). Вторая ось к классу брони. */
const ARMOR_MATERIAL_FACET: EnumFacet = {
  key: 'armorMaterial',
  label: 'Материал',
  ui: 'chips',
  multi: true,
  extract: (p) => p.armorType ?? null,
  options: [
    { value: 'Soft',  label: 'Мягкая' },
    { value: 'Plate', label: 'Пластина' },
  ],
};

/** Прицелы → макс. кратность, бакетами из zoomLevels (number[][]). */
const zoomBucket = (z?: number[][] | null): string | null => {
  if (!z || z.length === 0) return null;
  const max = Math.max(...z.flat());
  if (!Number.isFinite(max) || max <= 0) return null;
  if (max <= 1) return '1x';
  if (max <= 4) return '2-4x';
  return '6+';
};
const ZOOM_FACET: EnumFacet = {
  key: 'zoom',
  label: 'Кратность (макс.)',
  ui: 'chips',
  multi: true,
  extract: (p) => zoomBucket(p.zoomLevels),
  options: [
    { value: '1x',   label: '1x' },
    { value: '2-4x', label: '2–4x' },
    { value: '6+',   label: '6x+' },
  ],
};

// Порядок калибров в дропдауне — по боевой популярности EFT (не алфавит).
// Значения = сырые из tarkov.dev; не перечисленные (будущие) падают в конец по алфавиту.
const CALIBER_ORDER = [
  'Caliber556x45NATO', 'Caliber545x39', 'Caliber762x39', 'Caliber762x51', 'Caliber762x54R',
  'Caliber9x19PARA', 'Caliber12g', 'Caliber9x39', 'Caliber762x35', 'Caliber366TKM', 'Caliber68x51',
  'Caliber1143x23ACP', 'Caliber57x28', 'Caliber9x21', 'Caliber762x25TT', 'Caliber9x18PM',
  'Caliber9x18PMM', 'Caliber46x30', 'Caliber9x33R', 'Caliber86x70', 'Caliber127x55', 'Caliber93x64',
  'Caliber127x33', 'Caliber127x99', 'Caliber20g', 'Caliber23x75', 'Caliber725',
  'Caliber40x46', 'Caliber40mmRU', 'Caliber26x75', 'Caliber784x49', 'Caliber20x1mm',
];

/** Калибр (боеприпасы + стволы). Много значений → выпадающий список, одиночный выбор.
 *  Опции авто из данных, порядок — по популярности, подпись — срез префикса «Caliber». */
const CALIBER_FACET: EnumFacet = {
  key: 'caliber',
  label: 'Калибр',
  ui: 'dropdown',
  multi: false,
  extract: (p) => p.caliber ?? null,
  labelFn: (v) => v.replace('Caliber', '').trim(),
  order: CALIBER_ORDER,
};

/** Пробитие брони (патроны) — тиры-бакеты (игроки мыслят классами брони). */
const penBucket = (p?: number | null): string | null => {
  if (p == null || p <= 0) return null;
  if (p < 20) return 'lt20';
  if (p < 35) return '20-34';
  if (p < 45) return '35-44';
  return '45+';
};
const PEN_FACET: EnumFacet = {
  key: 'pen',
  label: 'Пробитие брони',
  ui: 'chips',
  multi: true,
  extract: (p) => penBucket(p.penetrationPower),
  options: [
    { value: 'lt20',  label: '<20' },
    { value: '20-34', label: '20–34' },
    { value: '35-44', label: '35–44' },
    { value: '45+',   label: '45+' },
  ],
};

/** Урон (патроны) — бакеты. */
const damageBucket = (d?: number | null): string | null => {
  if (d == null || d <= 0) return null;
  if (d < 40) return 'lt40';
  if (d < 60) return '40-59';
  if (d < 80) return '60-79';
  return '80+';
};
const DAMAGE_FACET: EnumFacet = {
  key: 'dmg',
  label: 'Урон',
  ui: 'chips',
  multi: true,
  extract: (p) => damageBucket(p.damage),
  options: [
    { value: 'lt40',  label: '<40' },
    { value: '40-59', label: '40–59' },
    { value: '60-79', label: '60–79' },
    { value: '80+',   label: '80+' },
  ],
};

/** Оружие: эргономика (выше — лучше). Пороги из распределения БД (p25≈40, p75≈65). */
const gunErgoBucket = (e?: number | null): string | null => {
  if (e == null || e <= 0) return null;
  if (e < 40) return 'lt40';
  if (e < 65) return '40-64';
  return '65+';
};
const GUN_ERGO_FACET: EnumFacet = {
  key: 'ergo',
  label: 'Эргономика',
  ui: 'chips',
  multi: true,
  extract: (p) => gunErgoBucket(p.ergonomics),
  options: [
    { value: 'lt40',  label: '<40' },
    { value: '40-64', label: '40–64' },
    { value: '65+',   label: '65+' },
  ],
};

/** Оружие: вертикальная отдача (ниже — лучше). Пороги из БД (p25≈100, p75≈300). */
const gunRecoilBucket = (r?: number | null): string | null => {
  if (r == null || r <= 0) return null;
  if (r < 100) return 'lt100';
  if (r < 200) return '100-199';
  return '200+';
};
const GUN_RECOIL_FACET: EnumFacet = {
  key: 'recoil',
  label: 'Отдача (верт.)',
  ui: 'chips',
  multi: true,
  extract: (p) => gunRecoilBucket(p.recoilVertical),
  options: [
    { value: 'lt100',   label: '<100' },
    { value: '100-199', label: '100–199' },
    { value: '200+',    label: '200+' },
  ],
};

/** Броня: прочность. Пороги из БД (p25≈40, p50≈60, p75≈170). */
const durabilityBucket = (d?: number | null): string | null => {
  if (d == null || d <= 0) return null;
  if (d < 50) return 'lt50';
  if (d < 100) return '50-99';
  return '100+';
};
const DURABILITY_FACET: EnumFacet = {
  key: 'dur',
  label: 'Прочность',
  ui: 'chips',
  multi: true,
  extract: (p) => durabilityBucket(p.durability),
  options: [
    { value: 'lt50',  label: '<50' },
    { value: '50-99', label: '50–99' },
    { value: '100+',  label: '100+' },
  ],
};

/** Моды: эргономика — МОДИФИКАТОР (±), поэтому бакеты по знаку (улучшает/нейтр/ухудшает). */
const modErgoBucket = (e?: number | null): string | null => {
  if (e == null) return null;
  if (e > 0) return 'imp';
  if (e < 0) return 'wor';
  return 'neu';
};
const MOD_ERGO_FACET: EnumFacet = {
  key: 'mergo',
  label: 'Эргономика',
  ui: 'chips',
  multi: true,
  extract: (p) => modErgoBucket(p.ergonomics),
  options: [
    { value: 'imp', label: 'Улучшает' },
    { value: 'neu', label: 'Нейтр.' },
    { value: 'wor', label: 'Ухудшает' },
  ],
};

/** Моды: отдача — модификатор всегда ≤0 (снижает или нет), поэтому бакеты по силе снижения. */
const modRecoilBucket = (r?: number | null): string | null => {
  if (r == null) return null;
  if (r <= -0.10) return 'strong';
  if (r < 0) return 'weak';
  return 'none';
};
const MOD_RECOIL_FACET: EnumFacet = {
  key: 'mrecoil',
  label: 'Снижение отдачи',
  ui: 'chips',
  multi: true,
  extract: (p) => modRecoilBucket(p.recoilModifier),
  options: [
    { value: 'strong', label: 'Сильно' },
    { value: 'weak',   label: 'Слабо' },
    { value: 'none',   label: 'Нет' },
  ],
};

// ЗАДЕЛ (не активен): Ключи → карта. Нет данных привязки в наших properties
// (tarkov.dev не кладёт карту на properties ключа — выводится из квестов/контейнеров).
// Требует mirror-таблицы key→map + синка (§4.11). Включить сюда, когда данные появятся.

// Реестр фасетов по слагу категории (мержится в конфиг в getFilterConfig).
// Патроны (раздел `ammo` + лист `rounds`): калибр → пробитие → урон.
const AMMO_FACETS: EnumFacet[] = [CALIBER_FACET, PEN_FACET, DAMAGE_FACET];

const CATEGORY_FACETS: Record<string, EnumFacet[]> = {
  grenades:   [GRENADE_TYPE_FACET],
  armor:      [ARMOR_MATERIAL_FACET, DURABILITY_FACET],
  components: [ARMOR_MATERIAL_FACET, DURABILITY_FACET],
  helmets:    [DURABILITY_FACET],
  sights:     [ZOOM_FACET],
  ammo:       AMMO_FACETS,
  rounds:     AMMO_FACETS,
};
// Стволы: калибр → эргономика → отдача (паритет со старым showCaliber; на ammo калибр задан выше).
for (const s of ['firearms', 'ar', 'bolt', 'carbine', 'dmr', 'gl', 'lmg', 'shotgun', 'sidearm', 'smg', 'guns']) {
  CATEGORY_FACETS[s] = [...(CATEGORY_FACETS[s] ?? []), CALIBER_FACET, GUN_ERGO_FACET, GUN_RECOIL_FACET];
}
// Все слаги модов (группировки + корень + листы). Используется и для мод-фасетов,
// и для гейта фильтра «Совместимо с оружием» (серверный map строится только на них).
export const MOD_SLUGS = [
  'mods', 'vitalparts', 'functional', 'elements',
  'muzzle', 'foregrips', 'stocks', 'handguards', 'barrels', 'bipods', 'charginghandles',
  'gasblocks', 'receivers', 'receivers-slides', 'pistolgrips', 'magazines', 'mounts',
  'laser', 'light-laser-devices', 'launchers', 'auxiliary', 'auxiliary-parts', 'sights',
];
// Моды: эрго-модификатор + снижение отдачи (пустые facet'ы на слаге скрываются авто).
for (const s of MOD_SLUGS) {
  CATEGORY_FACETS[s] = [...(CATEGORY_FACETS[s] ?? []), MOD_ERGO_FACET, MOD_RECOIL_FACET];
}

// ─── DEFAULT: применяется ко всем «конечным» категориям (без своего профиля) ──
// Полный современный фильтр: «Отображать только» (usedIn + нужно мне) + armorClass
// (только armor-категории) + избранное + доступно мне; advanced = диапазон цены + калибр.
export const DEFAULT_FILTER_CONFIG: CategoryFilterConfig = {
  controlBar: ['search', 'armorClass', 'usedIn', 'needMe', 'profitable', 'favorites'],
  advanced:   ['priceRange'],
  sort:       ['vps', 'sellTrader', 'sellFlea', 'margin', 'buyTrader', 'buyMin', 'weight', 'name', 'indicator'],
  facets:     [],
};

// ─── Профиль: «Предметы для бартера» ───────────────────────────────────────────
// Боевые контролы скрыты (нет class/caliber). «Выбор категорий» приходит серверно
// (как и на прочих неконечных разделах) — здесь только назначение + цена.
const BARTER_CONFIG: CategoryFilterConfig = {
  controlBar: ['search', 'usedIn', 'needMe', 'profitable', 'favorites'],
  advanced:   ['priceRange'],
  sort: ['vps', 'sellTrader', 'sellFlea', 'margin', 'buyTrader', 'weight', 'name'],
  facets: [],
};

const ITEMS_FILTER_CONFIG: Record<string, CategoryFilterConfig> = {
  barter: BARTER_CONFIG,
};

export const getFilterConfig = (slug: string): CategoryFilterConfig => {
  const base = ITEMS_FILTER_CONFIG[slug] ?? DEFAULT_FILTER_CONFIG;
  const facets = CATEGORY_FACETS[slug];
  // Мержим фасеты по слагу поверх базового конфига (без мутации константы).
  return facets ? { ...base, facets } : base;
};
