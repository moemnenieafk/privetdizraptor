'use client';

import { useEffect, useRef, useState, useTransition, useMemo } from 'react';
import { Command, ArrowRight, History, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { getHeaderConfig, type MenuItem } from '@/data/headerConfig';
import Link from 'next/link';
import { searchEftItemsAction, searchQuestsAction } from '@/actions/search-actions';
import { SearchItemCard } from './SearchItemCard';
import { SearchQuestCard, questResultHref } from './SearchQuestCard';
import type { SearchItemResult, QuestSearchResult } from '@/types/search';
import { SearchEmptyState } from './SearchEmptyState';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useClickOutside } from '@/hooks/useClickOutside';

// Хелпер: должна ли иконка сохранять свои оригинальные цвета (без CSS-маски)
const isColoredIcon = (item: MenuItem, urlToUse?: string) => {
  if (item.coloredIcon) return true;
  const targetUrl = urlToUse || item.iconUrl;
  if (targetUrl?.endsWith('.webp')) return true;
  if (targetUrl?.includes('/02-quests/')) return true;
  if (targetUrl?.includes('/gun-modes/')) return true;
  return false;
};

// Хелпер: автосмена раскладки клавиатуры (QWERTY <-> ЙЦУКЕН)
const switchLayout = (str: string) => {
  const layoutMap: Record<string, string> = {
    'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ',
    'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж', "'": 'э',
    'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю',
    'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
    'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'э': "'",
    'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.'
  };
  return str.toLowerCase().split('').map(char => layoutMap[char] || char).join('');
};

