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

import type { EditorialLinkKind } from '@/db/schema-editorial';

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
  /** спавны: фракция по владельцу-боссу зоны (rogue/black-division) — приоритет над категорией. */
  spawnFaction?: string | null;
  /** ручной спавн-босс (редактор, category='boss'): файл-портрет в /images/bosses/eft. */
  bossKey?: string | null;
  /** выходы: имя нужного предмета (transferItem) — «Записка с кодовым словом …» → codeword-иконка. */
  transferItemName?: string | null;
  /** контейнер/лут: id мира из tarkov.dev (== SPT terraWBox/jacket tpl) — дизамбигуация под-вида. */
  linkedItemId?: string | null;
  /** тип-специфичная нагрузка маркера (hazard: `{ hazardType }` — snайпер/мина/миномёт/…). */
  meta?: Record<string, unknown> | null;
  /** editorial: тип связи (story|event|quest|none) — морфит quest-иконку по типу привязки (Ф4). */
  linkKind?: string | null;
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
  'Труп Дикого': 'dead-pmc', // арт «dead-pmc» = балаклава с крестиками = Дикий
  'Закопанная бочка': 'burried-barrel-cache',
  'Медсумка СМУ06': 'medbag-smu06',
  'Труп ЧВК': 'dead-scav', // арт «dead-scav» = кепка+маска = ЧВК
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
  'corpse-pmc': 'dead-scav', // кепка+маска = ЧВК
  'corpse-scav': 'dead-pmc', // балаклава с крестиками = Дикий
  'corpse-civ': 'civilian-body',
  'buried-barrel': 'burried-barrel-cache',
  'ground-cache': 'ground-cache',
  stash: 'common-fund-stash',
};
const CONTAINER_FALLBACK = 'wooden-crate';

/* ── Дизамбигуация по world-id (tarkov.dev lootContainer.id == SPT tpl): под-виды,
   неразличимые по ru-`label`. Оружейные ящики (terraWBox) → 4 размера сетки; куртки → вид. */
const CONTAINER_ITEM_FILE: Record<string, string> = {
  '5909d5ef86f77467974efbd8': 'weaponbox-5x2', // terraWBoxLong
  '5909d76c86f77471e53d2adf': 'weaponbox-6x3', // terraWBoxLongBig
  '5909d7cf86f77470ee57d75a': 'weaponbox-4x4', // terraWBoxSquare
  '5909d89086f77472591234a0': 'weaponbox-5x5', // terraWBoxSquareBig
  '578f8778245977358849a9b5': 'jacket', // Jacket (обычная)
  '5937ef2b86f77408a47244b3': 'jacket', // jacket_yellow_quest — своей иконки нет → generic
  '5914944186f774189e5e76c2': 'jacket-worker-blue', // jacket_key204 (рабочая)
};

export const containerFile = (m: MarkerIconInput): string =>
  (m.linkedItemId ? CONTAINER_ITEM_FILE[m.linkedItemId] : undefined) ??
  (m.label ? CONTAINER_LABEL_FILE[m.label] : undefined) ??
  (m.category ? CONTAINER_CATEGORY_FILE[m.category] : undefined) ??
  CONTAINER_FALLBACK;

/** Категории спавна редактора «Правка» → под-вид резолвера (иконка). goons — спец-рендер в builder'е. */
const SPAWN_CATEGORY_KIND: Record<string, SpawnSubkind> = {
  pmc: 'pmc',
  scav: 'scav',
  sniper: 'sniper',
  rogue: 'rogue',
  blackdiv: 'black-division',
  smuggler: 'scav', // контрабандисты — по иконке как дикие
  escort: 'boss', // свита босса = boss-add
  raider: 'boss', // налётчики = boss-add
  cleanup: 'boss', // команда зачистки = boss-add
  boss: 'boss', // generic до выбора конкретного (bossKey → портрет)
  goons: 'boss', // 3 портрета (спец-рендер), fallback boss-add
  cultist: 'boss', // до выбора sektant через bossKey
};

