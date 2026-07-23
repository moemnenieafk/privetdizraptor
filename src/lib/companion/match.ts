// Сопоставление распознанного OCR-имени с нашим каталогом (v0-идентичность).
// Шаг 2 заменит/дополнит это icon-match'ем (надёжнее на кириллице). Здесь — фаззи
// по биграммам (коэффициент Дайса): устойчив к шуму OCR и опечаткам символов.

export interface CatalogEntry {
  inGameId: string;
  name: string;
}

export interface MatchResult {
  inGameId: string;
  name: string;
  score: number; // 0..1
}

/** Нормализация: нижний регистр, только буквы/цифры (кир+лат), схлопнуть пробелы. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^0-9a-zа-яё]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Множество биграмм строки (по символам, пробелы убраны). */
function bigrams(s: string): Set<string> {
  const t = s.replace(/\s/g, '');
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/** Матчер из каталога: предвычисляем биграммы имён один раз. */
export function buildMatcher(catalog: CatalogEntry[]): (text: string) => MatchResult | null {
  const index = catalog.map((e) => ({ entry: e, grams: bigrams(normalize(e.name)) }));

  return (text: string): MatchResult | null => {
    const q = bigrams(normalize(text));
    if (q.size === 0) return null;
    let best: MatchResult | null = null;
    for (const { entry, grams } of index) {
      const score = dice(q, grams);
      if (!best || score > best.score) best = { inGameId: entry.inGameId, name: entry.name, score };
    }
    // Порог — отсекаем мусорный OCR. 0.5 подобран под шум кириллицы; тюнится живьём.
    return best && best.score >= 0.5 ? best : null;
  };
}
