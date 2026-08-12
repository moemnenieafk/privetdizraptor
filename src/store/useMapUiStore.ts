import { create } from 'zustand';

export type MapSheet = 'maps' | 'quests' | 'search' | 'layers' | 'raid' | 'tools' | 'questDetail';

/**
 * Оверлей «пересборки слоя» поверх карты. Прячет транзиентный сбой Leaflet-перемонтажа
 * после мутации метки (router.refresh роняет useEffect карты → 500): вместо этого показываем
 * фирменный пиксель-лоадер и делаем чистый full-reload (гонки appendChild у него нет).
 * `tone:'busy'` — идёт перезагрузка (без кнопок); `tone:'error'` — реальный сбой записи (кнопка «Закрыть»).
 */
export interface ReloadOverlay {
  title: string;
  sub?: string;
  tone: 'busy' | 'error';
}

interface MapUiState {
  activeSheet: MapSheet | null;
  /** Выбранный квест для мобильного drawer'а деталей (sheet 'questDetail'). */
  selectedQuestId: string | null;
  chromeCollapsed: boolean;
  /** Открыта ли панель слоёв/фильтров. Единый канал для десктоп-бара и мобильного MobileMapBar. */
  layersOpen: boolean;
  /** Открыт ли левый drawer «ПОИСК НА ЛОКАЦИИ» (десктоп). Левая лупа в баре. */
  searchOpen: boolean;
  /** Активен ли инструмент «линейка» (click-to-measure). Тоггл в баре, замер — во вьюере. */
  rulerActive: boolean;
  /** id editorial-маркеров, помеченных на удаление (батч-подтверждение в drawer «Удаление маркеров»). */
  deleteMarks: string[];
  /** Открыт ли правый drawer «Удаление маркеров» (admin). */
  deleteOpen: boolean;
  /** Открыт ли правый drawer «Сквад» (шаринг позиции). */
  squadOpen: boolean;
  /** id editorial-маркеров, выбранных для БАТЧ-ПРАВКИ (drawer «Батч-правка», editorial-карты). */
  editMarks: string[];
  /** Открыт ли правый drawer «Батч-правка» (admin, editorial). Он же — режим выбора кликом по метке. */
  editOpen: boolean;
  openSheet: (sheet: MapSheet) => void;
  closeSheet: () => void;
  toggleSheet: (sheet: MapSheet) => void;
  /** Открыть мобильный drawer деталей квеста поверх карты (M6). */
  openQuestDetail: (questId: string) => void;
  toggleChrome: () => void;
  setLayersOpen: (v: boolean) => void;
  toggleLayers: () => void;
  setSearchOpen: (v: boolean) => void;
  toggleSearch: () => void;
  setRulerActive: (v: boolean) => void;
  toggleRuler: () => void;
  toggleDeleteMark: (id: string) => void;
  clearDeleteMarks: () => void;
  setDeleteOpen: (v: boolean) => void;
  toggleDelete: () => void;
  setSquadOpen: (v: boolean) => void;
  toggleSquad: () => void;
  toggleEditMark: (id: string) => void;
  clearEditMarks: () => void;
  setEditOpen: (v: boolean) => void;
  toggleEdit: () => void;
  /** Режим постановки маркера (admin): следующий клик по карте → черновик. */
  addMode: boolean;
  /** Режим правки синканных маркеров (admin): клик по маркеру → карточка-оверрайд. */
  overrideMode: boolean;
  setAddMode: (v: boolean) => void;
  setOverrideMode: (v: boolean) => void;
  toggleAddMode: () => void;
  toggleOverrideMode: () => void;
  /** Оверлей «пересборки слоя» поверх карты (см. ReloadOverlay). null = скрыт. */
  reloadOverlay: ReloadOverlay | null;
  setReloadOverlay: (o: ReloadOverlay | null) => void;
}

// На узких экранах (<1440) два drawer'а налезают друг на друга → открытие одного
// авто-закрывает противоположный. На широких — независимые тогглы (GRILL-2 правило 4).
const narrow = (): boolean => typeof window !== 'undefined' && window.innerWidth < 1440;

