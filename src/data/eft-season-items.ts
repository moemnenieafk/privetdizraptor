// Реестр предметов Сезона 1 «KORD BREACH» (патч 1.1.0) — ДВЕ категории.
//
// Откуда взято: серверный конфиг Battle Pass (тиры/награды) у нас пока НЕТ —
// tarkov.dev не задатамайнил 1.1.0, SPT лагает. Поэтому состав выведен АВТОНОМНО из
// имён бандлов клиента (diff дорелизного слепка), подтверждён патчноутом 1.1.0.0:
// «продвижение по Боевому Пропуску — находить и передавать документацию TerraGroup;
//  Секретные данные — универсальная замена документов». §4.11 не нарушается: это наш
// статичный словарь (как eft-seasons.ts), не рантайм-фетч игрового источника.
//
// СВЯЗЬ С КАТАЛОГОМ: ключи — bundle-key (StreamingAssets/Windows-относительный путь).
// Предмет каталога (BSG id) → его bundle-key берётся из src/data/icon-bundle-map-eft.json
// (id→bundle), который заполняется при рендере/заливке иконок новых предметов после синка.
// До синка реестр «готов встретить» предметы; UI-фильтр активируется, когда каталог их получит.

export type SeasonItemCategory = 'battle-pass' | 'kord-breach';

export interface SeasonItemCategoryMeta {
  id: SeasonItemCategory;
  label: string;
  /** Короткая метка для бейджа на плитке/карточке. */
  badge: string;
  description: string;
}

export const SEASON_ITEM_CATEGORIES: Record<SeasonItemCategory, SeasonItemCategoryMeta> = {
  'battle-pass': {
    id: 'battle-pass',
    label: 'Боевой пропуск',
    badge: 'BATTLE PASS',
    description:
      'Документация TerraGroup (прогрессия БП — находишь и сдаёшь), Секретные данные (универсальная замена), флаеры и контейнер Боевого пропуска KORD BREACH.',
  },
  'kord-breach': {
    id: 'kord-breach',
    label: 'KORD BREACH',
    badge: 'KORD BREACH',
    description:
      'Предметы сезонной фракции Black Division: жетоны, квест-предметы. Косметика-награды и кастомизация убежища — отдельная система (не инвентарные карточки).',
  },
};

// ─── Ядро Battle Pass (13) — всё это инвентарные предметы, иконки отрендерены ──────────
const BATTLE_PASS_BUNDLES: readonly string[] = [
  // Документация TerraGroup — прогрессия БП (9 департаментов)
  'assets/content/items/barter/item_barter_info_finance/item_barter_info_finance.bundle',
  'assets/content/items/barter/item_barter_info_medicine/item_barter_info_medicine.bundle',
  'assets/content/items/barter/item_barter_info_operating/item_barter_info_operating.bundle',
  'assets/content/items/barter/item_barter_info_personal/item_barter_info_personal.bundle',
  'assets/content/items/barter/item_barter_info_project/item_barter_info_project.bundle',
  'assets/content/items/barter/item_barter_info_scheme/item_barter_info_scheme.bundle',
  'assets/content/items/barter/item_barter_info_testing/item_barter_info_testing.bundle',
  'assets/content/items/barter/item_barter_info_user/item_barter_info_user.bundle',
  'assets/content/items/barter/item_barter_info_secretdoc/item_barter_info_secretdoc.bundle', // Секретные данные
  // Флаеры/постеры БП
  'assets/content/items/barter/item_barter_flyers/item_barter_flyers_tbattlepass_s1_beware.bundle',
  'assets/content/items/barter/item_barter_flyers/item_barter_flyers_tbattlepass_s1_burn.bundle',
  'assets/content/items/barter/item_barter_flyers/item_barter_flyers_tbattlepass_s1_dark.bundle',
  // Контейнер БП
  'assets/content/items/containers/item_container_tarkov_battlepass/item_container_tarkov_battlepass.bundle',
];

// ─── Сезон KORD BREACH / Black Division (7 инвентарных) ───────────────────────────────
const KORD_BREACH_BUNDLES: readonly string[] = [
  'assets/content/items/barter/item_barter_dogtags_blackdivision/item_barter_dogtags_blackdivision_ferrum.bundle',
  'assets/content/items/barter/item_barter_dogtags_blackdivision/item_barter_dogtags_blackdivision_green.bundle',
  'assets/content/items/barter/item_barter_dogtags_blackdivision/item_barter_dogtags_blackdivision_red.bundle',
  'assets/content/items/barter/item_barter_dogtags_blackdivision_old/item_barter_dogtags_blackdivision_old.bundle',
  'assets/content/items/barter/item_barter_info_bdssd/item_barter_info_bdssd.bundle', // Black Division SSD («KORD RAW»)
  'assets/content/items/infosubject/item_info_quest_bdtoughbook/item_info_quest_bdtoughbook.bundle',
  'assets/content/items/infosubject/item_info_quest_bdtoughbook_fence/item_info_quest_bdtoughbook_fence.bundle',
];

// Косметика-награды БП (skinned, НЕ инвентарные карточки — отдельная система кастомизации):
// одежда characters/**/*_bp_bd_*, скины рук hands/hands_bp_bd_*,
// кастомизация убежища location_objects/**/customization/**/*_blackdivision*.
// Держим справочно; в товарные категории не кладём.

const BP = new Set(BATTLE_PASS_BUNDLES);
const KB = new Set(KORD_BREACH_BUNDLES);

/** Категория предмета по его bundle-key (или null, если не сезонный). */
export function seasonCategoryForBundle(bundleKey: string | null | undefined): SeasonItemCategory | null {
  if (!bundleKey) return null;
  if (BP.has(bundleKey)) return 'battle-pass';
  if (KB.has(bundleKey)) return 'kord-breach';
  return null;
}

/** Все bundle-key сезона (для дампов/проверок). */
export const SEASON_ITEM_BUNDLES: Readonly<Record<SeasonItemCategory, readonly string[]>> = {
  'battle-pass': BATTLE_PASS_BUNDLES,
  'kord-breach': KORD_BREACH_BUNDLES,
};
