// 15 UI-категорий loose-лута карты — единый источник для грида «Случайная добыча» в левом
// drawer'е (Предметы) И для слоя «Случайная добыча» в правой легенде. Ключи = слои `loose-<key>`.
//
// Зеркало держит лут в 7 ГРУБЫХ категориях (barter — одно ведро ~4500 маркеров). Тонкие 9
// под-категорий бартера берём из `prices.bsgCategoryId` (BSG node id, синхронно с BARTER_BSG_ICON
// в item-category.ts). Прочее — маппинг грубой категории каталога. iconClass — таксономия сайта.

export interface Loot15Cat {
  key: string;
  label: string;
  /** icon-mask класс (icon-eft-barter-* / icon-eft-eq-*). */
  icon: string;
}

export const LOOT_15: Loot15Cat[] = [
  { key: 'valuables', label: 'Ценности', icon: 'icon-eft-barter-valuables' },
  { key: 'electronics', label: 'Электроника', icon: 'icon-eft-barter-electronics' },
  { key: 'medical-supplies', label: 'Медматериалы', icon: 'icon-eft-barter-medical' },
  { key: 'infoitems', label: 'Инфо-предметы', icon: 'icon-eft-eq-infoitems' },
  { key: 'others', label: 'Другое', icon: 'icon-eft-barter-others' },
  { key: 'provisions', label: 'Провизия', icon: 'icon-eft-eq-provisions' },
  { key: 'special-equipment', label: 'Спецоборудование', icon: 'icon-eft-eq-special' },
  { key: 'energy-elements', label: 'Элементы питания', icon: 'icon-eft-barter-energy' },
  { key: 'flammable-materials', label: 'Г.С.М.', icon: 'icon-eft-barter-flammable' },
  { key: 'tools', label: 'Инструменты', icon: 'icon-eft-barter-tools' },
  { key: 'building-materials', label: 'Стройматериалы', icon: 'icon-eft-barter-materials' },
  { key: 'household-materials', label: 'Хозтовары', icon: 'icon-eft-barter-household' },
  { key: 'keys', label: 'Ключи', icon: 'icon-eft-eq-keys' },
  { key: 'injectors', label: 'Инъекторы', icon: 'icon-eft-eq-injectors' },
  { key: 'medkits', label: 'Аптечки', icon: 'icon-eft-eq-medkits' },
];

// prices.bsgCategoryId → под-категория бартера (те же BSG node ids, что BARTER_BSG_ICON).
const BSG_TO_LOOT15: Record<string, string> = {
  '590c745b86f7743cc433c5f2': 'others',
  '57864a3d24597754843f8721': 'valuables',
  '57864a66245977548f04a81f': 'electronics',
  '57864bb7245977548b3b66c2': 'tools',
  '57864c322459775490116fbf': 'household-materials',
  '57864ada245977548638de91': 'building-materials',
  '57864c8c245977548867e7f1': 'medical-supplies',
  '57864ee62459775490116fc1': 'energy-elements',
  '57864e4c24597754843f8723': 'flammable-materials',
  '5d650c3e815116009f6201d2': 'flammable-materials',
  '5448ecbe4bdc2d60728b4568': 'infoitems', // диски/документы/флешки/дискеты (сверено по данным: 817 loose)
  '5795f317245977243854e041': 'others', // кейсы/контейнеры-хранилища (отдельной кат. в 15 нет)
};

/**
 * Грубая категория каталога (barter/injectors/provisions/poster/keys/other/container) +
 * prices.bsgCategoryId → одна из 15. Бартер дробится по BSG-id; прочее — прямой маппинг.
 */
export function classifyLoot15(
  coarse: string | null | undefined,
  bsgCategoryId: string | null | undefined,
): string {
  if (coarse === 'barter') return BSG_TO_LOOT15[bsgCategoryId ?? ''] ?? 'others';
  switch (coarse) {
    case 'injectors':
      return 'injectors';
    case 'provisions':
      return 'provisions';
    case 'poster':
      return 'infoitems';
    case 'keys':
      return 'keys';
    default:
      return 'others'; // other / container / неизвестное
  }
}
