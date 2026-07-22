'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { usePlayerStore } from '@/store/usePlayerStore';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SavedFilters {
  sortConfig?: SortConfig;
  activeArmorClasses?: number[];
  barterOnly?: boolean;
  availableOnly?: boolean;
  priceMin?: string;
  priceMax?: string;
  favoritesOnly?: boolean;
  // Генерик-фильтры (работают на любой категории) — сохраняем глобально.
  // Подкатегории/фасеты категорийно-специфичны → только URL, не сюда (иначе «почему пусто»).
  usedIn?: string[];
  needMe?: boolean;
  profitableOnly?: boolean;
}

/** facetState ↔ URL: `key:v1,v2;key2:v3` (значения фасетов не содержат `,;:`). */
const serializeFacets = (fs: Record<string, Set<string>>): string =>
  Object.entries(fs)
    .filter(([, s]) => s.size > 0)
    .map(([k, s]) => `${k}:${[...s].join(',')}`)
    .join(';');
const parseFacets = (raw: string | null): Record<string, Set<string>> => {
  if (!raw) return {};
  const out: Record<string, Set<string>> = {};
  for (const part of raw.split(';')) {
    const [k, vals] = part.split(':');
    if (k && vals) out[k] = new Set(vals.split(','));
  }
  return out;
};

