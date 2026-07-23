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

/** Расстояние Левенштейна (посимвольное) — различает близнецов вроде «С-1» vs «С-3». */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
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

    // Близкие по Dice → выбираем ближайшего по edit-distance к OCR-строке.
    const close = scored.filter((s) => top.score - s.score <= TIE);
    if (close.length > 1) {
      const winner = close.reduce((best, s) =>
        levenshtein(qn, s.x.norm) < levenshtein(qn, best.x.norm) ? s : best,
      );
      // Семья твинов (С-1/С-3, РБ-ВО/РБ-ВП): цифра-дискриминатор высоко различительна,
      // а OCR её путает (3↔5). Если цифры запроса НЕ совпали с выбранным — это мисрид
      // цифры ИЛИ не тот предмет → НЕ гадаем (иначе С-3-мисрид «С-5» отравил бы С-1).
      const qd = (qn.match(/\d+/g) ?? []).join('');
      const wd = (winner.x.norm.match(/\d+/g) ?? []).join('');
      if (qd && qd !== wd) return null;
      return { inGameId: winner.x.entry.inGameId, name: winner.x.entry.name, score: top.score };
    }

    return { inGameId: top.x.entry.inGameId, name: top.x.entry.name, score: top.score };
  };
}
