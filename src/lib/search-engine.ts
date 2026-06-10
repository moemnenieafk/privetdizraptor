import { EftItem } from './eft-api';

import { SLANG_MAP } from '../data/slang';

export function searchItems(items: EftItem[], query: string): EftItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  const searchTerms = normalizedQuery.split(/\s+/);

  // Собираем все активные сленговые правила из запроса
  const activeSlangRules = searchTerms.map(term => SLANG_MAP[term]).filter(Boolean);
  
  // Учитываем фразу целиком, если она есть в словаре (например "золотая звезда")
  if (SLANG_MAP[normalizedQuery] && !activeSlangRules.includes(SLANG_MAP[normalizedQuery])) {
    activeSlangRules.push(SLANG_MAP[normalizedQuery]);
  }

  const scoredItems = items.map(item => {
    let score = 0;
    
    // Защита от null: API (lang: ru) иногда возвращает предметы без перевода
    const name = (item.name || '').toLowerCase();
    const shortName = (item.shortName || '').toLowerCase();
    const types = item.types || [];

    // 1. Применение правил Сленга и Радара Типов
    for (const rule of activeSlangRules) {
      // Если предмет не проходит по жесткому типу (например, ищем прицел, а попался ключ)
      if (rule.type && !types.includes(rule.type)) {
        return { item, score: -1 };
      }
      
      // Проверка на соответствие маркеру сленга
      if (rule.matches) {
        let matched = false;
        for (const matchStr of rule.matches) {
          if (name.includes(matchStr) || shortName.includes(matchStr)) {
            score += 1000;
            matched = true;
            break;
          }
        }
        // Если юзер ввел только одно слово-сленг (например "ксюха"), 
        // и предмет не подошел ни под один из алиасов (акс-74у) -> жестко отсекаем его, чтобы не было мусора
        if (!matched && searchTerms.length === 1) {
          return { item, score: -1 };
        }
      }
    }

    // 2. Двухуровневый скоринг
    if (name === normalizedQuery || shortName === normalizedQuery) score += 500;
    else if (name.startsWith(normalizedQuery) || shortName.startsWith(normalizedQuery)) score += 100;
    else if (name.includes(normalizedQuery) || shortName.includes(normalizedQuery)) score += 50;

    // 3. Оценка по совпадению отдельных слов
    let wordsMatched = 0;
    for (const term of searchTerms) {
      if (name.includes(term) || shortName.includes(term)) wordsMatched++;
    }
    
    if (wordsMatched > 0) score += wordsMatched * 10;
    // Бонус за фулл совпадение фразы
    if (wordsMatched === searchTerms.length && searchTerms.length > 1) score += 30; 

    return { item, score };
  });

  // Фильтруем нулевые результаты, сортируем по скору
  return scoredItems.filter(res => res.score > 0).sort((a, b) => b.score - a.score).map(res => res.item);
}