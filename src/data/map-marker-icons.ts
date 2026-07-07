/**
 * РЕЗОЛВЕР иконок маркеров карты — единая точка правды для легенды, превью в редакторе
 * («Правка») и боевого рендера (MapViewerClient). `markerIconUrl(marker)` → путь к иконке ЦТА
 * по type + под-виду (faction / category / label / sides).
 *
 * ВАЖНО (правило V4DYA): у маркеров СВОЯ расцветка, зашитая в svg — рендерим их как есть
 * (`mode:'img'`, полноцветный `<img>`), БЕЗ mask-перекраски и БЕЗ игрового rarity-цвета.
 * Ассеты: svg (`/icons/eft/01-maps/markers/…`) — цветные глифы; webp (`/images/maps/eft/markers/…`)
 * — контейнеры/стационарки. loose loot рисуется иконкой предмета отдельно (builder). Своего арта
 * нет только у hazard → резолвер отдаёт `null` (плейсхолдер).
 */

const WEBP = '/images/maps/eft/markers';
const SVG = '/icons/eft/01-maps/markers';

export type IconMode = 'img' | 'mask';

export interface ResolvedMarkerIcon {
  url: string;
  /** img — цветной ассет как есть; mask — монохром под tint (сейчас не используется маркерами). */
  mode: IconMode;
  size: number;
}

/** Вход резолвера — надмножество полей ручного и синканного маркера. */
export interface MarkerIconInput {
  type: string;
  category?: string | null;
  faction?: string | null;
  label?: string | null;
  /** синканные спавны: подвиды ботов (boss/sniper…). */
  categories?: string[] | null;
  /** синканные спавны: стороны (pmc/scav) — приоритетнее faction. */
  sides?: string[] | null;
  /** выходы: имя нужного предмета (transferItem) — «Записка с кодовым словом …» → codeword-иконка. */
  transferItemName?: string | null;
}

/* ── КОНТЕЙНЕРЫ ── synced-маркеры приходят с ru-`label`, ручные (редактор) — с `category`-ключом. */
const CONTAINER_LABEL_FILE: Record<string, string> = {
  'Спортивная сумка': 'sportsbag',
  'Оружейный ящик': 'weaponbox-5x5', // generic-представитель (4 размера неразличимы по label)
  'Ящик с инструментами': 'toolbox',
  'Деревянный ящик': 'wooden-crate',
  Куртка: 'jacket',
  'Системный блок': 'pc-block',
  'Выдвижной ящик': 'drawer',
  'Кассовый аппарат': 'cash-register',
  'Гранатный ящик': 'wooden-grenade-box',
  'Труп Дикого': 'dead-scav',
  'Закопанная бочка': 'burried-barrel-cache',
  'Медсумка СМУ06': 'medbag-smu06',
  'Труп ЧВК': 'dead-pmc',
  'Схрон в земле': 'ground-cache',
  'Ящик технического снабжения': 'wooden-technical-supply-crate',
  'Патронный ящик': 'wooden-ammo-box',
  Медукладка: 'medcase',
  'Пластиковый чемодан': 'plastic-suitcase',
  Сейф: 'bank-safe',
  'Ящик с продовольствием': 'wooden-ration-supply-crate',
  'Ящик медобеспечения': 'wooden-medical-supply-crate',
  'Труп гражданского': 'civilian-body',
  'Банковский сейф': 'bank-safe',
  'Труп лаборанта': 'laborant',
  'Банковский кассовый аппарат': 'cash-register-tar2-2',
  'Схрон Штурмана': 'common-fund-stash',
};

/** Ключи редактора «Правка» (ручные статик-карты) → файл контейнера. */
const CONTAINER_CATEGORY_FILE: Record<string, string> = {
  'weapon-case': 'weaponbox-5x5',
  'weapon-box': 'weaponbox-5x5',
  'wooden-crate': 'wooden-crate',
  'ammo-box': 'wooden-ammo-box',
  'grenade-box': 'wooden-grenade-box',
  'cash-register': 'cash-register',
  safe: 'bank-safe',
  bank: 'bank-safe',
  jacket: 'jacket',
  medbag: 'medbag-smu06',
  medcase: 'medcase',
  toolbox: 'toolbox',
  'filing-cabinet': 'drawer',
  drawer: 'drawer',
  'pc-block': 'pc-block',
  'duffle-bag': 'sportsbag',
  'tech-crate': 'wooden-technical-supply-crate',
  'med-crate': 'wooden-medical-supply-crate',
  'ration-crate': 'wooden-ration-supply-crate',
  suitcase: 'plastic-suitcase',
  airdrop: 'airdrop',
  'corpse-pmc': 'dead-pmc',
  'corpse-scav': 'dead-scav',
  'corpse-civ': 'civilian-body',
  'buried-barrel': 'burried-barrel-cache',
  'ground-cache': 'ground-cache',
  stash: 'common-fund-stash',
};
const CONTAINER_FALLBACK = 'wooden-crate';