/** Подвид спавна (сторона/бот/фракция) → файл. sniper в данных = снайпер-дикий. */
export type SpawnSubkind = 'pmc' | 'scav' | 'sniper' | 'boss' | 'rogue' | 'black-division';
export const spawnSubkind = (m: MarkerIconInput): SpawnSubkind => {
  const sf = (m.spawnFaction ?? '').toLowerCase();
  if (sf === 'rogue') return 'rogue';
  if (sf === 'black-division') return 'black-division';
  const cat = (m.category ?? '').toLowerCase();
  if (cat && SPAWN_CATEGORY_KIND[cat]) return SPAWN_CATEGORY_KIND[cat];
  const c = (m.categories ?? []).map((x) => x.toLowerCase());
  if (c.includes('sniper') || m.category === 'sniper') return 'sniper';
  if (c.includes('boss') || m.category === 'boss') return 'boss';
  const f = ((m.sides ?? [])[0] ?? m.faction ?? m.category ?? '').toLowerCase();
  if (f === 'pmc' || f === 'botpmc') return 'pmc';
  return 'scav';
};
const SPAWN_FILE: Record<SpawnSubkind | 'boss-sniper', string> = {
  pmc: 'spawn-pmc',
  scav: 'spawn-scav',
  sniper: 'spawn-scav-sniper',
  boss: 'spawn-boss-add',
  'boss-sniper': 'spawn-boss-sniper',
  rogue: 'spawn-rogue',
  'black-division': 'spawn-black-division',
};

/** Под-вид выхода — единая точка правды для иконки, слоя и легенды. */
export type ExtractSubtype =
  | 'greenflare'
  | 'codeword'
  | 'paidcar'
  | 'paidhely'
  | 'redrebel'
  | 'nobackpack'
  | 'pmc'
  | 'scav'
  | 'shared';

/* Спец-выходы, НЕ выводимые из полей tarkov.dev (Alpinist / no-backpack). Классификация
   сверена с SPT `base.json` PassageRequirement (Reference=Alpinist, Empty=EXFIL_tip_backpack).
   Ключ = RU-`label` выхода (синк lang:ru); имена уникальны меж карт. */
const EXTRACT_NAME_SUBTYPE: Record<string, ExtractSubtype> = {
  'Тропа альпиниста': 'redrebel', // Берег
  'Спуск со скалы': 'redrebel', // Резерв
  'Тропа через перевал': 'redrebel', // Маяк
  'Вентиляционная шахта': 'nobackpack', // Лаборатория + Стриты
  'Трубопровод отопления': 'nobackpack', // Резерв (Heating Pipe — ползком без рюкзака)
};

/** Классификатор выхода → под-вид (приоритет спец-условий над фракцией). */
export function extractSubtype(m: MarkerIconInput): ExtractSubtype {
  // Editorial: явный подвид хранится в category (приоритет над деривацией по label синканных).
  const cat = (m.category ?? '') as ExtractSubtype;
  if (cat && cat in EXTRACT_FILE) return cat;
  const label = (m.label ?? '').trim();
  // «(Сигнал)» — активация зелёным сигнальным патроном (РСП-30 / 26x75).
  if (/\(сигнал\)/i.test(label)) return 'greenflare';
  // Требует предмет-пропуск: «Записка с кодовым словом …» ИЛИ «Карта минных полей …».
  if (/кодов|codeword|минных полей/i.test(m.transferItemName ?? '')) return 'codeword';
  // Платный В-Выход (машина): все RU-имена начинаются с «В-Выход», требуют валюту.
  if (/^в-?выход/i.test(label) || /рубл|доллар|евро/i.test(m.transferItemName ?? '')) return 'paidcar';
  const byName = EXTRACT_NAME_SUBTYPE[label];
  if (byName) return byName;
  const f = (m.faction ?? 'all').toLowerCase();
  if (f === 'pmc') return 'pmc';
  if (f === 'scav') return 'scav';
  return 'shared';
}

