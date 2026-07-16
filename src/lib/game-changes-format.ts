// Общие форматтеры интерпретации игровых изменений — используются и панелью
// ченджлога (game-updates), и плашками «изменено» в разделах. Чистый модуль.

export const FIELD_LABEL: Record<string, string> = {
  weight: 'Вес',
  basePrice: 'Базовая цена',
  gridWidth: 'Ширина ячеек',
  gridHeight: 'Высота ячеек',
  penetrationPower: 'Пробитие',
  damage: 'Урон',
  armorDamage: 'Урон брони',
  fragmentationChance: 'Шанс фрагментации',
  initialSpeed: 'Начальная скорость',
  armorClass: 'Класс брони',
  durability: 'Прочность',
  bluntThroughput: 'Пробитие тупым',
  ergoPenalty: 'Штраф эргономики',
  speedPenalty: 'Штраф скорости',
  turnPenalty: 'Штраф поворота',
  ergonomics: 'Эргономика',
  recoilVertical: 'Отдача вертик.',
  recoilHorizontal: 'Отдача гориз.',
  fireRate: 'Скорострельность',
  capacity: 'Вместимость',
};

// Направление «в плюс игроку»: +1 больше=лучше, −1 меньше=лучше, нет ключа — нейтрально.
export const STAT_DIRECTION: Record<string, 1 | -1> = {
  penetrationPower: 1, damage: 1, armorDamage: 1, fragmentationChance: 1, armorClass: 1,
  durability: 1, ergonomics: 1, capacity: 1, initialSpeed: 1,
  recoilVertical: -1, recoilHorizontal: -1, bluntThroughput: -1, weight: -1,
  ergoPenalty: 1, speedPenalty: 1, turnPenalty: 1,
};

export const fieldLabel = (f: string | null): string => (f ? FIELD_LABEL[f] ?? f : '');

export const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export type Verdict = 'buff' | 'nerf' | null;

export function verdict(field: string | null, oldV: string | null, newV: string | null): Verdict {
  if (!field || oldV === null || newV === null) return null;
  const dir = STAT_DIRECTION[field];
  if (!dir) return null;
  const a = Number(oldV);
  const b = Number(newV);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return (b - a) * dir > 0 ? 'buff' : 'nerf';
}
