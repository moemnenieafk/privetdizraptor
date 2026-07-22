// Пер-категорийная конфигурация фильтров каталога предметов.
// Data-only (импортируется клиентом). Декларирует, КАКИЕ контролы фильтра
// показывать в каждой UI-зоне и в каком порядке + доступные сортировки.
// Адаптивность: боевые категории берут DEFAULT, специфичные — свой профиль.
// Гейт поверх существующих рантайм-проверок (напр. armorClass всё равно
// показывается только для armor-категорий); конфиг может лишь ДОПОЛНИТЕЛЬНО скрыть.

/** Все контролы фильтра. existing = уже есть стейт; NEW = добавляем в этой итерации. */
export type FilterControl =
  | 'search'             // existing — searchQuery (всегда виден)
  | 'armorClass'         // existing — activeArmorClasses (боевой)
  | 'barterOnly'         // existing — barterOnly
  | 'favorites'          // existing — favoritesOnly
  | 'availableOnly'      // existing — availableOnly
  | 'priceRange'         // existing — range-слайдер цены + переключатель валют
  | 'caliber'            // existing — caliberFilter (боевой)
  | 'usedIn'             // NEW — чипы «используется в»: бартер / крафт / квест / GP-Реф
  | 'needMe'             // NEW — «нужно мне»: предмет нужен для незавершённых квестов
  | 'subcategory';       // NEW — мульти-выбор BSG-подкатегории (саб-бар)

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

/** Спецификация мульти-выбора подкатегорий (иконочные плитки в панели «Фильтры»). */
export interface SubcategorySpec {
  /** микро-заголовок блока */
  label: string;
  /** поле предмета, по которому фильтруем */
  field: 'bsgCategoryId';
  options: { id: string; label: string; iconUrl: string }[];
}

export interface CategoryFilterConfig {
  /** контролы верхней панели (порядок = порядок отрисовки) */
  controlBar: FilterControl[];
  /** контролы раскрывающейся Advanced-панели */
  advanced: FilterControl[];
  /** выделенный саб-бар над сеткой; null = нет */
  subtypeBar: SubcategorySpec | null;
  /** доступные ключи сортировки (подмножество SORT_OPTIONS); порядок = порядок в дропдауне */
  sort: string[];
}

// ─── DEFAULT: применяется ко всем «конечным» категориям (без своего subtypeBar) ──
// Полный современный фильтр: «Отображать только» (usedIn + нужно мне) + armorClass
// (только armor-категории) + избранное + доступно мне; advanced = диапазон цены + калибр.
export const DEFAULT_FILTER_CONFIG: CategoryFilterConfig = {
  controlBar: ['search', 'armorClass', 'usedIn', 'needMe', 'favorites'],
  advanced:   ['priceRange', 'caliber'],
  subtypeBar: null,
  sort:       ['vps', 'sellTrader', 'sellFlea', 'buyTrader', 'buyMin', 'weight', 'name', 'indicator'],
};

// ─── Профиль: «Предметы для бартера» ───────────────────────────────────────────
// Боевые контролы скрыты (нет class/caliber). Вперёд — назначение и подкатегория.
const BARTER_CONFIG: CategoryFilterConfig = {
  controlBar: ['search', 'usedIn', 'needMe', 'favorites'],
  advanced:   ['priceRange'],
  subtypeBar: {
    label: 'Выбор категорий',
    field: 'bsgCategoryId',
    // id = bsgCategoryId (см. item-category.ts BARTER_BSG_ICON), лейблы — из headerConfig.
    options: [
      { id: '57864a3d24597754843f8721', label: 'Ценности',         iconUrl: '/icons/eft/04-progression/barter-profit/valuables.svg' },
      { id: '57864a66245977548f04a81f', label: 'Электроника',      iconUrl: '/icons/eft/04-progression/barter-profit/electronics.svg' },
      { id: '57864bb7245977548b3b66c2', label: 'Инструменты',      iconUrl: '/icons/eft/04-progression/barter-profit/tools.svg' },
      { id: '57864c322459775490116fbf', label: 'Хозтовары',        iconUrl: '/icons/eft/04-progression/barter-profit/household-materials.svg' },
      { id: '57864ada245977548638de91', label: 'Стройматериалы',   iconUrl: '/icons/eft/04-progression/barter-profit/building-materials.svg' },
      { id: '57864c8c245977548867e7f1', label: 'Медматериалы',     iconUrl: '/icons/eft/04-progression/barter-profit/medical-supplies.svg' },
      { id: '57864ee62459775490116fc1', label: 'Элементы питания', iconUrl: '/icons/eft/04-progression/barter-profit/energy-elements.svg' },
      { id: '57864e4c24597754843f8723', label: 'Г.С.М.',           iconUrl: '/icons/eft/04-progression/barter-profit/flammable-materials.svg' },
      { id: '590c745b86f7743cc433c5f2', label: 'Другие',           iconUrl: '/icons/eft/04-progression/barter-profit/others.svg' },
    ],
  },
  sort: ['vps', 'sellTrader', 'sellFlea', 'buyTrader', 'weight', 'name'],
};

const ITEMS_FILTER_CONFIG: Record<string, CategoryFilterConfig> = {
  barter: BARTER_CONFIG,
};

export const getFilterConfig = (slug: string): CategoryFilterConfig =>
  ITEMS_FILTER_CONFIG[slug] ?? DEFAULT_FILTER_CONFIG;