const EXTRACT_FILE: Record<ExtractSubtype, string> = {
  greenflare: 'exfil-point-pmc-greenflare',
  codeword: 'exfil-point-codeword',
  paidcar: 'exfil-point-paidcar',
  paidhely: 'exfil-point-paidhely',
  redrebel: 'exfil-point-pmc-redrebel',
  nobackpack: 'exfil-point-nobackpack',
  pmc: 'exfil-point-pmc',
  scav: 'exfil-point-scav',
  shared: 'exfil-point-spare',
};

const exfilFile = (m: MarkerIconInput): string => EXTRACT_FILE[extractSubtype(m)];

/* Механизм замка по имени ключа (lockType в данных = что заперто: door/container/trunk/switch,
   а НЕ механизм). keycard/intercom и marked различаем по имени ключа; прочее — стандартный keypad. */
export type LockKind = 'keycard' | 'marked' | 'keypad';
export const lockKind = (m: MarkerIconInput): LockKind => {
  const h = (m.category || m.label || '').toLowerCase();
  if (h.includes('карт') || h.includes('keycard') || h.includes('пропуск') || h.includes('интерком')) return 'keycard';
  if (h.includes('мечен') || h.includes('marked')) return 'marked';
  return 'keypad';
};

/** Под-вид опасности по meta.hazardType (minefield/sniper/mortar/tripwire) → файл danger-*. */
export type HazardSubtype =
  | 'sniper'
  | 'mine'
  | 'mortar'
  | 'mon50'
  | 'tripwire'
  | 'flamable'
  | 'biohazard'
  | 'electro'
  | 'radioactive'
  | 'other';
export const hazardSubtype = (m: MarkerIconInput): HazardSubtype => {
  const ht = String((m.meta as { hazardType?: unknown } | null | undefined)?.hazardType ?? '').toLowerCase();
  if (ht.includes('sniper')) return 'sniper';
  if (ht.includes('mon')) return 'mon50'; // МОН-50 (направленная мина) — до 'mine'
  if (ht.includes('mine')) return 'mine'; // minefield
  if (ht.includes('mortar')) return 'mortar';
  if (ht.includes('tripwire') || ht.includes('grenade')) return 'tripwire';
  if (ht.includes('flam') || ht.includes('fire')) return 'flamable';
  if (ht.includes('bio') || ht.includes('toxic')) return 'biohazard';
  if (ht.includes('electr')) return 'electro';
  if (ht.includes('radio')) return 'radioactive';
  return 'other';
};
const HAZARD_FILE: Record<HazardSubtype, string> = {
  sniper: 'danger-sniper-death',
  mine: 'danger-mines-death',
  mortar: 'danger-mortar-death',
  mon50: 'danger-mon50',
  tripwire: 'danger-tripwire-grenades',
  flamable: 'danger-flamable',
  biohazard: 'danger-biohazard',
  electro: 'danger-electro',
  radioactive: 'danger-radioactive',
  other: 'danger',
};

/** Тип стационарного оружия по названию (АГС-30 по умолчанию / НСВ «Утёс»). */
export type StationarySubtype = 'nvs' | 'ags30';
export const stationarySubtype = (m: MarkerIconInput): StationarySubtype => {
  const l = (m.label ?? '').toLowerCase();
  return l.includes('утёс') || l.includes('утес') || l.includes('нсв') ? 'nvs' : 'ags30';
};
export const STATIONARY_FILE: Record<StationarySubtype, string> = {
  nvs: 'stationary-nvs-utes',
  ags30: 'stationary-ags30',
};

/** Вид зоны квеста по meta.objectiveKind (из синка): предмет квеста vs цель. */
export const questZoneKind = (m: MarkerIconInput): 'item' | 'target' =>
  (m.meta as { objectiveKind?: unknown } | null | undefined)?.objectiveKind === 'item' ? 'item' : 'target';

