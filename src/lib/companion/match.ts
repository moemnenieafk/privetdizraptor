// Сопоставление распознанного OCR-имени с нашим каталогом (v0-идентичность).
// Шаг 2 заменит/дополнит это icon-match'ем (надёжнее на кириллице). Здесь — фаззи
// по биграммам (коэффициент Дайса): устойчив к шуму OCR и опечаткам символов.

export interface CatalogEntry {
  inGameId: string;
  name: string;
  maxUses?: number; // макс. использований (ключи/износ) — статик-свойство из каталога
}

export interface MatchResult {
  inGameId: string;
  name: string;
  score: number; // 0..1
  maxUses?: number; // проброшен из каталога: есть только у ключей/износа
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

// Визуально/OCR-путаемые цифры (3↔5, 8↔6, 0↔8…): замена одной на другую дёшева,
// т.к. это типичный мисрид, а не другой предмет. «1» ни с чем не путается (палочка).
const DIGIT_CONFUSE = new Set(
  ['35', '38', '58', '68', '08', '69', '89', '06', '56'].flatMap((p) => [p, p[1] + p[0]]),
);
function subCost(a: string, b: string): number {
  if (a === b) return 0;
  if (a >= '0' && a <= '9' && b >= '0' && b <= '9') return DIGIT_CONFUSE.has(a + b) ? 0.4 : 1;
  return 1;
}

/**
 * Взвешенное расстояние Левенштейна: замена похожих цифр (OCR-мисрид 3↔5) стоит меньше.
 * Различает близнецов «С-1»/«С-3» И правильно снапит мисрид «С-5» на С-3 (а не С-1).
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + subCost(a[i - 1], b[j - 1]));
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Матчер из каталога. Dice-биграммы дают шорт-лист (устойчивы к шуму/перестановкам),
 * а близкие кандидаты (в пределах TIE от лучшего) разрешаем по edit-distance —
 * различает имена-близнецы, отличающиеся одним символом («…отсека С-1» vs «С-3»,
 * «РБ-ВО» vs «РБ-ВП»), где биграммы почти равны и тайбрейк брал не тот.
 */
export function buildMatcher(catalog: CatalogEntry[]): (text: string) => MatchResult | null {
  const index = catalog.map((e) => ({ entry: e, grams: bigrams(normalize(e.name)), norm: normalize(e.name) }));
  const TIE = 0.08;

  return (text: string): MatchResult | null => {
    const qn = normalize(text);
    const q = bigrams(qn);
    if (q.size === 0) return null;

    const scored = index.map((x) => ({ x, score: dice(q, x.grams) }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    // Порог — отсекаем мусорный OCR. 0.5 подобран под шум кириллицы; тюнится живьём.
    if (!top || top.score < 0.5) return null;

    // Близкие по Dice → снапим на РЕАЛЬНЫЙ предмет по взвешенному edit-distance.
    // Каталог (5044) — единственный источник истины: «С-5» не существует → это мисрид,
    // а 5↔3 путаемы (5↔1 нет) → снап на С-3. Не дропаем, не изобретаем.
    const close = scored.filter((s) => top.score - s.score <= TIE);
    const winner =
      close.length > 1
        ? close.reduce((best, s) =>
            levenshtein(qn, s.x.norm) < levenshtein(qn, best.x.norm) ? s : best,
          )
        : top;

    return { inGameId: winner.x.entry.inGameId, name: winner.x.entry.name, score: top.score, maxUses: winner.x.entry.maxUses };
  };
}