export const containerFile = (m: MarkerIconInput): string =>
  (m.label ? CONTAINER_LABEL_FILE[m.label] : undefined) ??
  (m.category ? CONTAINER_CATEGORY_FILE[m.category] : undefined) ??
  CONTAINER_FALLBACK;

/** Подвид спавна (сторона/бот) → файл. sniper в данных = снайпер-дикий. */
export const spawnSubkind = (m: MarkerIconInput): 'pmc' | 'scav' | 'sniper' | 'boss' => {
  const c = (m.categories ?? []).map((x) => x.toLowerCase());
  if (c.includes('sniper') || m.category === 'sniper') return 'sniper';
  if (c.includes('boss') || m.category === 'boss') return 'boss';
  const f = ((m.sides ?? [])[0] ?? m.faction ?? m.category ?? '').toLowerCase();
  if (f === 'pmc' || f === 'botpmc') return 'pmc';
  return 'scav';
};
const SPAWN_FILE: Record<string, string> = {
  pmc: 'spawn-pmc',
  scav: 'spawn-scav',
  sniper: 'spawn-scav-sniper',
  boss: 'spawn-boss-add',
  'boss-sniper': 'spawn-boss-sniper',
  'black-division': 'spawn-black-division',
};

const exfilFile = (m: MarkerIconInput): string => {
  // Выход «(Сигнал)» — активируется зелёным сигнальным патроном (РСП-30 / 26x75 зелёный).
  if (/\(сигнал\)/i.test(m.label ?? '')) return 'exfil-point-pmc-greenflare';
  // Выход по кодовому слову («Записка с кодовым словом …») → своя иконка, приоритет над фракцией.
  if (/кодов|codeword/i.test(m.transferItemName ?? '')) return 'exfil-point-codeword';
  const f = (m.faction ?? 'all').toLowerCase();
  if (f === 'pmc') return 'exfil-point-pmc';
  if (f === 'scav') return 'exfil-point-scav';
  return 'exfil-point-spare';
};

const lockFile = (hint: string): string => {
  const h = hint.toLowerCase();
  if (h.includes('карт') || h.includes('keycard') || h.includes('панел')) return 'lock-keycard-pannel';
  if (h.includes('мечен') || h.includes('marked')) return 'lock-mechanical-marked';
  return 'lock-mechanical';
};

/** Главный резолвер: маркер → иконка (url + режим + размер) или `null` (нет арта → плейсхолдер). */
export function markerIconUrl(m: MarkerIconInput): ResolvedMarkerIcon | null {
  switch (m.type) {
    case 'extract':
      return { url: `${SVG}/exfil/${exfilFile(m)}.svg`, mode: 'img', size: 30 };

    case 'spawn':
      return { url: `${SVG}/spawn/${SPAWN_FILE[spawnSubkind(m)]}.svg`, mode: 'img', size: 28 };

    // явные под-виды (для драйвера слоёв: boss/boss-sniper/black-division)
    case 'boss':
      return { url: `${SVG}/spawn/spawn-boss-add.svg`, mode: 'img', size: 30 };

    case 'lock':
      return { url: `${SVG}/lock/${lockFile(m.category || m.label || '')}.svg`, mode: 'img', size: 26 };

    case 'switch':
      return { url: `${SVG}/switch/switch-lever.svg`, mode: 'img', size: 26 };

    case 'loot':
    case 'loot_loose':
      // fallback (без linkedItemId); обычно loose loot рисуется иконкой предмета в builder'е.
      return { url: `${SVG}/loot/loot-random-luck.svg`, mode: 'img', size: 24 };

    case 'transit':
      return { url: `${SVG}/transition-point.svg`, mode: 'img', size: 30 };

    case 'quest_zone':
    case 'quest':
      return { url: `${SVG}/quest/quest-maker.svg`, mode: 'img', size: 30 };

    case 'container':
    case 'loot_container':
      // Высококачественный webp-арт — крупный размер (зум ещё домножает через --marker-scale).
      return { url: `${WEBP}/loot-containers/loot-container-${containerFile(m)}.webp`, mode: 'img', size: 56 };

    case 'stationary':
    case 'stationary_weapon': {
      const l = (m.label ?? '').toLowerCase();
      const nvs = l.includes('утёс') || l.includes('утес') || l.includes('нсв');
      return { url: `${WEBP}/stationary/${nvs ? 'stationary-nvs-utes' : 'stationary-ags30'}.webp`, mode: 'img', size: 34 };
    }

    // hazard — своего арта нет → плейсхолдер (generic).
    default:
      return null;
  }
}