export const useMapUiStore = create<MapUiState>((set) => ({
  activeSheet: null,
  selectedQuestId: null,
  chromeCollapsed: false,
  layersOpen: false,
  searchOpen: false,
  rulerActive: false,
  openSheet: (sheet) => set({ activeSheet: sheet }),
  closeSheet: () => set({ activeSheet: null }),
  toggleSheet: (sheet) =>
    set((s) => ({ activeSheet: s.activeSheet === sheet ? null : sheet })),
  // Тап по квесту в шите заданий → drawer деталей поверх карты (не уводит на /eft/questmap).
  openQuestDetail: (questId) => set({ activeSheet: 'questDetail', selectedQuestId: questId }),
  toggleChrome: () => set((s) => ({ chromeCollapsed: !s.chromeCollapsed })),
  setLayersOpen: (layersOpen) =>
    set((s) => ({ layersOpen, deleteOpen: layersOpen ? false : s.deleteOpen, squadOpen: layersOpen ? false : s.squadOpen, editOpen: layersOpen ? false : s.editOpen, searchOpen: layersOpen && narrow() ? false : s.searchOpen })),
  toggleLayers: () =>
    set((s) => {
      const layersOpen = !s.layersOpen;
      return { layersOpen, deleteOpen: layersOpen ? false : s.deleteOpen, squadOpen: layersOpen ? false : s.squadOpen, editOpen: layersOpen ? false : s.editOpen, searchOpen: layersOpen && narrow() ? false : s.searchOpen };
    }),
  setSearchOpen: (searchOpen) =>
    set((s) => ({ searchOpen, layersOpen: searchOpen && narrow() ? false : s.layersOpen })),
  toggleSearch: () =>
    set((s) => {
      const searchOpen = !s.searchOpen;
      return { searchOpen, layersOpen: searchOpen && narrow() ? false : s.layersOpen };
    }),
  setRulerActive: (rulerActive) => set({ rulerActive }),
  toggleRuler: () => set((s) => ({ rulerActive: !s.rulerActive })),
  deleteMarks: [],
  deleteOpen: false,
  squadOpen: false,
  editMarks: [],
  editOpen: false,
  toggleEditMark: (id) =>
    set((s) => ({ editMarks: s.editMarks.includes(id) ? s.editMarks.filter((x) => x !== id) : [...s.editMarks, id] })),
  clearEditMarks: () => set({ editMarks: [] }),
  setEditOpen: (editOpen) =>
    set((s) => ({ editOpen, layersOpen: editOpen ? false : s.layersOpen, deleteOpen: editOpen ? false : s.deleteOpen, squadOpen: editOpen ? false : s.squadOpen, searchOpen: editOpen && narrow() ? false : s.searchOpen })),
  toggleEdit: () =>
    set((s) => {
      const editOpen = !s.editOpen;
      return { editOpen, layersOpen: editOpen ? false : s.layersOpen, deleteOpen: editOpen ? false : s.deleteOpen, squadOpen: editOpen ? false : s.squadOpen, searchOpen: editOpen && narrow() ? false : s.searchOpen };
    }),
  toggleDeleteMark: (id) =>
    set((s) => ({ deleteMarks: s.deleteMarks.includes(id) ? s.deleteMarks.filter((x) => x !== id) : [...s.deleteMarks, id] })),
  clearDeleteMarks: () => set({ deleteMarks: [] }),
  setDeleteOpen: (deleteOpen) =>
    set((s) => ({ deleteOpen, layersOpen: deleteOpen ? false : s.layersOpen, squadOpen: deleteOpen ? false : s.squadOpen, editOpen: deleteOpen ? false : s.editOpen, searchOpen: deleteOpen && narrow() ? false : s.searchOpen })),
  toggleDelete: () =>
    set((s) => {
      const deleteOpen = !s.deleteOpen;
      return { deleteOpen, layersOpen: deleteOpen ? false : s.layersOpen, squadOpen: deleteOpen ? false : s.squadOpen, editOpen: deleteOpen ? false : s.editOpen, searchOpen: deleteOpen && narrow() ? false : s.searchOpen };
    }),
  setSquadOpen: (squadOpen) =>
    set((s) => ({ squadOpen, layersOpen: squadOpen ? false : s.layersOpen, deleteOpen: squadOpen ? false : s.deleteOpen, editOpen: squadOpen ? false : s.editOpen, searchOpen: squadOpen && narrow() ? false : s.searchOpen })),
  toggleSquad: () =>
    set((s) => {
      const squadOpen = !s.squadOpen;
      return { squadOpen, layersOpen: squadOpen ? false : s.layersOpen, deleteOpen: squadOpen ? false : s.deleteOpen, editOpen: squadOpen ? false : s.editOpen, searchOpen: squadOpen && narrow() ? false : s.searchOpen };
    }),
  // addMode/overrideMode — взаимоисключающие режимы клика по карте (постановка ↔ правка синканных).
  addMode: false,
  overrideMode: false,
  setAddMode: (addMode) => set((s) => ({ addMode, overrideMode: addMode ? false : s.overrideMode })),
  setOverrideMode: (overrideMode) => set((s) => ({ overrideMode, addMode: overrideMode ? false : s.addMode })),
  toggleAddMode: () =>
    set((s) => {
      const addMode = !s.addMode;
      return { addMode, overrideMode: addMode ? false : s.overrideMode };
    }),
  toggleOverrideMode: () =>
    set((s) => {
      const overrideMode = !s.overrideMode;
      return { overrideMode, addMode: overrideMode ? false : s.addMode };
    }),
  reloadOverlay: null,
  setReloadOverlay: (reloadOverlay) => set({ reloadOverlay }),
}));