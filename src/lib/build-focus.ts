// «Уклон» сборки: что она вообще даёт. Боль игрока — глядя на 15 модулей, непонятно,
// это лазерган, тапалка или бюджетный вариант «лишь бы стреляло».
//
// Считаем ЧЕСТНО из дельты к стоку, а не по названиям модулей: отдача срезана на X%,
// эргономика +Y, стоит Z. Никаких «мета-тегов» с чужих тир-листов.
import type { BuildItemIndex, BuildResult, BuildStatsDelta } from '@/lib/weapon-build';

export type FocusId =
  | 'stock'
  | 'recoil'
  | 'ergonomics'
  | 'balanced'
  | 'stealth'
  | 'longrange'
  | 'budget';

export interface FocusTag {
  id: string;
  label: string;
}

export interface BuildFocus {
  id: FocusId;
  /** Ярлык для карточки: «Лазерган», «Тапалка»… */
  label: string;
  /** Одна строка объяснения — с реальными числами, а не водой. */
  hint: string;
  tags: FocusTag[];
  /** Доля срезанной отдачи: 0.32 = −32% к стоку. */
  recoilCut: number;
  /** Прибавка эргономики к стоку. */
  ergoGain: number;
}

/** Глушитель гасит звук: суммарный loudness уходит в минус. */
const isSuppressed = (result: BuildResult): boolean => result.stats.loudness < 0;

/** Оптика — всё, что встало в слот прицела. */
const hasOptics = (result: BuildResult): boolean =>
  result.parts.some((p) => p.slotNameId.toLowerCase().startsWith('mod_scope'));

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export function buildFocus(
  result: BuildResult,
  delta: BuildStatsDelta,
  index: BuildItemIndex,
  totalRub: number | null,
): BuildFocus {
  const { stock, current } = delta;

  const recoilCut =
    stock.recoilSum > 0 ? (stock.recoilSum - current.recoilSum) / stock.recoilSum : 0;
  const ergoGain = delta.ergonomics;

  const suppressed = isSuppressed(result);
  const optics = hasOptics(result);
  const modCount = result.stats.modCount;

  /* ───────── теги ───────── */
  const tags: FocusTag[] = [];

  if (suppressed) tags.push({ id: 'suppressed', label: 'Глушитель' });
  if (optics) tags.push({ id: 'optics', label: 'Оптика' });

  if (current.capacity != null && current.capacity >= 45) {
    tags.push({ id: 'bigmag', label: `Магазин ${current.capacity}` });
  }
  if (current.weight >= 5) tags.push({ id: 'heavy', label: 'Тяжёлая' });

  if (totalRub != null && modCount >= 3) {
    if (totalRub <= 60_000) tags.push({ id: 'cheap', label: 'Бюджет' });
    else if (totalRub >= 250_000) tags.push({ id: 'expensive', label: 'Дорогая' });
  }

  /* ───────── основной уклон ─────────
     Порядок правил = приоритет. Первое совпадение выигрывает: сборка может быть и
     тихой, и лазерганом, но человеку нужен ОДИН ответ «что это», остальное — теги. */

  if (modCount === 0) {
    return {
      id: 'stock',
      label: 'Сток',
      hint: 'Голый ствол без обвеса — как выдают.',
      tags,
      recoilCut,
      ergoGain,
    };
  }

  if (recoilCut >= 0.25 && ergoGain < 5) {
    return {
      id: 'recoil',
      label: 'Лазерган',
      hint: `Отдача срезана на ${pct(recoilCut)} — ствол клеится в одну точку. Эргономика в жертву.`,
      tags,
      recoilCut,
      ergoGain,
    };
  }

  if (ergoGain >= 12 && recoilCut < 0.15) {
    return {
      id: 'ergonomics',
      label: 'Тапалка',
      hint: `+${ergoGain} эргономики: быстрая доводка и мало устаёт. Отдачу почти не трогали.`,
      tags,
      recoilCut,
      ergoGain,
    };
  }

  if (recoilCut >= 0.15 && ergoGain >= 5) {
    return {
      id: 'balanced',
      label: 'Универсал',
      hint: `Отдача −${pct(recoilCut)}, эргономика +${ergoGain}. Компромисс без перекосов.`,
      tags,
      recoilCut,
      ergoGain,
    };
  }

  if (suppressed) {
    return {
      id: 'stealth',
      label: 'Тихая',
      hint: 'Глушитель: не светит маркер на миникарте и глушит 3D-спот.',
      tags,
      recoilCut,
      ergoGain,
    };
  }

  if (optics) {
    return {
      id: 'longrange',
      label: 'Дальняя',
      hint: 'Оптика: работа на средних и дальних дистанциях.',
      tags,
      recoilCut,
      ergoGain,
    };
  }

  if (totalRub != null && totalRub <= 60_000) {
    return {
      id: 'budget',
      label: 'Бюджет',
      hint: 'Дёшево и сердито: ствол на выброс, не жалко потерять.',
      tags,
      recoilCut,
      ergoGain,
    };
  }

  return {
    id: 'balanced',
    label: 'Универсал',
    hint: `Отдача −${pct(recoilCut)}, эргономика ${ergoGain >= 0 ? '+' : ''}${ergoGain}.`,
    tags,
    recoilCut,
    ergoGain,
  };
}

/** Цвет ярлыка уклона в интерфейсе — по смыслу, не по палитре наугад. */
export function focusAccent(id: FocusId): 'primary' | 'muted' {
  return id === 'stock' ? 'muted' : 'primary';
}
