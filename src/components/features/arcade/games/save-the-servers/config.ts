// Все тюнимые константы game01 «Спаси сервера». Спека прямо просит перебалансировать
// баффы/дебаффы/спавн Пельменя после первых тестов — держим ВСЁ здесь, магии в коде нет.
// Единицы физики — на ФИКСИРОВАННЫЙ шаг 60 Гц (как в исходном доке SaveTheServers.md).

export const STEP_HZ = 60;
export const STEP_MS = 1000 / STEP_HZ;

// ─── Физика (спека v1.4: простой клик, без заряда/свайпа) ───
export const GRAVITY = 0.4; // px/шаг²
export const CLICK_VY = -12; // импульс вверх при клике, px/шаг
export const CLICK_VX_MAX = 4; // боковой сдвиг ±, зависит от точки попадания
export const WALL_BOUNCE = 0.8; // упругость боковых стен

// Фиксированный радиус попадания курсора (одинаков для всех скинов — спека).
export const HIT_RADIUS = 44;

// ─── Юмор/жизнь: вращение и «поп» ───
export const SPIN_IDLE = 0.035; // разброс базовой закрутки при спавне (рад/шаг)
export const SPIN_ON_HIT = 0.14; // закрутка от точки попадания (рад/шаг)
export const SPIN_DAMP = 0.99; // затухание вращения за шаг
export const HITPOP_MS = 170; // длительность squash-«попа» при ударе
export const HITRING_MS = 260; // кольцо-фидбэк радиуса на клике

// ─── Бутылка (спека v1.4: фиксированный размер, БЕЗ масштабирования) ───
export const BOTTLE_BASE_H = 132; // высота (лог. px); ширина из пропорции спрайта
export const GOLDEN_CHANCE = 0.15; // шанс золотой бутылки (+2 очка/клик)

// ─── HP (спека v1.4: старт 2, оверхил без потолка) ───
export const HP_START = 2;

// ─── Таймлайн числа бутылок (спека §3: 30с вступление, далее +1 каждую минуту) ───
// t<30с → 1; далее +1 каждые 60с. Границы стадий (для отката Пельменем): 0,30,90,150,…
export const RAMP_END_MS = 30_000;
export const STAGE_STEP_MS = 60_000;
export function bottlesAt(tMs: number): number {
  if (tMs < RAMP_END_MS) return 1;
  return 2 + Math.floor((tMs - RAMP_END_MS) / STAGE_STEP_MS);
}
/** Время старта текущей стадии (мс) — Пельмень откатывает таймер сюда. */
export function stageStartMs(tMs: number): number {
  if (tMs < RAMP_END_MS) return 0;
  return RAMP_END_MS + Math.floor((tMs - RAMP_END_MS) / STAGE_STEP_MS) * STAGE_STEP_MS;
}

// ─── Пельмень Буянова ───
export const PELMEN_MIN_BOTTLES = 2; // с какой стадии может вылетать (тюним 2/3 на тесте)
export const PELMEN_TARGET = 5; // кликов для срабатывания (спека §4: снижено с 10)
export const PELMEN_SPAWN_MS = 25_000; // как часто пробуем спавнить
export const PELMEN_VARIANTS = ['pelmen1', 'pelmen2', 'pelmen3'] as const;
export const PELMEN_SIZE = 96; // лог. px
export const PELMEN_HIT = 54;

// ─── Пикапы (хилка / звезда) ───
export const PICKUP_SIZE = 56;
export const PICKUP_HIT = 36;

// ─── Спавн-тайминги ───
export const BOTTLE_SPAWN_SPACING_MS = 650; // не выкидывать несколько бутылок в один кадр
export const STAR_SPAWN_MS = 45_000;
export const SPARK_MS = 420; // вспышка искр при потере HP

// ─── Дебаффы ───
export const DEBUFF_ERROR_MS = 3_000; // окно ошибки BSG (спека §5.2: 3с или по OK)
export const DEBUFF_TREMOR_MS = 3_000; // «Боль/Тремор»
export const DEBUFF_MIN_INTERVAL_MS = 18_000; // не чаще чем раз в N
export const ERROR_VARIANTS = 7; // error1..error7

// ─── Флэш «Заря» (синхрон с flashgrenade.mp3, спека §5.1) ───
export const FLASH_TOTAL_MS = 6_000; // длительность дебаффа = длина трека
export const FLASH_BLAST_AT = 3_000; // до 3с — тишина/подготовка (взрыв на 3-4с)
export const FLASH_PEAK_AT = 3_500; // пик ослепления
export const FLASH_PEAK = 0.85; // максимум белизны (очертания бутылок чуть видны)
export const FLASH_PEAK_REDUCED = 0.45; // мягче под prefers-reduced-motion

// ─── Баффы ───
export const BUFF_STAR_MS = 15_000; // «Золотая Звезда»: замедление падения на 15с (спека §5.2.1)
export const STAR_FALL_FACTOR = 0.5; // множитель гравитации бутылок при активной звезде
export const HEAL_SPAWN_MS = 40_000; // частота попыток спавна хилки
export const PICKUP_SPEED = 2.6; // скорость пролёта хилки/звезды через экран, px/шаг

// ─── Скоринг ───
export const SCORE_PER_CLICK = 1;
export const SCORE_GOLDEN = 2;

// ─── Скины оружия (порядок = цена index×20; file = имя файла на диске) ───
export interface WeaponSkin {
  readonly id: string;
  readonly name: string;
  readonly file: string; // база имени в /cursor/<file>1.webp, <file>2.webp
}
export const SKIN_PRICE_STEP = 20;

export const WEAPONS: readonly WeaponSkin[] = [
  { id: 'bars', name: 'Барс', file: 'bars' },
  { id: 'lopata', name: 'МПЛ-50', file: 'lopata' },
  { id: 'fomka', name: 'Фомка', file: 'fomka' },
  { id: 'topor', name: 'Топор', file: 'topor' },
  { id: 'pohod', name: 'Походный', file: 'pohod' },
  { id: 'kiba', name: 'Kiba', file: 'kiba' },
  { id: 'sca', name: 'SCA', file: 'sca' },
  { id: 'cultist', name: 'Нож культиста', file: 'cultist' },
  { id: 'kukri', name: 'Кукри', file: 'kukri' },
  { id: 'akula', name: 'Акула', file: 'akula' },
  { id: 'finka', name: 'Финка НКВД', file: 'finka' },
  { id: 'sword', name: 'Меч', file: 'sword' },
  { id: 'gladius', name: 'Гладиус', file: 'gladius' },
  { id: 'taiga', name: 'Тайга-1', file: 'taiga' },
  { id: 'redrebel', name: 'Red Rebel', file: 'RedRebel' },
  { id: 'cepen', name: 'Цепень', file: 'cepen' },
];

export function skinPrice(index: number): number {
  return index * SKIN_PRICE_STEP;
}
export function weaponById(id: string): WeaponSkin {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}

// ─── Пути ассетов ───
export const ASSET_BASE = '/images/arcade/game01';
export const cursorSrc = (file: string, state: 1 | 2) => `${ASSET_BASE}/cursor/${file}${state}.webp`;
export const itemSrc = (name: string) => `${ASSET_BASE}/items/${name}.webp`;
export const backplateSrc = (n: number) => `${ASSET_BASE}/backplate/backplate${n}.webp`;
export const errorSrc = (n: number) => `${ASSET_BASE}/errors/webp/error${n}.webp`;
export const flashSrc = `${ASSET_BASE}/flashgrenade.mp3`;