/** Главный резолвер: маркер → иконка (url + режим + размер) или `null` (нет арта → плейсхолдер). */
export function markerIconUrl(m: MarkerIconInput): ResolvedMarkerIcon | null {
  switch (m.type) {
    case 'extract':
      return { url: `${SVG}/exfil/${exfilFile(m)}.svg`, mode: 'img', size: 30 };

    case 'spawn':
      // БТР-80 — webp; конкретный босс (bossKey ИЛИ category-хак = имя-файл) — портрет; иначе иконка.
      if (m.category === 'btr80') return { url: `${WEBP}/spawn/spawn-btr80.webp`, mode: 'img', size: 34 };
      if (m.bossKey) return { url: `/images/bosses/eft/${m.bossKey}.webp`, mode: 'img', size: 42 };
      if (m.category && BOSS_KEYS.has(m.category)) return { url: `/images/bosses/eft/${m.category}.webp`, mode: 'img', size: 42 };
      return { url: `${SVG}/spawn/${SPAWN_FILE[spawnSubkind(m)]}.svg`, mode: 'img', size: 28 };

    // явные под-виды (для драйвера слоёв: boss/boss-sniper/black-division)
    case 'boss':
      return { url: `${SVG}/spawn/spawn-boss-add.svg`, mode: 'img', size: 30 };

    case 'lock': {
      // Все замки — svg из interactive/lock: меченый / ключ-карта(интерком) / механический (по умолч.).
      const lk = lockKind(m);
      const file =
        lk === 'marked' ? 'lock-mechanical-marked' : lk === 'keycard' ? 'lock-keycard-pannel' : 'lock-mechanical';
      return { url: `${SVG}/interactive/lock/${file}.svg`, mode: 'img', size: 28 };
    }

    case 'switch':
      return { url: `${SVG}/interactive/switch/switch-lever.svg`, mode: 'img', size: 26 };

    case 'loot':
    case 'loot_loose':
      // fallback (без linkedItemId); обычно loose loot рисуется иконкой предмета в builder'е.
      return { url: `${SVG}/loot/loot-random-luck.svg`, mode: 'img', size: 24 };

    case 'transit':
      return { url: `${SVG}/exfil/transition-point.svg`, mode: 'img', size: 30 };

    case 'quest_zone':
    case 'quest': {
      // Морфинг editorial-маркера по типу связи (Ф4): сюжет/событие → спец-иконка quest-item-*.
      // Синканные зоны linkKind не несут → падают в объектную логику (quest-maker/quest-item).
      // NB: побочный (quest-item-side) — открытая развилка «квест vs побочный», ждёт различения.
      if (m.linkKind === 'story') return { url: `${SVG}/quest/quest-item-story.svg`, mode: 'img', size: 30 };
      if (m.linkKind === 'event') return { url: `${SVG}/quest/quest-item-event.svg`, mode: 'img', size: 30 };
      // Цель задания (quest-maker) vs предметы для заданий (quest-item) — по meta.objectiveKind.
      return { url: `${SVG}/quest/${questZoneKind(m) === 'item' ? 'quest-item' : 'quest-maker'}.svg`, mode: 'img', size: 30 };
    }

    case 'container':
    case 'loot_container':
      // Высококачественный webp-арт — крупный размер (зум ещё домножает через --marker-scale).
      return { url: `${WEBP}/loot-containers/loot-container-${containerFile(m)}.webp`, mode: 'img', size: 56 };

    case 'stationary':
    case 'stationary_weapon':
      // На карте — конкретная стационарка (webp по типу); mounted-armaments в легенде = категория.
      return { url: `${WEBP}/stationary/${STATIONARY_FILE[stationarySubtype(m)]}.webp`, mode: 'img', size: 34 };

    case 'hazard':
      // Цветной глиф по типу опасности (meta.hazardType): красный треугольник + чёрный
      // внутренний символ зашиты в svg → img (маска схлопнула бы в одинаковый силуэт).
      return { url: `${SVG}/danger/${HAZARD_FILE[hazardSubtype(m)]}.svg`, mode: 'img', size: 26 };

    case 'poi': {
      // Подвид метки: interest→point-of-interest, advice→advice, иначе (simple)→default-marker.
      const poiFile = m.category === 'interest' ? 'point-of-interest' : m.category === 'advice' ? 'advice' : 'default-marker';
      return { url: `${SVG}/${poiFile}.svg`, mode: 'img', size: 28 };
    }

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

/** Цвет закладки/чипа/оверлея editorial-маркера по типу привязки — ЕДИНЫЙ ИСТОЧНИК:
 *  карточка маркера, чип СЮЖЕТ в поиске, маршрут story-слоя на карте. Story-тинт = сталь;
 *  черновой, токен закрепим в Figma. */
export const LINK_KIND_COLOR: Record<EditorialLinkKind, string> = {
  story: '#6096a6',
  quest: '#e68e25',
  event: '#c26be0',
  none: '#8a8a95',
  item: '#5FB85B',
};

/** Иконка инструмента «Область» (полигональное лассо) — моно svg, красится currentColor (маска). */
export const MAKE_REGION_ICON = `${SVG}/make-region.svg`;

/** Иконка-бейдж «помечен на удаление» (красный крест) — оверлей на маркере в режиме удаления. */
export const DELETE_ICON = `${SVG}/delete-icon.svg`;

/** BSG item id (24-hex) — отличает лут-ПРЕДМЕТ (editorial: category=id) от лут-категории (ключ). */
export const isItemId = (s?: string | null): boolean => !!s && /^[0-9a-f]{24}$/i.test(s);

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
  reshala: 'reshala',
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

/** Ростер боссов для пикера редактора (category='boss'): key = basename webp в /images/bosses/eft. */
export const BOSS_ROSTER: { key: string; label: string }[] = [
  { key: 'reshala', label: 'Решала' },
  { key: 'gluhar', label: 'Глухарь' },
  { key: 'killa', label: 'Килла' },
  { key: 'shturman', label: 'Штурман' },
  { key: 'sanitar', label: 'Санитар' },
  { key: 'tagilla', label: 'Тагилла' },
  { key: 'zryachiy', label: 'Зрячий' },
  { key: 'kaban', label: 'Кабан' },
  { key: 'kollontai', label: 'Коллонтай' },
  { key: 'partisan', label: 'Партизан' },
  { key: 'sektant', label: 'Культист' },
  { key: 'knight', label: 'Рыцарь' },
  { key: 'bigpipe', label: 'Биг Пайп' },
  { key: 'birdeye', label: 'Бёрдай' },
  { key: 'shadowoftagilla', label: 'Тень Тагиллы' },
  { key: 'vengefulkilla', label: 'Мстительный Килла' },
  { key: 'thewedge', label: 'Клин' },
];

/** Множество ключей боссов (category-хак: category = имя-файл портрета в /images/bosses/eft). */
export const BOSS_KEYS = new Set(BOSS_ROSTER.map((b) => b.key));

/** Goons — трио боссов (общий спавн): 3 портрета для спец-рендера маркера. */
export const GOONS_FILES = ['bigpipe', 'birdeye', 'knight'] as const;

export function bossIconUrl(normalizedName?: string | null): string | null {
  if (!normalizedName) return null;
  const file = BOSS_ICON[normalizedName.toLowerCase()];
  return file ? `/images/bosses/eft/${file}.webp` : null;
}

/** normalizedName босса → basename webp-портрета (для портрета на зоне спавна), или null. */
export function bossPortraitKey(normalizedName?: string | null): string | null {
  if (!normalizedName) return null;
  return BOSS_ICON[normalizedName.toLowerCase()] ?? null;
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