/* ─────────────────── Легенда / палитра типов ─────────────────── */

/** Цвет типа — только для плейсхолдеров (hazard) и акцентов палитры редактора. */
export const MARKER_TYPE_COLOR: Record<string, string> = {
  extract: '#5FB85B',
  spawn: '#E6A23C',
  boss: '#E5484D',
  transit: '#FF7724',
  hazard: '#E5484D',
  lock: '#BDA550',
  switch: '#C26BE0',
  loot: '#E68E25',
  loot_loose: '#E68E25',
  container: '#9A8866',
  loot_container: '#9A8866',
  stationary: '#8FA3B0',
  stationary_weapon: '#8FA3B0',
  quest_zone: '#E0C24A',
  quest: '#E0C24A',
};

export const markerColor = (type: string): string => MARKER_TYPE_COLOR[type] ?? '#9696A1';

/* ─────────────────── Иконки боссов (нижняя панель карты) ─────────────────── */
// boss.meta.bossNormalizedName → файл в /public/images/bosses/eft. Нет ассета → null.
const BOSS_ICON: Record<string, string> = {
  glukhar: 'gluhar',
  gluhar: 'gluhar',
  bigpipe: 'bigpipe',
  'big-pipe': 'bigpipe',
  birdeye: 'birdeye',
  'bird-eye': 'birdeye',
  kaban: 'kaban',
  killa: 'killa',
  'vengeful-killa': 'vengefulkilla',
  knight: 'knight',
  kollontay: 'kollontai',
  kollontai: 'kollontai',
  partisan: 'partisan',
  sanitar: 'sanitar',
  'cultist-priest': 'sektant',
  cultist: 'sektant',
  sektant: 'sektant',
  'shadow-of-tagilla': 'shadowoftagilla',
  shturman: 'shturman',
  tagilla: 'tagilla',
  'the-wedge': 'thewedge',
  zryachiy: 'zryachiy',
};

export function bossIconUrl(normalizedName?: string | null): string | null {
  if (!normalizedName) return null;
  const file = BOSS_ICON[normalizedName.toLowerCase()];
  return file ? `/images/bosses/eft/${file}.webp` : null;
}

export interface LegendEntry {
  type: string;
  ru: string;
  sample: MarkerIconInput;
}

export const MAP_LEGEND: LegendEntry[] = [
  { type: 'extract', ru: 'Выход', sample: { type: 'extract', faction: 'all' } },
  { type: 'spawn', ru: 'Спавн', sample: { type: 'spawn', faction: 'pmc' } },
  { type: 'transit', ru: 'Переход', sample: { type: 'transit' } },
  { type: 'lock', ru: 'Замок / ключ', sample: { type: 'lock' } },
  { type: 'switch', ru: 'Рычаг', sample: { type: 'switch' } },
  { type: 'container', ru: 'Контейнер', sample: { type: 'container', category: 'weapon-box' } },
  { type: 'loot_loose', ru: 'Лут', sample: { type: 'loot_loose' } },
  { type: 'stationary', ru: 'Стационарка', sample: { type: 'stationary' } },
  { type: 'quest_zone', ru: 'Зона квеста', sample: { type: 'quest_zone' } },
  { type: 'hazard', ru: 'Опасность', sample: { type: 'hazard' } },
];
