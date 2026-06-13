'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { usePlayerStore } from '@/store/usePlayerStore';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface SavedFilters {
  viewMode?: 'grid' | 'table';
  sortConfig?: SortConfig;
  activeArmorClasses?: number[];
  barterOnly?: boolean;
  availableOnly?: boolean;
}

export function useCategoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialView = searchParams.get('view');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(
    (initialView === 'grid' || initialView === 'table') ? initialView : 'table'
  );
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
          if (saved.viewMode) setViewMode(saved.viewMode);
          if (saved.sortConfig) setSortConfig(saved.sortConfig);
          if (saved.activeArmorClasses) setActiveArmorClasses(saved.activeArmorClasses);
          if (saved.barterOnly !== undefined) setBarterOnly(saved.barterOnly);
          if (saved.availableOnly !== undefined) setAvailableOnly(saved.availableOnly);
        }
      } catch (e) {
        console.error('Local storage access error', e);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (searchQuery) params.set('q', searchQuery); else params.delete('q');
      if (sortConfig.key !== 'vps') params.set('sort', sortConfig.key); else params.delete('sort');
      if (sortConfig.direction !== 'desc') params.set('dir', sortConfig.direction); else params.delete('dir');
      if (barterOnly) params.set('barter', 'true'); else params.delete('barter');
      if (availableOnly) params.set('available', 'true'); else params.delete('available');
      if (viewMode !== 'table') params.set('view', viewMode); else params.delete('view');
      if (activeArmorClasses.length > 0 && activeArmorClasses.length < 6)
        params.set('armor', [...activeArmorClasses].sort((a, b) => a - b).join(','));
      else params.delete('armor');

      const query = params.toString();
      if (query !== searchParams.toString()) {
        router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, sortConfig, barterOnly, availableOnly, viewMode, activeArmorClasses, pathname, router, searchParams]);

  const handleColumnSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handleDropdownSort = (key: string) => {
    setSortConfig({ key, direction: key === 'name' ? 'asc' : 'desc' });
  };

  const toggleArmorClass = (ac: number) => {
    setActiveArmorClasses(prev => prev.includes(ac) ? prev.filter(c => c !== ac) : [...prev, ac]);
  };

  const handleSaveFilters = () => {
    localStorage.setItem('cta_items_filters_v1', JSON.stringify({
      viewMode, sortConfig, activeArmorClasses, barterOnly, availableOnly,
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
  };

  return {
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    sortConfig,
    activeArmorClasses,
    isLoading,
    barterOnly, setBarterOnly,
    availableOnly, setAvailableOnly,
    isSaved,
    playerLevel,
    handleColumnSort,
    handleDropdownSort,
    toggleArmorClass,
    handleSaveFilters,
    resetFilters,
  };
}
