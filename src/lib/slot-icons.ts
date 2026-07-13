// Иконка категории для слота оружия. Пустой слот в конструкторе показывает не серый
// квадрат, а иконку того, что в него ставится (дуло, магазин, прицел…) — как в игре.
//
// Ключ — nameId слота из БД (weapon_slots.name_id): это технический ключ BSG
// (mod_muzzle, mod_pistol_grip, mod_scope_001…), стабильный между вайпами.
// Суффиксы у BSG нумерованные (mod_scope_000..003, mod_tactical_2), поэтому
// матчим ПРЕФИКСОМ, а не точным равенством.
//
// Иконки — из общего набора icons.css (icon-eft-guns-parts-*), тот же, что в каталоге
// предметов. Никаких новых ассетов.

/**
 * Правила «префикс nameId → класс иконки». ПОРЯДОК ЗНАЧИМ: проверяются сверху вниз,
 * поэтому частные префиксы идут раньше общих (mod_stock_root до mod_stock,
 * mod_sight_* до mod_s…). Первое совпадение выигрывает.
 */
const SLOT_ICON_RULES: readonly [prefix: string, iconClass: string][] = [
  // Ствольная группа
  ['mod_muzzle', 'icon-eft-guns-parts-muzzle'],
  ['mod_barrel', 'icon-eft-guns-parts-barrels'],
  ['mod_gas_block', 'icon-eft-guns-parts-gasblocks'],
  ['mod_handguard', 'icon-eft-guns-parts-handguards'],
  ['mod_launcher', 'icon-eft-underbarrel-launchers'],

  // Прицельные
  ['mod_scope', 'icon-eft-guns-parts-sights'],
  ['mod_sight_front', 'icon-eft-guns-parts-sights'],
  ['mod_sight_rear', 'icon-eft-guns-parts-sights'],
  ['mod_nvg', 'icon-eft-guns-parts-sights'],

  // Тактика и подвес
  ['mod_tactical', 'icon-eft-guns-parts-laser'],
  ['mod_flashlight', 'icon-eft-guns-parts-laser'],
  ['mod_mount', 'icon-eft-guns-parts-mounts'],
  ['mod_foregrip', 'icon-eft-guns-parts-foregrips'],
  ['mod_bipod', 'icon-eft-guns-parts-bipods'],

  // Хват и приклад. mod_stock_root — служебный узел-переходник, но иконка та же.
  ['mod_stock', 'icon-eft-guns-parts-stocks'],
  ['mod_pistol_grip', 'icon-eft-guns-parts-pistolgrips'],
  ['mod_pistolgrip', 'icon-eft-guns-parts-pistolgrips'],
  ['mod_grip', 'icon-eft-guns-parts-handles'],

  // Ствольная коробка и механика
  ['mod_reciever', 'icon-eft-guns-parts-receivers'], // опечатка BSG в оригинале — так и есть в данных
  ['mod_receiver', 'icon-eft-guns-parts-receivers'],
  ['mod_charge', 'icon-eft-guns-parts-functional'],
  ['mod_trigger', 'icon-eft-guns-parts-functional'],
  ['mod_hammer', 'icon-eft-guns-parts-functional'],
  ['mod_catch', 'icon-eft-guns-parts-functional'],

  // Питание
  ['mod_magazine', 'icon-eft-guns-parts-magazines'],
  ['patron_in_weapon', 'icon-eft-guns-ammo'],
  ['cartridges', 'icon-eft-guns-ammo'],
  ['camora', 'icon-eft-guns-ammo'], // барабан дробовиков/револьверов

  // Прочая обвеска
  ['mod_equipment', 'icon-eft-guns-parts-gearmods'],
  ['mod_muzzle_flash', 'icon-eft-guns-parts-aux'],
] as const;

/** Фолбэк — общая иконка «модули оружия». Лучше, чем пустой квадрат. */
export const SLOT_ICON_FALLBACK = 'icon-eft-guns-mods';

/** Класс иконки для слота по его nameId. Всегда возвращает валидный класс. */
export function slotIconClass(nameId: string): string {
  const key = nameId.toLowerCase();
  for (const [prefix, icon] of SLOT_ICON_RULES) {
    if (key.startsWith(prefix)) return icon;
  }
  return SLOT_ICON_FALLBACK;
}

/** Слот — патронный (патронник/магазинные патроны/камора)? Для них пикер показывает патроны, не моды. */
export function isAmmoSlot(nameId: string): boolean {
  const key = nameId.toLowerCase();
  return (
    key.startsWith('patron_in_weapon') ||
    key.startsWith('cartridges') ||
    key.startsWith('camora')
  );
}