export function useCategoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const initialDir = searchParams.get('dir');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: searchParams.get('sort') || 'vps',
    direction: (initialDir === 'asc' || initialDir === 'desc') ? initialDir : 'desc',
  });

  const initialArmor = searchParams.get('armor');
  const [activeArmorClasses, setActiveArmorClasses] = useState<number[]>(
    initialArmor ? initialArmor.split(',').map(Number).filter(n => !isNaN(n)) : [1, 2, 3, 4, 5, 6]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [barterOnly, setBarterOnly] = useState(searchParams.get('barter') === 'true');
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('available') === 'true');
  const [isSaved, setIsSaved] = useState(false);

  // Advanced filters — цены
  const [priceMin, setPriceMin] = useState(searchParams.get('pmin') || '');
  const [priceMax, setPriceMax] = useState(searchParams.get('pmax') || '');
  const [favoritesOnly, setFavoritesOnly] = useState(searchParams.get('fav') === 'true');

  // Генерик «отображать только»: назначение (usedIn) + «нужно мне» (needMe).
  const initialUsedIn = searchParams.get('used');
  const [usedIn, setUsedIn] = useState<string[]>(initialUsedIn ? initialUsedIn.split(',') : []);
  const [needMe, setNeedMe] = useState(searchParams.get('need') === 'true');
  const [profitableOnly, setProfitableOnly] = useState(searchParams.get('profit') === 'true');

  // Категорийно-специфичные: подкатегории («Выбор категорий») + enum-фасеты. Только URL.
  const initialSub = searchParams.get('sub');
  const [activeSubcats, setActiveSubcats] = useState<Set<string>>(new Set(initialSub ? initialSub.split(',') : []));
  const [facetState, setFacetState] = useState<Record<string, Set<string>>>(() => parseFacets(searchParams.get('facet')));
  // Совместимость мод↔оружие (только слаги модов): id выбранного ствола. URL-only.
  const [compatWeapon, setCompatWeapon] = useState(searchParams.get('compat') || '');

  const profiles = usePlayerStore((state) => state.profiles);
  const activeProfileId = usePlayerStore((state) => state.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const playerLevel = Number(activeProfile?.level) || 1;

  useEffect(() => {
    setIsLoading(false);
    if (!window.location.search) {
      try {
        const savedStr = localStorage.getItem('cta_items_filters_v1');
        if (savedStr) {
          const saved = JSON.parse(savedStr) as SavedFilters;
          if (saved.sortConfig) setSortConfig(saved.sortConfig);
          if (saved.activeArmorClasses) setActiveArmorClasses(saved.activeArmorClasses);
          if (saved.barterOnly !== undefined) setBarterOnly(saved.barterOnly);
          if (saved.availableOnly !== undefined) setAvailableOnly(saved.availableOnly);
          if (saved.priceMin) setPriceMin(saved.priceMin);
          if (saved.priceMax) setPriceMax(saved.priceMax);
          if (saved.favoritesOnly !== undefined) setFavoritesOnly(saved.favoritesOnly);
          if (saved.usedIn) setUsedIn(saved.usedIn);
          if (saved.needMe !== undefined) setNeedMe(saved.needMe);
          if (saved.profitableOnly !== undefined) setProfitableOnly(saved.profitableOnly);
        }
      } catch (e) {
        console.error('Local storage access error', e);
      }
    }
  }, []);

  // #2: категорийно-специфичные фильтры (калибр, класс брони) НЕ переносим между
  // разделами — иначе на категории, где контрол скрыт, список молча пустеет
  // («почему пусто»). Первый рендер/дип-линк (?armor=,?facet=) пропускаем через ref.
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    setActiveArmorClasses([1, 2, 3, 4, 5, 6]);
    // Подкатегории/фасеты (в т.ч. калибр) категорийно-специфичны — слаги/значения
    // раздела X на разделе Y не имеют смысла (иначе membership/фасет обнулит список).
    setActiveSubcats(new Set());
    setFacetState({});
    setCompatWeapon('');
  }, [pathname]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchQuery) params.set('q', searchQuery); else params.delete('q');
      if (sortConfig.key !== 'vps') params.set('sort', sortConfig.key); else params.delete('sort');
      if (sortConfig.direction !== 'desc') params.set('dir', sortConfig.direction); else params.delete('dir');
      if (barterOnly) params.set('barter', 'true'); else params.delete('barter');
      if (availableOnly) params.set('available', 'true'); else params.delete('available');
      if (activeArmorClasses.length > 0 && activeArmorClasses.length < 6)
        params.set('armor', [...activeArmorClasses].sort((a, b) => a - b).join(','));
      else params.delete('armor');
      if (priceMin) params.set('pmin', priceMin); else params.delete('pmin');
      if (priceMax) params.set('pmax', priceMax); else params.delete('pmax');
      if (favoritesOnly) params.set('fav', 'true'); else params.delete('fav');
      if (usedIn.length > 0) params.set('used', usedIn.join(',')); else params.delete('used');
      if (needMe) params.set('need', 'true'); else params.delete('need');
      if (profitableOnly) params.set('profit', 'true'); else params.delete('profit');
      if (activeSubcats.size > 0) params.set('sub', [...activeSubcats].join(',')); else params.delete('sub');
      const facetStr = serializeFacets(facetState);
      if (facetStr) params.set('facet', facetStr); else params.delete('facet');
      if (compatWeapon) params.set('compat', compatWeapon); else params.delete('compat');

      const query = params.toString();
      if (query !== searchParams.toString()) {
        router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortConfig, barterOnly, availableOnly, activeArmorClasses,
      priceMin, priceMax, favoritesOnly,
      usedIn, needMe, profitableOnly, activeSubcats, facetState, compatWeapon,
      pathname, router, searchParams]);

  const handleDropdownSort = (key: string) => {
    setSortConfig({ key, direction: key === 'name' ? 'asc' : 'desc' });
  };

  const toggleArmorClass = (ac: number) => {
    setActiveArmorClasses(prev => prev.includes(ac) ? prev.filter(c => c !== ac) : [...prev, ac]);
  };

  const toggleUsedIn = (key: string) =>
    setUsedIn(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const toggleSubcat = (id: string) =>
    setActiveSubcats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const clearSubcats = () => setActiveSubcats(new Set());

  const toggleFacet = (key: string, value: string, multi: boolean) =>
    setFacetState(prev => {
      const cur = new Set(prev[key] ?? []);
      if (cur.has(value)) cur.delete(value);
      else { if (!multi) cur.clear(); cur.add(value); }
      return { ...prev, [key]: cur };
    });
  // Одиночный выбор для фасета-дропдауна (пустое value = «Все» → снять фасет).
  const setFacetSingle = (key: string, value: string) =>
    setFacetState(prev => ({ ...prev, [key]: value ? new Set([value]) : new Set() }));
  const clearFacets = () => setFacetState({});

  const handleSaveFilters = () => {
    localStorage.setItem('cta_items_filters_v1', JSON.stringify({
      sortConfig, activeArmorClasses, barterOnly, availableOnly,
      priceMin, priceMax, favoritesOnly, usedIn, needMe, profitableOnly,
    }));
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setActiveArmorClasses([1, 2, 3, 4, 5, 6]);
    setBarterOnly(false);
    setAvailableOnly(false);
    setSortConfig({ key: 'vps', direction: 'desc' });
    setPriceMin('');
    setPriceMax('');
    setFavoritesOnly(false);
    setUsedIn([]);
    setNeedMe(false);
    setProfitableOnly(false);
    setActiveSubcats(new Set());
    setFacetState({});
    setCompatWeapon('');
  };

  const resetAdvancedFilters = () => {
    setPriceMin('');
    setPriceMax('');
    setActiveSubcats(new Set());
    setFacetState({});
    setCompatWeapon('');
  };

  return {
    searchQuery, setSearchQuery,
    sortConfig,
    activeArmorClasses,
    isLoading,
    barterOnly, setBarterOnly,
    availableOnly, setAvailableOnly,
    isSaved,
    playerLevel,
    // Advanced — цены
    priceMin, setPriceMin,
    priceMax, setPriceMax,
    favoritesOnly, setFavoritesOnly,
    // Генерик «отображать только»
    usedIn, toggleUsedIn, setUsedIn,
    needMe, setNeedMe,
    profitableOnly, setProfitableOnly,
    // Категорийно-специфичные (URL only)
    activeSubcats, toggleSubcat, clearSubcats,
    facetState, toggleFacet, setFacetSingle, clearFacets,
    compatWeapon, setCompatWeapon,
    handleDropdownSort,
    toggleArmorClass,
    handleSaveFilters,
    resetFilters,
    resetAdvancedFilters,
  };
}