export function TacticalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  
  const [isMac, setIsMac] = useState(false);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Состояния для контентного поиска (предметы EFT + задания)
  const [itemResults, setItemResults] = useState<SearchItemResult[]>([]);
  const [questResults, setQuestResults] = useState<QuestSearchResult[]>([]);
  const [isPending, startTransition] = useTransition();

  // Подключаем хранилище для определения фракции (влияет на иконки оружия)
  // Оптимизировано: возвращаем только примитив (строку), чтобы избежать ререндеров при смене XP или имени
  const faction = usePlayerStore((state) => {
    const profile = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
    return profile?.faction || 'BEAR';
  });

  // Выдача предметов — всегда плитка (тумблер убран). Тип расширен, чтобы list-ветка компилилась как мёртвая.
  const itemView: 'grid' | 'table' = 'grid';

  // Получаем динамический конфиг для текущего раздела
  const config = getHeaderConfig(pathname || '');

  useEffect(() => {
    // Определяем платформу для хоткея
    setIsMac(navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);

    // Глобальный слушатель клавиатуры (CMD+Q / CTRL+Q для фокуса)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'й')) {
        e.preventDefault();
        setQuery('');
        inputRef.current?.focus();
        setIsOpen(true);
      }
      // Закрытие по ESC
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Инициализация истории поиска из localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cta_recent_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) {}
  }, []);

  // Закрытие дропдауна при клике мимо него
  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  // Рекурсивно собираем плоский массив абсолютно ВСЕХ пунктов меню (на любую глубину)
  const allMenuItems = useMemo(() => {
    if (!isOpen) return []; // Вычисляем только при открытом поиске
    const getItems = (items: MenuItem[]): MenuItem[] => {
      let result: MenuItem[] = [];
      for (const item of items) {
        result.push(item);
        if (item.children) {
          result = result.concat(getItems(item.children));
        }
      }
      return result;
    };
    return getItems(config.menuItems);
  }, [config.menuItems, isOpen]);

  // Если запрос пуст — показываем только основные разделы. Иначе ищем по всем пунктам.
  const filteredResults = useMemo(() => {
    if (!isOpen) return [];
    if (query.trim().length === 0) return config.menuItems;
    
    const queryLower = query.toLowerCase();
    const switchedQuery = switchLayout(queryLower);
    
    return allMenuItems.filter(item => {
      const label = item.label.toLowerCase();
      return label.includes(queryLower) || label.includes(switchedQuery);
    });
  }, [query, allMenuItems, config.menuItems, isOpen]);

  // Эффект для дебаунса и поиска предметов
  useEffect(() => {
    if (!isOpen) return; // Не запускаем сетевые запросы, если поиск не в фокусе
    
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        startTransition(async () => {
          try {
            const q = query.trim();
            const sq = switchLayout(q);
            // При смене раскладки ищем сразу по двум вариантам параллельно.
            const terms = q === sq ? [q] : [q, sq];

            const [itemBatches, questBatches] = await Promise.all([
              Promise.all(terms.map((term) => searchEftItemsAction(term))),
              Promise.all(terms.map((term) => searchQuestsAction(term))),
            ]);

            // Объединяем варианты раскладок и удаляем дубликаты по id.
            const uniqueItems = Array.from(
              new Map(itemBatches.flat().map((i) => [i.id, i])).values()
            );
            setItemResults(uniqueItems.slice(0, 12));

            const uniqueQuests = Array.from(
              new Map(questBatches.flat().map((qst) => [qst.id, qst])).values()
            );
            setQuestResults(uniqueQuests.slice(0, 6));
          } catch (err) {
            console.error("Ошибка при поиске:", err);
            setItemResults([]);
            setQuestResults([]);
          }
        });
      } else {
        setItemResults([]);
        setQuestResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Сбрасываем выделение при обновлении результатов
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query, itemResults, questResults]);

  // Автоскролл к выбранному элементу
  useEffect(() => {
    if (selectedIndex >= 0) {
      const elem = document.getElementById(`search-result-${selectedIndex}`);
      if (elem) {
        elem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Хелперы для работы с историей запросов
  const saveSearch = (term: string) => {
    const q = term.trim();
    if (!q) return;
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('cta_recent_searches', JSON.stringify(updated));
  };

  const removeSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== term);
    setRecentSearches(updated);
    localStorage.setItem('cta_recent_searches', JSON.stringify(updated));
  };

  const clearSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('cta_recent_searches');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    // Порядок групп в выдаче: [разделы][задания][предметы]
    const menuCount = filteredResults.length;
    const questCount = questResults.length;
    const itemCount = Math.min(itemResults.length, 12);
    const totalItems = menuCount + questCount + itemCount;
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0) {
        e.preventDefault();

        saveSearch(query);

        if (selectedIndex < menuCount) {
          // Переход по разделу хаба
          router.push(filteredResults[selectedIndex].path || '#');
        } else if (selectedIndex < menuCount + questCount) {
          // Переход к карте заданий (FlyTo) или в лор для стори-квестов
          const quest = questResults[selectedIndex - menuCount];
          router.push(quest ? questResultHref(quest) : '/eft/questmap');
        } else {
          // Переход по предмету EFT
          const itemIndex = selectedIndex - menuCount - questCount;
          const targetItem = itemResults[itemIndex];
          if (targetItem) {
            router.push(`/eft/items/item/${targetItem.normalizedName}`);
          }
        }

        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Строка поиска (Обертка) */}
      <div className="group flex items-center justify-between w-full h-14 px-3.5 bg-black/20 rounded border border-lines-hover overflow-hidden transition-colors duration-300 focus-within:border-(--primary)">
        
        {/* Левая иконка (Лупа) */}
        <div 
          className="icon-mask w-6 h-6 shrink-0 text-lines-hover transition-colors duration-300 group-focus-within:text-(--primary)"
          style={{ WebkitMaskImage: 'url(/icons/eft/search-icon.svg)', maskImage: 'url(/icons/eft/search-icon.svg)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
        />
        
        {/* Поле ввода */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="ГЛОБАЛЬНЫЙ ТАКТИЧЕСКИЙ ПОИСК..."
          className="flex-1 h-full bg-transparent outline-none px-4 text-center uppercase font-blender-medium text-base sm:text-lg text-lines-hover placeholder:text-lines-hover focus:text-(--primary) placeholder:group-focus-within:text-(--primary)"
        />
        
        {/* Правая иконка (Хоткей CTRL+Q) — скрыта на тач/узких экранах */}
        <div
          className="hidden sm:block icon-mask w-10 h-5 shrink-0 text-lines-hover transition-colors duration-300 group-focus-within:text-(--primary) group-focus-within:opacity-50"
          style={{ WebkitMaskImage: 'url(/icons/eft/ctrl-q-icon.svg)', maskImage: 'url(/icons/eft/ctrl-q-icon.svg)', maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }}
        />
      </div>

      {/* Выпадающее меню результатов */}
      {isOpen && (
        // Расширяем контейнер, чтобы вместить сетку (до 1100px), центрируя его относительно инпута
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-[96vw] max-w-275 mt-2 bg-card-menu/95 backdrop-blur-xl border border-[color-mix(in_srgb,var(--primary)_50%,transparent)] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden z-60 animate-[fade-in-up_0.2s_ease-out_both]">
          
          <div className="max-h-[70vh] overflow-y-auto">
            
            {/* СЕКЦИЯ: ПОСЛЕДНИЕ ЗАПРОСЫ */}
            {query.trim().length === 0 && recentSearches.length > 0 && (
              <div className="py-2 border-b border-lines-hover/50">
                <div className="px-4 py-1.5 flex justify-between items-center bg-base/50 mb-1">
                  <span className="text-type-caption font-blender-medium tracking-widest uppercase text-text-muted">
                    Последние запросы
                  </span>
                  <button onClick={clearSearches} className="text-type-caption font-blender-medium tracking-widest uppercase text-text-secondary hover:text-danger transition-colors focus:outline-none">
                    Очистить
                  </button>
                </div>
                <ul>
                  {recentSearches.map((term, index) => (
                    <li key={`recent-${index}`}>
                      <button
                        onClick={() => { setQuery(term); inputRef.current?.focus(); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-text-secondary hover:text-text-primary group/recent focus:outline-none"
                      >
                        <div className="flex items-center gap-3">
                          <History className="w-4 h-4 opacity-40 group-hover/recent:text-(--primary) group-hover/recent:opacity-100 transition-colors" />
                          <span className="font-blender-medium uppercase tracking-wider text-sm">{term}</span>
                        </div>
                        <div role="button" onClick={(e) => removeSearch(term, e)} className="p-1 opacity-0 group-hover/recent:opacity-100 hover:text-danger transition-all">
                          <X className="w-4 h-4" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* СЕКЦИЯ: РАЗДЕЛЫ ХАБА (Навигация) */}
            {filteredResults.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1.5 bg-base/50 border-b border-lines-hover/50 mb-1">
                  <span className="text-type-caption font-blender-medium tracking-widest uppercase text-text-muted">
                    Разделы Хаба
                  </span>
                </div>
                <ul>
              {filteredResults.map((item, index) => {
                const isSelected = selectedIndex === index;
                return (
                <li key={item.id} id={`search-result-${index}`}>
                      <Link 
                        href={item.path || '#'}
                        onClick={() => { saveSearch(query); setIsOpen(false); setQuery(''); }}
                  className={`flex items-center justify-between px-4 py-2.5 transition-colors group/item ${isSelected ? 'bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-(--primary)' : 'hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-text-secondary hover:text-text-primary'}`}
                      >
                        <div className="flex items-center gap-3">
                          {(() => {
                            const iconToUse = (faction === 'USEC' && item.iconUrlUsec) ? item.iconUrlUsec : ((faction === 'BEAR' && item.iconUrlBear) ? item.iconUrlBear : item.iconUrl);
                            return iconToUse ? (
                              isColoredIcon(item, iconToUse) ? (
                                <img src={iconToUse} alt="" className="h-4 w-4 shrink-0 object-contain" />
                              ) : (
                                <div 
                                  className={`h-4 w-4 shrink-0 text-text-secondary transition-colors group-hover/item:text-(--primary) ${item.iconClass || 'icon-mask'}`}
                                  style={{ maskImage: `url(${iconToUse})`, WebkitMaskImage: `url(${iconToUse})`, maskSize: 'contain', maskPosition: 'center', maskRepeat: 'no-repeat' }}
                                />
                              )
                            ) : (
                              <Command className="w-4 h-4 opacity-40 group-hover/item:text-(--primary) group-hover/item:opacity-100 transition-colors" />
                            );
                          })()}
                          <span className="font-blender-medium uppercase tracking-wider text-sm">
                            {item.label}
                          </span>
                        </div>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover/item:opacity-100 group-hover/item:text-(--primary) transition-all -translate-x-2 group-hover/item:translate-x-0" />
                      </Link>
                    </li>
              )})}
                </ul>
              </div>
            )}

            {/* СЕКЦИЯ: ЗАДАНИЯ */}
            {questResults.length > 0 && (
              <div className="py-2 border-t border-lines-hover/50">
                <div className="px-4 py-1.5 bg-base/50 border-b border-lines-hover/50 mb-1">
                  <span className="text-type-caption font-blender-medium tracking-widest uppercase text-text-muted">
                    Задания
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5 px-2">
                  {questResults.map((quest, idx) => {
                    const globalIndex = filteredResults.length + idx;
                    const isSelected = selectedIndex === globalIndex;
                    return (
                      <li key={quest.id} id={`search-result-${globalIndex}`}>
                        <SearchQuestCard
                          item={quest}
                          isSelected={isSelected}
                          onSelect={() => { saveSearch(query); setIsOpen(false); setQuery(''); }}
                          onItemClick={(shortName) => { setQuery(shortName); setSelectedIndex(-1); inputRef.current?.focus(); }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* СЕКЦИЯ: ПРЕДМЕТЫ EFT */}
            {itemResults.length > 0 && (
              <div className="py-2 border-t border-lines-hover/50">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-base/50 border-b border-lines-hover/50 mb-1 sm:px-4">
                  <span className="text-type-caption font-blender-medium tracking-widest uppercase text-text-muted">
                    База предметов EFT
                  </span>
                </div>
                <div className="px-2 pb-3 sm:px-4 sm:pb-4">
                  <div
                    className={
                      itemView === 'grid'
                        ? 'grid grid-cols-2 gap-2 mt-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:mt-4'
                        : 'flex flex-col gap-1.5 mt-3 sm:grid sm:grid-cols-2 sm:gap-2 sm:mt-4'
                    }
                  >
                    {/* До 12 результатов; вид зависит от выбранного режима */}
                {itemResults.slice(0, 12).map((item, idx) => {
                  const globalIndex = filteredResults.length + questResults.length + idx;
                  const isSelected = selectedIndex === globalIndex;
                  return (
                    <div
                      key={item.id}
                      id={`search-result-${globalIndex}`}
                      className={`transition-all duration-200 ${itemView === 'grid' ? 'rounded-lg' : 'rounded-md'} ${isSelected ? `ring-2 ring-(--primary) shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_40%,transparent)] ${itemView === 'grid' ? 'scale-[1.03]' : ''}` : ''}`}
                    >
                      <SearchItemCard item={item} onSelect={() => { saveSearch(query); setIsOpen(false); }} />
                    </div>
                  );
                })}
                  </div>
                </div>
              </div>
            )}

            {/* СОСТОЯНИЕ: ЗАГРУЗКА — скелетон-сетка карточек (без спиннеров) */}
            {isPending && itemResults.length === 0 && (
              <div className="px-2 pt-3 pb-4 border-t border-lines-hover/50 sm:px-4">
                <div className="mb-3 h-3 w-40 rounded-xs bg-lines-hover/50 animate-pulse" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex aspect-square flex-col gap-2 rounded-md border border-lines-hover bg-card-menu/40 p-2"
                    >
                      <div className="h-2.5 w-2/3 rounded-xs bg-lines-hover/60 animate-pulse" />
                      <div className="flex-1 rounded-sm bg-lines-hover/25 animate-pulse" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-2 rounded-xs bg-lines-hover/50 animate-pulse" />
                        <div className="h-2 rounded-xs bg-lines-hover/50 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* СОСТОЯНИЕ: НИЧЕГО НЕ НАЙДЕНО */}
            {query.length > 0 && filteredResults.length === 0 && itemResults.length === 0 && !isPending && (
              <div className="p-4">
                <SearchEmptyState />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
