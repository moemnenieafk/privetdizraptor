// Каталог loot-контейнеров (мировые, обыскиваемые) для раздела /eft/loot-containers.
// Каркас Фазы 1: имена + ассеты. Таблица лута (что спавнится) — Фаза 2 (SPT staticLoot).
// slug = имя webp-ассета (/images/maps/eft/markers/loot-containers/loot-container-{file}.webp).
// Прим.: арт-файлы трупов исторически названы наоборот (dead-pmc = Дикий, dead-scav = ЧВК) —
// nameRu здесь по фактическому изображению/смыслу, из карт-маркеров (map-marker-icons.ts).

export type LootContainerKind = 'container' | 'cache' | 'corpse' | 'special';

export interface LootContainer {
  slug: string;
  nameRu: string;
  file: string;
  kind: LootContainerKind;
}

export const LOOT_CONTAINER_KINDS: { id: LootContainerKind; label: string }[] = [
  { id: 'container', label: 'Контейнеры' },
  { id: 'cache', label: 'Схроны' },
  { id: 'corpse', label: 'Трупы' },
  { id: 'special', label: 'Особые' },
];

export const LOOT_CONTAINERS: LootContainer[] = [
  // Контейнеры
  { slug: 'jacket', nameRu: 'Куртка', file: 'jacket', kind: 'container' },
  { slug: 'jacket-worker-blue', nameRu: 'Рабочая куртка', file: 'jacket-worker-blue', kind: 'container' },
  { slug: 'drawer', nameRu: 'Выдвижной ящик', file: 'drawer', kind: 'container' },
  { slug: 'toolbox', nameRu: 'Ящик с инструментами', file: 'toolbox', kind: 'container' },
  { slug: 'wooden-toolbox', nameRu: 'Деревянный ящик с инструментами', file: 'wooden-toolbox', kind: 'container' },
  { slug: 'pc-block', nameRu: 'Системный блок', file: 'pc-block', kind: 'container' },
  { slug: 'cash-register', nameRu: 'Кассовый аппарат', file: 'cash-register', kind: 'container' },
  { slug: 'cash-register-bank', nameRu: 'Банковский кассовый аппарат', file: 'cash-register-tar2-2', kind: 'container' },
  { slug: 'bank-safe', nameRu: 'Сейф', file: 'bank-safe', kind: 'container' },
  { slug: 'medcase', nameRu: 'Медукладка', file: 'medcase', kind: 'container' },
  { slug: 'medbag-smu06', nameRu: 'Медсумка СМУ06', file: 'medbag-smu06', kind: 'container' },
  { slug: 'sportsbag', nameRu: 'Спортивная сумка', file: 'sportsbag', kind: 'container' },
  { slug: 'plastic-suitcase', nameRu: 'Пластиковый чемодан', file: 'plastic-suitcase', kind: 'container' },
  { slug: 'wooden-crate', nameRu: 'Деревянный ящик', file: 'wooden-crate', kind: 'container' },
  { slug: 'weaponbox-5x2', nameRu: 'Оружейный ящик (5×2)', file: 'weaponbox-5x2', kind: 'container' },
  { slug: 'weaponbox-6x3', nameRu: 'Оружейный ящик (6×3)', file: 'weaponbox-6x3', kind: 'container' },
  { slug: 'weaponbox-4x4', nameRu: 'Оружейный ящик (4×4)', file: 'weaponbox-4x4', kind: 'container' },
  { slug: 'weaponbox-5x5', nameRu: 'Оружейный ящик (5×5)', file: 'weaponbox-5x5', kind: 'container' },
  { slug: 'wooden-ammo-box', nameRu: 'Патронный ящик', file: 'wooden-ammo-box', kind: 'container' },
  { slug: 'wooden-grenade-box', nameRu: 'Гранатный ящик', file: 'wooden-grenade-box', kind: 'container' },
  { slug: 'wooden-ration-supply-crate', nameRu: 'Ящик с продовольствием', file: 'wooden-ration-supply-crate', kind: 'container' },
  { slug: 'wooden-medical-supply-crate', nameRu: 'Ящик медобеспечения', file: 'wooden-medical-supply-crate', kind: 'container' },
  { slug: 'wooden-technical-supply-crate', nameRu: 'Ящик технического снабжения', file: 'wooden-technical-supply-crate', kind: 'container' },
  // Схроны
  { slug: 'ground-cache', nameRu: 'Схрон в земле', file: 'ground-cache', kind: 'cache' },
  { slug: 'burried-barrel-cache', nameRu: 'Закопанная бочка', file: 'burried-barrel-cache', kind: 'cache' },
  { slug: 'common-fund-stash', nameRu: 'Схрон Штурмана', file: 'common-fund-stash', kind: 'cache' },
  // Трупы
  { slug: 'dead-scav', nameRu: 'Труп Дикого', file: 'dead-pmc', kind: 'corpse' },
  { slug: 'dead-pmc', nameRu: 'Труп ЧВК', file: 'dead-scav', kind: 'corpse' },
  { slug: 'civilian-body', nameRu: 'Труп гражданского', file: 'civilian-body', kind: 'corpse' },
  { slug: 'laborant', nameRu: 'Труп лаборанта', file: 'laborant', kind: 'corpse' },
  // Особые
  { slug: 'airdrop', nameRu: 'Сброс снабжения', file: 'airdrop', kind: 'special' },
];

const BY_SLUG = new Map(LOOT_CONTAINERS.map((c) => [c.slug, c]));

export function containerBySlug(slug: string): LootContainer | undefined {
  return BY_SLUG.get(slug);
}

const WEBP_BASE = '/images/maps/eft/markers/loot-containers';

export function containerImage(file: string): string {
  return `${WEBP_BASE}/loot-container-${file}.webp`;
}
