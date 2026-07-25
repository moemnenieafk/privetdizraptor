// Домен «Ресток торговцев» — чистые хелперы, без React и без внешних API.
// Экстраполяция: зеркало (tarkov.dev → cron, раз в сутки) даёт resetTime = ЯКОРЬ
// одного из моментов рестока. Реальный «ближайший» ресток вычисляем на клиенте,
// прокручивая якорь целыми интервалами вперёд. Интервал — бутстрап-константа (Фаза 1),
// в Фазе 2 калибруется в кроне по дельте двух подряд resetTime. См. memory sprint.

// Бутстрап-интервал рестока (сек). EFT-кадэнс стабилен внутри вайпа; точное
// per-trader значение приезжает из Фазы 2 (поле intervalSec в ответе роута).
export const DEFAULT_RESTOCK_INTERVAL_SEC = 3 * 3600; // 3ч

// Каноничный ростер рестока EFT (8 торговцев с периодическим обновлением ассортимента).
// Скупщик (Fence) — динамический ассорт, Смотритель Маяка и Водитель БТР рестока не
// имеют → в виджете не показываем (совпадает с эталоном tarkov-market).
export const RESTOCK_TRADER_SLUGS = [
  'prapor',
  'therapist',
  'skier',
  'peacekeeper',
  'mechanic',
  'ragman',
  'jaeger',
  'ref',
] as const;

export interface RestockTrader {
  slug: string;
  nameRu: string;
  nameEn: string;
  image: string;
  currency: string;
  /** ISO-время одного из моментов рестока (якорь из зеркала). null → рестока нет. */
  resetTime: string | null;
  /** Интервал рестока в секундах (Фаза 1 — бутстрап-дефолт, Фаза 2 — калибровка). */
  intervalSec: number;
}

export interface RestockPayload {
  gameMode: string;
  updated: number;
  traders: RestockTrader[];
}

/**
 * Ближайший момент рестока (мс, epoch) для торговца.
 * Прокручивает якорь `anchor` вперёд целыми интервалами до первого момента > now.
 * Возвращает null, если якоря/интервала нет.
 */
export function nextRestockMs(
  resetTime: string | null,
  intervalSec: number,
  nowMs: number,
): number | null {
  if (!resetTime) return null;
  const anchor = new Date(resetTime).getTime();
  if (!Number.isFinite(anchor)) return null;
  const stepMs = intervalSec * 1000;
  if (stepMs <= 0) return anchor > nowMs ? anchor : null;
  if (anchor > nowMs) return anchor;
  // сколько целых интервалов прошло с якоря → следующая граница цикла
  const cycles = Math.floor((nowMs - anchor) / stepMs) + 1;
  return anchor + cycles * stepMs;
}

/** Доля текущего цикла, ПРОЙДЕННАЯ к now (0 сразу после рестока → 1 перед следующим). */
export function cycleProgress(nextMs: number, intervalSec: number, nowMs: number): number {
  const stepMs = intervalSec * 1000;
  if (stepMs <= 0) return 0;
  const elapsed = stepMs - (nextMs - nowMs);
  return Math.min(1, Math.max(0, elapsed / stepMs));
}

/** «07:51» (mm:ss) при <1ч, «1:45:36» (h:mm:ss) при ≥1ч. `00:00` при <=0. */
export function formatRestockHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** «в 16:15» — локальное HH:mm абсолютного момента рестока. */
export function formatAbsoluteHM(ms: number): string {
  return new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Пресеты «напомнить до рестока» (сек). offset 0 = «в момент». */
export const RESTOCK_OFFSETS: { label: string; sec: number }[] = [
  { label: 'в момент', sec: 0 },
  { label: '30 сек', sec: 30 },
  { label: '1 мин', sec: 60 },
  { label: '2 мин', sec: 120 },
  { label: '3 мин', sec: 180 },
  { label: '5 мин', sec: 300 },
  { label: '10 мин', sec: 600 },
  { label: '30 мин', sec: 1800 },
];
