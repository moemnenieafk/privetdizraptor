'use client';

// Карточка редакторского маркера. ДВА режима:
//  • ПОКАЗ (Figma «Marker - On Click», node 2374-2492) — для всех: медиа/строка категории/
//    заголовок/описание/чип-связи; для admin/editor ряд «⇄ Переместить / ✎ Редактировать».
//  • ПРАВКА = 4-шаговый ВИЗАРД (Figma «UI - Step Marker Creation control», node 2374-2468):
//    01 категория → 02 объект → 03 название/описание → 04 связь. Навигация Далее/Назад,
//    амбер прогресс-бар. Шаг «объект» пропускается у типов без под-категории (poi и пр.).
// Данные — editorial_markers. Решения: docs/decisions/UI - Step Marker Creation control.md,
// docs/decisions/editorial-markers-tool.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, X, Paperclip, ChevronLeft, ChevronRight, ZoomIn, Bookmark, Move3d, MapPinPen,
  ArrowLeft, ArrowRight, Save, Trash2, EyeOff, Search,
} from 'lucide-react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { SPAWN_CATEGORIES, CONTAINER_CATEGORIES, categoryLabel } from '@/data/map-markers/categories';
import { markerIconUrl, markerColor, BOSS_ROSTER, isItemId, LINK_KIND_COLOR, type MarkerIconInput } from '@/data/map-marker-icons';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { EFT_SEASONS } from '@/data/eft-seasons';
import { searchEftItemsAction } from '@/actions/search-actions';
import type { SearchItemResult } from '@/types/search';
import { MediaPicker } from '@/components/features/media/MediaPicker';
import { useQuestStore } from '@/store/useQuestStore';
import { useMapUiStore } from '@/store/useMapUiStore';
import { QuestRow } from './QuestRow';
import type { EditorialLinkKind } from '@/db/schema-editorial';

// Типы маркера (как в редакторе Ледокола) + POI без категории. Иконка резолвится markerIconUrl.
const MARKER_TYPES: { key: string; label: string }[] = [
  { key: 'poi', label: 'POI' },
  { key: 'extract', label: 'Выход' },
  { key: 'spawn', label: 'Спавн' },
  { key: 'loot', label: 'Лут' },
  { key: 'container', label: 'Контейнер' },
  { key: 'transit', label: 'Переход' },
  { key: 'hazard', label: 'Опасн.' },
  { key: 'lock', label: 'Замок' },
  { key: 'switch', label: 'Рычаг' },
  { key: 'stationary', label: 'Стац.' },
  { key: 'quest_zone', label: 'Зона задания' },
];
// Подтипы выхода (шаг 2 для «Выход») — полный набор 1:1 с Figma 09-1. «Переход» ставит type='transit'
// (свой резолвер transition-point), остальные — type='extract' + category=подвид (резолвер читает category).
const EXTRACT_SUBTYPES: { key: string; label: string; type: string; category: string | null }[] = [
  { key: 'shared', label: 'Общий', type: 'extract', category: 'shared' },
  { key: 'pmc', label: 'ЧВК', type: 'extract', category: 'pmc' },
  { key: 'scav', label: 'Дикий', type: 'extract', category: 'scav' },
  { key: 'greenflare', label: 'Сигнал', type: 'extract', category: 'greenflare' },
  { key: 'codeword', label: 'Кодовое слово', type: 'extract', category: 'codeword' },
  { key: 'paidcar', label: 'Платный', type: 'extract', category: 'paidcar' },
  { key: 'paidhely', label: 'Вертолёт', type: 'extract', category: 'paidhely' },
  { key: 'nobackpack', label: 'Без рюкзака', type: 'extract', category: 'nobackpack' },
  { key: 'transit', label: 'Переход', type: 'transit', category: null },
];
// Под-типы опасностей (meta.hazardType) — порядок и состав 1:1 с Figma «08 Step 02 Danger» (10).
const HAZARD_SUBTYPES: { key: string; label: string }[] = [
  { key: 'other', label: 'Общая' },
  { key: 'sniper', label: 'Снайпер' },
  { key: 'mine', label: 'Мины' },
  { key: 'mortar', label: 'Миномёт' },
  { key: 'mon50', label: 'МОН-50' },
  { key: 'tripwire', label: 'Растяжки' },
  { key: 'flamable', label: 'Огонь' },
  { key: 'biohazard', label: 'Токсин' },
  { key: 'electro', label: 'Электро' },
  { key: 'radioactive', label: 'Радиация' },
];
const QUESTZONE_KINDS: { key: string; label: string }[] = [
  { key: 'target', label: 'Цель' },
  { key: 'item', label: 'Предмет' },
];

// События для привязки маркера (linkKind='event'). Источник — сезоны портала (Season 1 = Kord Breach):
// добавится сезон в EFT_SEASONS — опция появится сама, без правки карточки. linkId = `season-<slug>`.
const MARKER_EVENTS: { id: string; label: string }[] = EFT_SEASONS.map((s) => ({
  id: `season-${s.slug}`,
  label: `Сезон ${s.number} - ${s.name.toUpperCase()}`,
}));
// linkId события → человекочитаемая метка (для чипа в показе). Неизвестный id — сам id (легаси-свобода).
const markerEventLabel = (id: string | null | undefined): string | null =>
  id ? (MARKER_EVENTS.find((e) => e.id === id)?.label ?? id) : null;

// ─── Визард ─────────────────────────────────────────────────────────────────
type WizardStep = 'category' | 'object' | 'details' | 'link';
const SVGM = '/icons/eft/01-maps/markers';
// Категории шага 1 (9, порядок и иконки 1:1 с Figma «01 Step 01»). Ключ категории → тип маркера.
// Враг/Спавн оба type='spawn' (различаются лишь визуально, под-данные — позже); Интерактив
// объединяет lock/switch/stationary (реальный тип в шаге 2); Переход — подтип «Выхода» (шаг 2).
// ВСЕ иконки — цветной img: у marker-svg свой градиент+обводка (mask бы их убила; Метка=default-marker,
// у point-of-interest градиента нет).
type WizardCatKey = 'poi' | 'enemy' | 'quest' | 'loot' | 'container' | 'interactive' | 'hazard' | 'extract' | 'spawn';
interface WizardCategory {
  key: WizardCatKey;
  label: string;
  type: string;
  src: string;
}
const WIZARD_CATEGORIES: WizardCategory[] = [
  { key: 'poi', label: 'Метка', type: 'poi', src: `${SVGM}/default-marker.svg` },
  { key: 'enemy', label: 'Враг', type: 'spawn', src: `${SVGM}/spawn/spawn-boss-add.svg` },
  { key: 'quest', label: 'Квест', type: 'quest_zone', src: `${SVGM}/quest/quest-maker.svg` },
  { key: 'loot', label: 'Лут', type: 'loot', src: `${SVGM}/loot/loot-random-luck.svg` },
  { key: 'container', label: 'Контейнер', type: 'container', src: `${SVGM}/loot/loot-containers-marker.svg` },
  { key: 'interactive', label: 'Интерактив', type: 'lock', src: `${SVGM}/interactive/interact.svg` },
  { key: 'hazard', label: 'Опасность', type: 'hazard', src: `${SVGM}/danger/danger.svg` },
  { key: 'extract', label: 'Выход', type: 'extract', src: `${SVGM}/exfil/exfil-point-pmc.svg` },
  { key: 'spawn', label: 'Спавн', type: 'spawn', src: `${SVGM}/spawn/spawn.svg` },
];
// Категориям с зоной доступна ОБЛАСТЬ (полигон-лассо). Остальные (Враг/Лут/Контейнер/Интерактив) —
// строго точечные, кнопки «Область» у них нет.
const AREA_CATEGORIES = new Set<WizardCatKey>(['poi', 'quest', 'hazard', 'extract', 'spawn']);
// Под-типы «Интерактива» (шаг 2) — выставляют реальный type маркера.
const INTERACTIVE_KINDS: { key: string; label: string }[] = [
  { key: 'lock', label: 'Замок' },
  { key: 'switch', label: 'Рычаг' },
  { key: 'stationary', label: 'Стационарка' },
];
// Спавн игрока/техники (шаг 2 для «Спавн») — 3 плитки 1:1 с Figma 10-1 (ЧВК/Дикий/БТР-80).
// Отличается от «Врага» (боты/боссы) наличием БТР-80; пересечение по ЧВК/Дикий — норм (одна точка).
const PLAYER_SPAWN: { key: string; label: string }[] = [
  { key: 'pmc', label: 'ЧВК' },
  { key: 'scav', label: 'Дикий' },
  { key: 'btr80', label: 'БТР-80' },
];
// Подвиды «Метки» (шаг 2) — 3 плитки 1:1 с Figma 02: Простое/Интерес/Совет (иконка по category).
const POI_KINDS: { key: string; label: string }[] = [
  { key: 'simple', label: 'Простое' },
  { key: 'interest', label: 'Интерес' },
  { key: 'advice', label: 'Совет' },
];
// «Враг» (шаг 2) — ОДИН плоский список: generic-враги (без ЧВК и без дубль-обобщений Босс/Goons/
// Сектанты — их заменяют именные боссы) + полный ростер боссов-портретов.
const ENEMY_OPTIONS: { key: string; label: string }[] = [
  ...SPAWN_CATEGORIES.filter((c) => !['pmc', 'boss', 'goons', 'cultist'].includes(c.key)),
  ...BOSS_ROSTER,
];
// Тип+категория editorial-маркера → ключ категории визарда (для входа в правку существующего).
function deriveCatKey(type: string, category?: string | null): WizardCatKey {
  if (type === 'lock' || type === 'switch' || type === 'stationary') return 'interactive';
  if (type === 'quest_zone') return 'quest';
  if (type === 'extract' || type === 'transit') return 'extract'; // Переход — подтип «Выхода»
  if (type === 'loot') return 'loot';
  if (type === 'container') return 'container';
  if (type === 'hazard') return 'hazard';
  // БТР-80 однозначно «Спавн»; прочий spawn (ЧВК/Дикий/боссы) по умолчанию → Враг.
  if (type === 'spawn') return category === 'btr80' ? 'spawn' : 'enemy';
  return 'poi';
}
// Короткая подпись типа для fallback подписи категории (markerCategoryLabel).
const WIZARD_TYPE_LABEL: Record<string, string> = {
  poi: 'Метка',
  extract: 'Выход',
  spawn: 'Спавн',
  loot: 'Лут',
  container: 'Контейнер',
  transit: 'Переход',
  hazard: 'Опасность',
  lock: 'Замок',
  switch: 'Рычаг',
  stationary: 'Стац.',
  quest_zone: 'Квест',
};

/** Минимум для резолва подписи/иконки категории (подходит и маркеру, и черновику). */
type CatShape = { type: string; category?: string | null; faction?: string | null; title?: string | null };

/** Данные карточки (клиентская форма editorial-маркера + разрешённые URL скринов). */
export interface EditorialMarkerView {
  id?: string;
  mapId: string;
  x: number;
  z: number;
  y?: number | null;
  floor?: number | null;
  type: string;
  category?: string | null;
  faction?: string | null;
  title: string;
  description?: string | null;
  /** Готовые URL скриншотов (родитель резолвит media-ключи → URL). */
  screenshots: string[];
  linkKind: EditorialLinkKind;
  linkId?: string | null;
  linkStep?: number | null;
  /** Полигон-область (лассо): игровые точки {x,z}; null/пусто — обычная точка-маркер. */
  polygon?: { x: number; z: number }[] | null;
  /** Оверрайд синканного маркера tarkov.dev (его id); null — самостоятельный editorial-маркер. */
  sourceMarkerId?: string | null;
  /** Оверрайд «скрыть» — подавляет синканный маркер (сам не рендерится). */
  hidden?: boolean;
  /** Лут-пул: id предметов, которые могут заспавниться на споте (>1 = пул). category = первый. */
  lootItems?: string[] | null;
  /** Лут-пул: id→короткое имя (BSG shortName) для показа в карточке/заголовке. Резолвится серверно. */
  lootItemLabels?: Record<string, string> | null;
  /** Лут-пул: id→backgroundColor (редкость) для ячейки-иконки предмета. Резолвится серверно из priceIndex. */
  lootItemBg?: Record<string, string> | null;
}

/** Разрешённая привязка к квесту — для верхнего ряда (трейдер/уровень/каппа). */
export interface LinkedQuestInfo {
  name: string;
  traderNn: string;
  minPlayerLevel?: number | null;
  kappaRequired?: boolean;
  lightkeeperRequired?: boolean;
}

/** Маркер + разрешённая привязка — сериализуемая форма для пропсов карты. */
export interface EditorialMarkerData extends EditorialMarkerView {
  linkedQuest?: LinkedQuestInfo | null;
  /** Название привязанной сюжетной истории (linkKind='story') — резолвится на сервере всем. */
  linkedStory?: { title: string } | null;
  /** Связанный предмет (linkKind='item', напр. пропуск выхода) — резолвится на сервере. */
  linkedItem?: { id: string; name: string; slug: string | null; bg: string | null } | null;
}

/** Лёгкий элемент индекса квестов для автокомплита привязки (только редакторам). */
export interface QuestIndexItem {
  id: string;
  name: string;
  trader: string;
}

/** Лёгкий элемент индекса сюжетных историй (slug+title) для привязки (только редакторам). */
export interface StoryIndexItem {
  slug: string;
  title: string;
}

/** Локальный черновик правок карточки (сохранение в API — на шаге «Сохранить»). */
interface Draft {
  title: string;
  description: string;
  screenshots: string[];
  type: string;
  category: string | null;
  faction: string | null;
  linkKind: EditorialLinkKind;
  linkId: string | null;
  linkStep: number | null;
  polygon: { x: number; z: number }[] | null;
  /** Лут-пул: id предметов спота (>1 = несколько возможных). category = lootItems[0]. */
  lootItems: string[];
}
function makeDraft(m: EditorialMarkerView): Draft {
  // Пул лута: из lootItems, иначе из одиночного category (обратная совместимость со старыми метками).
  const lootItems =
    m.lootItems && m.lootItems.length > 0 ? [...m.lootItems] : isItemId(m.category) ? [m.category as string] : [];
  return {
    title: m.title,
    description: m.description ?? '',
    screenshots: [...m.screenshots],
    type: m.type,
    category: m.category ?? null,
    faction: m.faction ?? null,
    linkKind: m.linkKind,
    linkId: m.linkId ?? null,
    linkStep: m.linkStep ?? null,
    polygon: m.polygon ?? null,
    lootItems,
  };
}

// Подпись категории маркера для строки показа/объекта (перекрывает локальные наборы + categoryLabel).
function markerCategoryLabel(m: CatShape, lootName?: (id: string) => string): string {
  if (m.type === 'poi') return POI_KINDS.find((k) => k.key === (m.category ?? 'simple'))?.label ?? 'Метка';
  if (m.type === 'transit') return 'Переход';
  if (m.type === 'extract') {
    return EXTRACT_SUBTYPES.find((x) => x.type === 'extract' && x.category === m.category)?.label ?? 'Выход';
  }
  if (m.type === 'hazard' && m.category) return HAZARD_SUBTYPES.find((x) => x.key === m.category)?.label ?? 'Опасность';
  if (m.type === 'quest_zone') return m.category ? (QUESTZONE_KINDS.find((x) => x.key === m.category)?.label ?? 'Зона задания') : 'Зона задания';
  if (m.type === 'spawn' && m.category === 'btr80') return 'БТР-80';
  if (m.type === 'spawn' && m.category) {
    const boss = BOSS_ROSTER.find((b) => b.key === m.category);
    if (boss) return boss.label;
  }
  // Лут: category = itemId → показываем короткое имя предмета (BSG shortName), а не сырой id.
  if (m.type === 'loot' && m.category && isItemId(m.category)) return lootName?.(m.category) ?? 'Лут';
  if (m.category) return categoryLabel(m.category) ?? m.category;
  return WIZARD_TYPE_LABEL[m.type] ?? MARKER_TYPES.find((t) => t.key === m.type)?.label ?? 'Маркер';
}

// Вход резолвера иконки (meta под-типов hazard/quest_zone — как в MapViewerClient).
function glyphInputFor(m: CatShape): MarkerIconInput {
  const meta =
    m.type === 'hazard' && m.category
      ? { hazardType: m.category }
      : m.type === 'quest_zone' && m.category
        ? { objectiveKind: m.category }
        : undefined;
  return { type: m.type, category: m.category ?? undefined, faction: m.faction ?? undefined, label: m.title, meta };
}

interface Props {
  marker: EditorialMarkerView;
  /** Разрешённый связанный квест (linkKind='quest') — для ряда трейдер/уровень/каппа. */
  linkedQuest?: LinkedQuestInfo | null;
  /** Открыть деталь привязанного квеста (клик по строке QuestRow в показе). */
  onOpenQuest?: (questId: string) => void;
  /** Название привязанной истории (linkKind='story') — для чипа связи в показе. */
  linkedStory?: { title: string } | null;
  /** Связанный предмет (linkKind='item') — для чипа связи в показе. */
  linkedItem?: { id: string; name: string; slug: string | null; bg: string | null } | null;
  /** Юзер может править (admin/editor) — показывает ряд «Переместить/Редактировать» в показе. */
  canEdit?: boolean;
  /** Открыть сразу в режиме правки (новый маркер, только что поставленный). */
  defaultEditing?: boolean;
  /** Индекс квестов для автокомплита привязки (редакторам). */
  questIndex?: QuestIndexItem[];
  /** Индекс сюжетных историй для привязки (редакторам). */
  storyIndex?: StoryIndexItem[];
  /** slug карты — для ревалидации кэша страницы при сохранении. */
  mapSlug?: string;
  /** После успешного сохранения/удаления — родитель обновляет данные (router.refresh) и закрывает. */
  onMutated?: () => void;
  /** Отмена правки НОВОГО маркера (без id) — родитель закрывает карточку. */
  onCancel?: () => void;
  /** Bug 3: карточка «залочена» (визард на шаге 2+) → родитель не закрывает её по клику мимо. */
  onEditGuardChange?: (locked: boolean) => void;
  /** Запросить рисование области-лассо на карте: parent рисует, onDone возвращает точки (или null). */
  onDrawArea?: (req: { current: { x: number; z: number }[] | null; color: string; onDone: (poly: { x: number; z: number }[] | null) => void }) => void;
  /** Индекс лута карты (loose loot, без контейнеров) — для поиска предмета в Лут-шаге 2. */
  lootIndex?: { id: string; label: string }[];
  /** Показ, admin: «Переместить» — parent включает move-режим (курсор-пин → новая точка). */
  onMove?: () => void;
  /** Показ, admin (оверрайд синканного): «Скрыть» — parent прячет синканный маркер (hidden=true). */
  onHide?: () => void;
  /** Батч-режим: применить поля черновика КО ВСЕМ выбранным (перезапись). Заменяет одиночный save. */
  onBatchSave?: (draft: Draft) => Promise<void> | void;
  /** Число выбранных для батча — для лейбла кнопки «Применить (N)». */
  batchCount?: number;
  /** Батч-ПОСТАНОВКА (шаблон меток): визард настраивает общие поля, финал → «К постановке →». */
  batchCreate?: boolean;
}

export function EditorialMarkerCard({
  marker,
  linkedQuest,
  linkedStory,
  linkedItem,
  canEdit = false,
  defaultEditing = false,
  questIndex,
  storyIndex,
  mapSlug,
  onMutated,
  onCancel,
  onEditGuardChange,
  onDrawArea,
  lootIndex,
  onMove,
  onHide,
  onBatchSave,
  batchCount,
  batchCreate = false,
  onOpenQuest,
}: Props) {
  const [sel, setSel] = useState(0);
  // Якорь для боковой панели медиа-библиотеки (пикер встаёт справа от карточки).
  const cardRootRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(defaultEditing);
  // Локальный черновик правок. Сброс при смене маркера — через key={marker.id} на компоненте в родителе.
  const [draft, setDraft] = useState<Draft>(() => makeDraft(marker));
  const editField = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  // Выбранная категория визарда (шаг 1). Отдельно от draft.type: Враг/Спавн оба spawn.
  const [catKey, setCatKey] = useState<WizardCatKey>(() => deriveCatKey(marker.type, marker.category));
  const selectCat = (cat: WizardCategory) => {
    setCatKey(cat.key);
    setDraft((d) => ({
      ...d,
      type: cat.type,
      category: cat.type === d.type ? d.category : null,
      faction: null,
      polygon: AREA_CATEGORIES.has(cat.key) ? d.polygon : null, // точечная категория не хранит область
    }));
  };

  // ── Шаги визарда (4): категория → объект → название → связь. У всех категорий есть шаг «объект». ──
  const [stepIdx, setStepIdx] = useState(0);
  const steps = useMemo<WizardStep[]>(() => ['category', 'object', 'details', 'link'], []);
  const si = Math.min(stepIdx, steps.length - 1);
  const curStep = steps[si];
  const isLast = si === steps.length - 1;
  const titleOk = draft.title.trim().length > 0;

  const enterEdit = () => {
    setStepIdx(0);
    setEditing(true);
  };
  // Возврат к показу существующего маркера: откат черновика к сохранённым данным. Новый — закрыть.
  const backToDisplay = () => {
    if (marker.id || marker.sourceMarkerId) {
      setDraft(makeDraft(marker));
      setCatKey(deriveCatKey(marker.type, marker.category));
      setSel(0);
      setStepIdx(0);
      setEditing(false);
    } else {
      onCancel?.();
    }
  };
  const goBack = () => {
    if (si === 0) backToDisplay();
    else setStepIdx(si - 1);
  };
  const goNext = () => {
    if (isLast) void save();
    else setStepIdx(si + 1);
  };
  // Bug 3: осознанный выход из визарда (× / Esc). При набранных изменениях — подтверждение,
  // иначе молча. backToDisplay откатывает существующий маркер к показу, новый — закрывает (onCancel).
  const requestClose = () => {
    const dirty = JSON.stringify(draft) !== JSON.stringify(makeDraft(marker));
    if (dirty && !window.confirm('Закрыть редактор? Введённые данные будут потеряны.')) return;
    backToDisplay();
  };
  // Bug 3: пока визард на шаге 2+ — сообщаем родителю «залочено», чтобы клик мимо не закрыл карточку
  // и не стёр черновик. Шаг 1 (выбор категории) не лочим — терять ещё нечего.
  useEffect(() => {
    onEditGuardChange?.(editing && si >= 1);
  }, [editing, si, onEditGuardChange]);
  useEffect(() => () => onEditGuardChange?.(false), [onEditGuardChange]);

  const [picking, setPicking] = useState(false);
  // Автокомплит привязки к квесту (редакторам).
  const [linkQ, setLinkQ] = useState('');
  const linkHits =
    linkQ.trim().length >= 2 && questIndex
      ? questIndex.filter((q) => q.name.toLowerCase().includes(linkQ.trim().toLowerCase())).slice(0, 8)
      : [];
  const selName =
    draft.linkKind === 'quest' && draft.linkId
      ? (questIndex?.find((q) => q.id === draft.linkId)?.name ?? linkedQuest?.name ?? draft.linkId)
      : null;
  // Связь-предмет (linkKind='item'): async-поиск по каталогу (5044 предмета не тащим в клиент).
  const [itemQ, setItemQ] = useState('');
  const [itemHits, setItemHits] = useState<SearchItemResult[]>([]);
  const [itemLoading, setItemLoading] = useState(false); // async-поиск предмета-пропуска идёт
  const [pickedItem, setPickedItem] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (draft.linkKind !== 'item') return;
    const q = itemQ.trim();
    let alive = true;
    if (q.length < 2) {
      setItemLoading(false);
      setItemHits([]);
      return;
    }
    setItemLoading(true);
    const t = setTimeout(async () => {
      const res = await searchEftItemsAction(q);
      if (alive) {
        setItemHits(res);
        setItemLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [itemQ, draft.linkKind]);
  const selItemName =
    draft.linkKind === 'item' && draft.linkId
      ? (pickedItem?.id === draft.linkId ? pickedItem.name : (linkedItem?.name ?? draft.linkId))
      : null;
  // Поиск предмета для ЛУТА (шаг 2) — по ПОЛНОМУ каталогу (5044) через серверный action, как связь-предмет.
  // Раньше искал только по синканному луту карты (`lootIndex`) — на editorial-картах (factory-hd) его нет,
  // и выбрать было нечего. Теперь куратор привязывает любой предмет игры.
  const [lootQ, setLootQ] = useState('');
  const [lootHits, setLootHits] = useState<SearchItemResult[]>([]);
  const [lootLoading, setLootLoading] = useState(false); // async-поиск идёт (§4.8: скелетон + лупа в поле)
  const [lootNames, setLootNames] = useState<Record<string, string>>({}); // id→имя для чипов пула (из поиска)
  useEffect(() => {
    if (catKey !== 'loot') return;
    const q = lootQ.trim();
    let alive = true;
    if (q.length < 2) {
      setLootLoading(false);
      setLootHits([]);
      return;
    }
    setLootLoading(true);
    const t = setTimeout(async () => {
      const res = await searchEftItemsAction(q);
      if (alive) {
        setLootHits(res);
        setLootLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [lootQ, catKey]);
  // Имя предмета в чипе: из поиска (lootNames), иначе из синканного индекса карты, иначе плейсхолдер.
  const lootLabel = (id: string): string =>
    lootNames[id] ?? marker.lootItemLabels?.[id] ?? lootIndex?.find((i) => i.id === id)?.label ?? 'Предмет';
  // Лут-ПУЛ: несколько предметов на спот. category = первый (иконка/back-compat). Заголовок префилл первым.
  const addLootItem = (id: string, name: string) => {
    setLootNames((n) => ({ ...n, [id]: name }));
    setDraft((d) => {
      const items = d.lootItems.includes(id) ? d.lootItems : [...d.lootItems, id];
      return { ...d, lootItems: items, category: items[0] ?? null, title: d.title.trim() || name };
    });
    setLootQ('');
    setLootHits([]);
  };
  const removeLootItem = (id: string) => {
    setDraft((d) => {
      const items = d.lootItems.filter((x) => x !== id);
      return { ...d, lootItems: items, category: items[0] ?? null };
    });
  };

  // Bug 4: при входе на шаг «название», если поле пустое — автоподставляем ЛУЧШУЮ метку объекта
  // (лут → имя предмета, босс → имя, подтип выхода → его метка, иначе — метка категории). Гейт
  // titleOk остаётся, но блокирует только если юзер САМ стёр название в пустоту. Не перетираем
  // ни введённое юзером, ни автоимя лута (addLootItem уже заполнил). Триггер — смена шага.
  useEffect(() => {
    if (curStep !== 'details' || draft.title.trim() !== '') return;
    const best = markerCategoryLabel(draft, lootLabel);
    if (best) editField({ title: best });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curStep]);

  // Сохранение/удаление через API (запись защищена canEditContent на сервере).
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      // Батч-режим: не пишем один маркер, а отдаём черновик родителю — он применит поля ко всем выбранным.
      if (onBatchSave) {
        await onBatchSave(draft);
        return;
      }
      const res = await fetch('/api/admin/editorial-markers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: marker.id,
          mapId: marker.mapId,
          slug: mapSlug,
          x: marker.x,
          z: marker.z,
          y: marker.y,
          floor: marker.floor,
          type: draft.type,
          category: draft.category,
          faction: draft.faction,
          title: draft.title,
          description: draft.description,
          screenshots: draft.screenshots,
          linkKind: draft.linkKind,
          linkId: draft.linkId,
          linkStep: draft.linkStep,
          polygon: draft.polygon,
          sourceMarkerId: marker.sourceMarkerId,
          hidden: marker.hidden,
          lootItems: draft.lootItems,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      setEditing(false);
      onMutated?.();
    } catch (e) {
      console.error('[editorial-marker save]', e);
      alert('Не удалось сохранить маркер');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!marker.id || !confirm('Удалить маркер?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/editorial-markers?id=${marker.id}&slug=${mapSlug ?? ''}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onMutated?.();
    } catch (e) {
      console.error('[editorial-marker delete]', e);
      alert('Не удалось удалить маркер');
    } finally {
      setBusy(false);
    }
  };

  // Лайтбокс: индекс открытого на весь экран скрина (null — закрыт). Пролистывание + Esc/стрелки.
  const shots = draft.screenshots;
  const [lightbox, setLightbox] = useState<number | null>(null);
  const stepLightbox = (dir: 1 | -1) =>
    setLightbox((i) => (i === null || shots.length === 0 ? i : (i + dir + shots.length) % shots.length));
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') stepLightbox(1);
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, shots.length]);
  // Bug 3: Esc в визарде = осознанный выход (requestClose). Открытый лайтбокс важнее — его Esc
  // закрывает лайтбокс (эффект выше), сюда не доходит.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightbox === null) {
        e.stopPropagation();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, lightbox, draft, marker]);
  const completed = useQuestStore((s) => s.completedQuests);
  const pinned = useQuestStore((s) => s.pinnedQuests);
  const toggleQuest = useQuestStore((s) => s.toggleQuest);
  const togglePin = useQuestStore((s) => s.togglePin);
  // Пометка на удаление (батч-подтверждение в drawer «Удаление маркеров»).
  // Ключ: editorial → его id (батч-DELETE); синканый tarkov.dev → `src:<sourceMarkerId>`
  // (батч-hide-override, т.к. DELETE такому маркеру бессмыслен — вернётся при синке).
  const deleteMarks = useMapUiStore((s) => s.deleteMarks);
  const deleteOpen = useMapUiStore((s) => s.deleteOpen);
  const toggleDeleteMark = useMapUiStore((s) => s.toggleDeleteMark);
  const deleteKey = marker.id ?? (marker.sourceMarkerId ? `src:${marker.sourceMarkerId}` : null);
  const isMarkedForDelete = !!deleteKey && deleteMarks.includes(deleteKey);

  const questId = marker.linkKind === 'quest' ? marker.linkId ?? null : null;
  const isDone = questId ? completed.includes(questId) : false;
  const isPinned = questId ? pinned.includes(questId) : false;

  // Тинт карточки = цвет трейдера связанного квеста (иначе нейтральный).
  const tintVar = linkedQuest ? `var(${traderCssVar(linkedQuest.traderNn)}, var(--color-lines-hover))` : 'var(--color-lines-hover)';
  const hero = shots[sel] ?? shots[0];

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div
        ref={cardRootRef}
        className="scrollbar-hidden flex max-h-[82vh] w-full flex-col items-center gap-2.5 overflow-y-auto rounded border-[0.5px] p-3.5"
        style={{
          borderColor: `color-mix(in srgb, ${tintVar} 60%, transparent)`,
          background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${tintVar} 18%, var(--color-base)), var(--color-base))`,
        }}
      >
        {/* ── Галерея: миниатюры 49×28 + большой скрин (общая для показа и визарда) ──
            В ПОКАЗЕ без скринов блок скрыт целиком (только иконка/текст ниже); в ПРАВКЕ виден всегда
            (кнопка «+» для добавления). */}
        {(editing || shots.length > 0) && (
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center gap-1 overflow-hidden">
            {shots.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSel(i)}
                className={`relative h-7 w-[49px] shrink-0 overflow-hidden rounded-xs border transition-colors ${
                  i === sel ? 'border-(--color-tactical-amber)' : 'border-[0.5px] border-lines-hover'
                }`}
              >
                <img src={src} alt="" className="size-full object-cover" />
                {editing && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraft((d) => ({ ...d, screenshots: d.screenshots.filter((_, j) => j !== i) }));
                      setSel(0);
                    }}
                    className="absolute right-0 top-0 flex size-3.5 items-center justify-center bg-black/60 text-text-secondary hover:text-danger"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            ))}
            {editing && (
              <button
                type="button"
                onClick={() => setPicking(true)}
                title="Добавить скриншот"
                className="flex h-7 w-[49px] shrink-0 items-center justify-center rounded-xs border-[0.5px] border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="relative aspect-[348/196] w-full overflow-hidden rounded bg-card-menu">
            {hero ? (
              <button
                type="button"
                onClick={() => setLightbox(sel)}
                title="Открыть на весь экран"
                className="group block size-full cursor-zoom-in"
              >
                <img src={hero} alt="" className="size-full object-cover" />
                <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-xs bg-black/50 text-text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn className="h-3.5 w-3.5" />
                </span>
              </button>
            ) : (
              <div className="flex size-full items-center justify-center font-blender-book text-xs text-text-muted">
                Нет изображения. Добавьте скрин через «+».
              </div>
            )}
          </div>
        </div>
        )}

        {editing ? (
          /* ═════════════════ ВИЗАРД (правка) ═════════════════ */
          <>
            {/* Шаг + заголовок + амбер прогресс-бар */}
            <div className="flex w-full items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-blender-medium text-type-micro tabular-nums text-tactical-amber">{String(si + 1).padStart(2, '0')}</span>
                <span className="min-w-0 truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary">
                  {si === 0 ? 'Категория маркера' : (WIZARD_CATEGORIES.find((c) => c.key === catKey)?.label ?? 'Маркер')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <StepProgress total={steps.length} current={si + 1} />
                {/* Bug 3: осознанный выход из визарда (клик мимо больше не закрывает на шаге 2+). */}
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={busy}
                  title="Закрыть редактор"
                  className="flex size-5 shrink-0 items-center justify-center rounded-xs text-text-muted transition-colors hover:text-danger disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>

            {/* Индикатор выбранного объекта (шаги 2-4) */}
            {si >= 1 && (
              <div className="flex w-full items-center gap-2">
                <GlyphFor shape={draft} size={24} />
                <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">{markerCategoryLabel(draft, lootLabel)}</span>
              </div>
            )}

            {/* ── Шаг 1: сетка категорий (9, 3 колонки, иконки/порядок 1:1 с Figma) ── */}
            {curStep === 'category' && (
              <div className="grid w-full grid-cols-3 gap-1.5">
                {WIZARD_CATEGORIES.map((c) => {
                  const on = catKey === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => selectCat(c)}
                      className={`flex h-11 items-center justify-center gap-1.5 rounded-xs border-[0.5px] px-1 transition-colors ${
                        on ? 'border-(--primary) bg-(--primary)/10' : 'border-lines-hover bg-card-menu hover:border-(--primary)/50'
                      }`}
                    >
                      <CatIcon cat={c} size={18} />
                      <span className={`truncate font-blender-medium text-[0.625rem] uppercase tracking-tight ${on ? 'text-(--primary)' : 'text-text-secondary'}`}>
                        {c.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Шаг 2: выбор объекта (под-категория). Пикеры уточняются в Ф3. ── */}
            {curStep === 'object' && (
              <div className="flex w-full flex-col gap-1.5">
                {catKey === 'poi' && (
                  <div className="flex flex-wrap gap-1">
                    {POI_KINDS.map((k) => (
                      <SubCell key={k.key} on={(draft.category ?? 'simple') === k.key} onClick={() => setDraft((d) => ({ ...d, category: k.key }))} label={k.label}>
                        <MarkerGlyph input={{ type: 'poi', category: k.key }} size={24} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {catKey === 'extract' && (
                  <div className="flex flex-wrap gap-1">
                    {EXTRACT_SUBTYPES.map((s) => {
                      const on = s.type === 'transit' ? draft.type === 'transit' : draft.type === 'extract' && draft.category === s.category;
                      return (
                        <SubCell key={s.key} on={on} onClick={() => setDraft((d) => ({ ...d, type: s.type, category: s.category }))} label={s.label}>
                          <MarkerGlyph input={s.type === 'transit' ? { type: 'transit' } : { type: 'extract', category: s.category }} size={24} />
                        </SubCell>
                      );
                    })}
                  </div>
                )}
                {draft.type === 'spawn' && catKey === 'enemy' && (
                  <div className="scrollbar-hidden flex max-h-56 w-full flex-wrap gap-1 overflow-y-auto">
                    {ENEMY_OPTIONS.map((c) => (
                      <SubCell key={c.key} on={draft.category === c.key} onClick={() => setDraft((d) => ({ ...d, category: c.key }))} label={c.label}>
                        <MarkerGlyph input={{ type: 'spawn', category: c.key }} size={24} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {draft.type === 'spawn' && catKey === 'spawn' && (
                  <div className="flex flex-wrap gap-1">
                    {PLAYER_SPAWN.map((c) => (
                      <SubCell key={c.key} on={draft.category === c.key} onClick={() => setDraft((d) => ({ ...d, category: c.key }))} label={c.label}>
                        <MarkerGlyph input={{ type: 'spawn', category: c.key }} size={c.key === 'btr80' ? 26 : 22} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {/* Лут → ПОИСК ПРЕДМЕТА (полный каталог 5044 через searchEftItemsAction; курируем сами) */}
                {catKey === 'loot' && (
                  <div className="flex w-full flex-col gap-1.5">
                    <div className="flex h-9 items-center gap-2 rounded-xs border border-lines-hover bg-(--color-base) px-2.5">
                      <span className="icon-mask icon-eft-items-loot-tier h-4 w-4 shrink-0 text-text-muted" />
                      <input
                        value={lootQ}
                        onChange={(e) => setLootQ(e.target.value)}
                        placeholder="Поиск предмета…"
                        className="w-full bg-transparent font-blender-book text-xs text-text-primary outline-none placeholder:text-text-muted"
                      />
                      {lootLoading && (
                        <Search className="h-3.5 w-3.5 shrink-0 animate-pulse text-(--primary)" aria-label="Идёт поиск" />
                      )}
                      {lootQ && !lootLoading && (
                        <button type="button" onClick={() => setLootQ('')} aria-label="Очистить" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Выбранный ПУЛ предметов спота (чипы: иконка + имя + убрать). >1 = несколько возможных. */}
                    {draft.lootItems.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {draft.lootItems.map((id) => (
                          <span key={id} title={lootLabel(id)} className="flex items-center gap-1 rounded-xs border border-lines-hover bg-card-menu py-1 pr-1 pl-1.5">
                            <img src={itemIconUrl(id)} alt="" className="size-5 shrink-0 rounded-xs object-contain" />
                            <span className="max-w-28 truncate font-blender-book text-[0.6875rem] text-text-primary">{lootLabel(id)}</span>
                            <button type="button" onClick={() => removeLootItem(id)} title="Убрать предмет из пула" className="shrink-0 text-text-muted transition-colors hover:text-danger">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Результаты поиска → ДОБАВИТЬ в пул (уже выбранные скрыты). Можно добавить несколько. */}
                    {lootLoading ? (
                      <div className="rounded-xs border border-lines-hover">
                        <ItemSearchSkeleton rows={3} icon={28} />
                      </div>
                    ) : lootHits.filter((it) => !draft.lootItems.includes(it.id)).length > 0 ? (
                      <div className="scrollbar-hidden flex max-h-40 flex-col overflow-y-auto rounded-xs border border-lines-hover">
                        {lootHits
                          .filter((it) => !draft.lootItems.includes(it.id))
                          .map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => addLootItem(it.id, it.name)}
                              className="flex items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-card-menu"
                            >
                              <img src={itemIconUrl(it.id)} alt="" className="size-7 shrink-0 rounded-xs object-contain" />
                              <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">{it.name}</span>
                              <Plus className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="px-1 py-1.5 font-blender-book text-[0.625rem] text-text-muted">
                        {lootQ.trim().length >= 2
                          ? 'Ничего не найдено'
                          : draft.lootItems.length
                            ? 'Добавьте ещё предметы в пул или идите дальше'
                            : 'Найдите и добавьте предметы (можно несколько — пул спота)'}
                      </p>
                    )}
                  </div>
                )}
                {/* Контейнер → группы контейнеров (без лута) */}
                {catKey === 'container' && (
                  <div className="scrollbar-hidden flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                    {CONTAINER_CATEGORIES.map((g) => (
                      <div key={g.group} className="flex flex-col gap-1">
                        <span className="font-blender-medium text-[0.5625rem] uppercase tracking-wide text-text-muted">{g.group}</span>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map((it) => (
                            <SubCell key={it.key} on={draft.category === it.key} onClick={() => setDraft((d) => ({ ...d, category: it.key }))} label={it.label}>
                              <MarkerGlyph input={{ type: 'container', category: it.key }} size={30} />
                            </SubCell>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {draft.type === 'hazard' && (
                  <div className="flex flex-wrap gap-1">
                    {HAZARD_SUBTYPES.map((c) => (
                      <SubCell key={c.key} on={draft.category === c.key} onClick={() => setDraft((d) => ({ ...d, category: c.key }))} label={c.label}>
                        <MarkerGlyph input={{ type: 'hazard', meta: { hazardType: c.key } }} size={22} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {draft.type === 'quest_zone' && (
                  <div className="flex flex-wrap gap-1">
                    {QUESTZONE_KINDS.map((c) => (
                      <SubCell key={c.key} on={draft.category === c.key} onClick={() => setDraft((d) => ({ ...d, category: c.key }))} label={c.label}>
                        <MarkerGlyph input={{ type: 'quest_zone', meta: { objectiveKind: c.key } }} size={24} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {catKey === 'interactive' && (
                  <div className="flex flex-wrap gap-1">
                    {INTERACTIVE_KINDS.map((k) => (
                      <SubCell key={k.key} on={draft.type === k.key} onClick={() => setDraft((d) => ({ ...d, type: k.key, category: null }))} label={k.label}>
                        <MarkerGlyph input={{ type: k.key }} size={22} />
                      </SubCell>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Шаг 3: название + описание (бордер-инпуты) ── */}
            {curStep === 'details' && (
              <div className="flex w-full flex-col gap-2">
                <input
                  value={draft.title}
                  onChange={(e) => editField({ title: e.target.value })}
                  placeholder="Введите название маркера"
                  className="h-10 w-full rounded-xs border border-lines-hover bg-(--color-base) px-3 font-blender-book text-sm text-text-primary outline-none transition-colors focus:border-(--primary)/60 placeholder:text-text-muted"
                />
                <textarea
                  value={draft.description}
                  onChange={(e) => editField({ description: e.target.value })}
                  placeholder="Придумайте описание: где искать, как дойти…"
                  rows={4}
                  className="w-full resize-none rounded-xs border border-lines-hover bg-(--color-base) px-3 py-2 font-blender-book text-xs text-text-secondary outline-none transition-colors focus:border-(--primary)/60 placeholder:text-text-muted"
                />
              </div>
            )}

            {/* ── Шаг 4: связь (Нет связи / Задание / Сюжет / Событие [Ф4]) ── */}
            {curStep === 'link' && (
              <div className="flex w-full flex-col gap-1.5">
                <div className="flex w-full gap-1">
                  <LinkKindButton on={draft.linkKind === 'none'} onClick={() => { setDraft((d) => ({ ...d, linkKind: 'none', linkId: null, linkStep: null })); setLinkQ(''); }} label="Нет связи" color="#8a8a95" />
                  <LinkKindButton on={draft.linkKind === 'quest'} onClick={() => { setDraft((d) => ({ ...d, linkKind: 'quest', linkId: null, linkStep: null })); setLinkQ(''); }} label="Задание" color={LINK_KIND_COLOR.quest} iconClass="icon-eft-quests-side" />
                  <LinkKindButton on={draft.linkKind === 'story'} onClick={() => { setDraft((d) => ({ ...d, linkKind: 'story', linkId: null, linkStep: null })); setLinkQ(''); }} label="Сюжет" color={LINK_KIND_COLOR.story} iconClass="icon-eft-quests-lore" />
                  <LinkKindButton on={draft.linkKind === 'event'} onClick={() => { setDraft((d) => ({ ...d, linkKind: 'event', linkId: null, linkStep: null })); setLinkQ(''); }} label="Событие" color={LINK_KIND_COLOR.event} iconClass="icon-eft-quests-events" />
                  <LinkKindButton on={draft.linkKind === 'item'} onClick={() => { setDraft((d) => ({ ...d, linkKind: 'item', linkId: null, linkStep: null })); setItemQ(''); setPickedItem(null); }} label="Предмет" color={LINK_KIND_COLOR.item} iconClass="icon-eft-items-loot-tier" />
                </div>

                {/* Событие — выбор из списка (сезоны портала: «Сезон 1 - KORD BREACH» и далее) */}
                {draft.linkKind === 'event' && (
                  <div className="flex flex-wrap gap-1">
                    {MARKER_EVENTS.map((ev) => {
                      const on = draft.linkId === ev.id;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, linkId: ev.id }))}
                          aria-pressed={on}
                          className="flex items-center gap-1.5 rounded-xs border-[0.5px] px-2.5 py-1.5 font-blender-medium text-[0.6875rem] uppercase tracking-wide transition-colors"
                          style={
                            on
                              ? { borderColor: LINK_KIND_COLOR.event, backgroundColor: `color-mix(in srgb, ${LINK_KIND_COLOR.event} 15%, transparent)`, color: LINK_KIND_COLOR.event }
                              : { borderColor: 'var(--color-lines-hover)', color: 'var(--color-text-secondary)' }
                          }
                        >
                          <span className="icon-mask icon-eft-quests-events size-3.5 shrink-0" />
                          <span className="truncate">{ev.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Квест — автокомплит */}
                {draft.linkKind === 'quest' && questIndex && (
                  selName ? (
                    <div className="flex items-center gap-2 rounded-xs border border-lines-hover px-2 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">{selName}</span>
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, linkId: null }))}
                        title="Сменить квест"
                        className="shrink-0 text-text-muted transition-colors hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        value={linkQ}
                        onChange={(e) => setLinkQ(e.target.value)}
                        placeholder="Найти квест по названию…"
                        className="h-8 w-full rounded-xs border border-lines-hover bg-(--color-base) px-2 font-blender-book text-xs text-text-primary outline-none placeholder:text-text-muted"
                      />
                      {linkHits.length > 0 && (
                        <div className="absolute top-9 right-0 left-0 z-20 max-h-48 overflow-y-auto rounded-xs border border-lines-hover bg-(--color-base) shadow-xl">
                          {linkHits.map((q) => (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => { setDraft((d) => ({ ...d, linkId: q.id })); setLinkQ(''); }}
                              className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-card-menu"
                            >
                              <img src={traderImg(q.trader)} alt="" className="size-4 shrink-0 rounded-[1px] object-cover" />
                              <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">{q.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Сюжет — выбор истории + необязательный шаг */}
                {draft.linkKind === 'story' && storyIndex && (
                  <div className="flex gap-1.5">
                    <select
                      value={draft.linkId ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, linkId: e.target.value || null }))}
                      className="h-8 min-w-0 flex-1 rounded-xs border border-lines-hover bg-(--color-base) px-2 font-blender-book text-xs text-text-primary outline-none"
                    >
                      <option value="">— выберите историю —</option>
                      {storyIndex.map((s) => (
                        <option key={s.slug} value={s.slug}>{s.title}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={draft.linkStep ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, linkStep: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="шаг"
                      title="Шаг сюжета (необязательно)"
                      className="h-8 w-14 shrink-0 rounded-xs border border-lines-hover bg-(--color-base) px-2 font-blender-book text-xs text-text-primary outline-none placeholder:text-text-muted"
                    />
                  </div>
                )}

                {/* Предмет — async-автокомплит по каталогу (пропуск выхода: записка/валюта/Red Rebel) */}
                {draft.linkKind === 'item' &&
                  (selItemName ? (
                    <div className="flex items-center gap-2 rounded-xs border border-lines-hover px-2 py-1.5">
                      <img src={itemIconUrl(draft.linkId!)} alt="" className="size-5 shrink-0 object-contain" />
                      <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">{selItemName}</span>
                      <button type="button" onClick={() => { setDraft((d) => ({ ...d, linkId: null })); setPickedItem(null); }} title="Сменить предмет" className="shrink-0 text-text-muted transition-colors hover:text-danger">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        value={itemQ}
                        onChange={(e) => setItemQ(e.target.value)}
                        placeholder="Найти предмет-пропуск…"
                        className="h-8 w-full rounded-xs border border-lines-hover bg-(--color-base) pr-7 pl-2 font-blender-book text-xs text-text-primary outline-none placeholder:text-text-muted"
                      />
                      {itemLoading && (
                        <Search className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 animate-pulse text-(--primary)" aria-label="Идёт поиск" />
                      )}
                      {itemLoading ? (
                        <div className="absolute top-9 right-0 left-0 z-20 rounded-xs border border-lines-hover bg-(--color-base) shadow-xl">
                          <ItemSearchSkeleton rows={3} icon={24} />
                        </div>
                      ) : itemHits.length > 0 && (
                        <div className="absolute top-9 right-0 left-0 z-20 max-h-48 overflow-y-auto rounded-xs border border-lines-hover bg-(--color-base) shadow-xl">
                          {itemHits.map((it) => (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => { setDraft((d) => ({ ...d, linkId: it.id })); setPickedItem({ id: it.id, name: it.name }); setItemQ(''); setItemHits([]); }}
                              className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-card-menu"
                            >
                              <span className="relative size-6 shrink-0 overflow-hidden rounded-xs border-[0.5px] border-lines-hover">
                                <span className="absolute inset-0 bg-(--color-darkbase)" />
                                <span className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(it.backgroundColor) }} />
                                <img src={itemIconUrl(it.id)} alt="" className="absolute inset-0 size-full object-contain p-0.5" />
                              </span>
                              <span className="min-w-0 flex-1 truncate font-blender-book text-xs text-text-primary">{it.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* ── Навигация: Назад · Далее/Сохранить ── */}
            <div className="flex w-full items-center gap-2.5">
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="flex h-9 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs border-[0.5px] border-lines-hover bg-card-menu font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary) disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Назад
              </button>
              {onDrawArea && AREA_CATEGORIES.has(catKey) && (
                <button
                  type="button"
                  onClick={() => onDrawArea({ current: draft.polygon, color: markerColor(draft.type), onDone: (poly) => editField({ polygon: poly }) })}
                  title={draft.polygon ? 'Перерисовать область (лассо)' : 'Обвести область (лассо)'}
                  className={`flex h-9 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs border-[0.5px] font-blender-medium text-type-micro uppercase tracking-widest transition-colors ${
                    draft.polygon ? 'border-(--primary) text-(--primary)' : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
                  }`}
                >
                  <span className="icon-mask icon-eft-make-region h-3.5 w-3.5 shrink-0" /> Область{draft.polygon ? ' ✓' : ''}
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={((curStep === 'details' || isLast) && !titleOk) || busy}
                title={(curStep === 'details' || isLast) && !titleOk ? 'Введите название' : undefined}
                className="flex h-9 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs bg-(--primary) font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isLast ? (
                  batchCreate ? (
                    <>К постановке <ArrowRight className="h-3.5 w-3.5" /></>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> {onBatchSave ? `Применить (${batchCount ?? 0})` : 'Сохранить'}</>
                  )
                ) : (
                  <>Далее <ArrowRight className="h-3.5 w-3.5" /></>
                )}
              </button>
            </div>
            {marker.id && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                title="Удалить маркер"
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-xs border-[0.5px] border-danger/50 font-blender-medium text-type-micro uppercase tracking-widest text-danger transition-colors hover:border-danger hover:bg-danger-dim disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Удалить маркер
              </button>
            )}
          </>
        ) : (
          /* ═════════════════ ПОКАЗ (Marker - On Click) ═════════════════ */
          <>
            {/* Строка категории: иконка + подпись слева · закладка связи справа.
                Лут-предмет → крупная ячейка 56×56 (фон редкости + тень), как настоящая иконка ячейки. */}
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {marker.type === 'loot' && isItemId(marker.category) ? (
                  <ItemCell id={marker.category as string} bg={marker.lootItemBg?.[marker.category as string]} size={56} />
                ) : (
                  <GlyphFor shape={marker} size={28} />
                )}
                <span className="min-w-0 truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary">
                  {markerCategoryLabel(marker, lootLabel)}
                </span>
              </div>
              {marker.linkKind !== 'none' && (
                <Bookmark className="h-4 w-4 shrink-0" style={{ color: LINK_KIND_COLOR[marker.linkKind] }} />
              )}
            </div>

            {/* Ряд привязки квеста: кликабельная строка QuestRow (как в «Поиске на локации») */}
            {linkedQuest && marker.linkId ? (
              <QuestRow
                q={{
                  id: marker.linkId,
                  name: linkedQuest.name,
                  trader: linkedQuest.traderNn,
                  minPlayerLevel: linkedQuest.minPlayerLevel ?? 0,
                  kappaRequired: !!linkedQuest.kappaRequired,
                  lightkeeperRequired: !!linkedQuest.lightkeeperRequired,
                }}
                onSelect={onOpenQuest ?? (() => {})}
              />
            ) : (
              marker.linkKind === 'quest' && (
                /* Фолбэк (R10): привязка к квесту есть, данных нет — мягкая заглушка. */
                <div className="flex h-9 w-full items-center rounded border-[0.5px] border-lines-hover px-3.5 font-blender-medium text-xs text-text-muted">
                  Задание недоступно
                </div>
              )
            )}

            {/* Заголовок */}
            <p className="w-full font-blender-medium text-base leading-none text-text-primary">{marker.title}</p>

            {/* Описание */}
            {marker.description && <p className="w-full font-blender-book text-xs leading-none text-text-secondary">{marker.description}</p>}

            {/* Лут-пул: список возможных предметов спота (иконки — визуально видно, что может выпасть). */}
            {marker.type === 'loot' && marker.lootItems && marker.lootItems.length > 1 && (
              <div className="flex w-full flex-col gap-1">
                <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                  Возможные предметы ({marker.lootItems.length})
                </span>
                <div className="flex flex-wrap gap-1">
                  {marker.lootItems.map((id) => (
                    <span key={id} title={lootLabel(id)} className="flex items-center gap-1 rounded-xs border-[0.5px] border-lines-hover bg-card-menu py-1 pr-1.5 pl-1">
                      <img src={itemIconUrl(id)} alt="" className="size-7 shrink-0 rounded-xs object-contain" />
                      <span className="max-w-24 truncate font-blender-book text-[0.6875rem] text-text-secondary">{lootLabel(id)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Чип связи (сюжет/событие): рамка + иконка-маска + имя + опц. шаг */}
            {(marker.linkKind === 'story' || marker.linkKind === 'event') && (
              <div
                className="flex w-full items-center gap-2 rounded-xs border-[0.5px] px-2.5 py-2"
                style={{
                  borderColor: `color-mix(in srgb, ${LINK_KIND_COLOR[marker.linkKind]} 45%, transparent)`,
                  background: `color-mix(in srgb, ${LINK_KIND_COLOR[marker.linkKind]} 10%, transparent)`,
                }}
              >
                <span
                  className={`icon-mask size-4 shrink-0 ${marker.linkKind === 'story' ? 'icon-eft-quests-lore' : 'icon-eft-quests-events'}`}
                  style={{ backgroundColor: LINK_KIND_COLOR[marker.linkKind] }}
                />
                <span className="min-w-0 flex-1 truncate font-blender-medium text-xs" style={{ color: LINK_KIND_COLOR[marker.linkKind] }}>
                  {marker.linkKind === 'story' ? (linkedStory?.title ?? marker.linkId) : (markerEventLabel(marker.linkId) ?? 'Событие')}
                </span>
                {marker.linkKind === 'story' && marker.linkStep != null && (
                  <span className="shrink-0 font-blender-medium text-[0.625rem] uppercase text-text-secondary">шаг {marker.linkStep}</span>
                )}
                {marker.linkKind === 'story' && marker.linkId && (
                  <a
                    href={`/eft/quests/${marker.linkId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Открыть гайд"
                    className="shrink-0"
                    style={{ color: LINK_KIND_COLOR.story }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Чип связи (предмет): ячейка-иконка + имя → страница предмета */}
            {marker.linkKind === 'item' && linkedItem && (
              <a
                href={linkedItem.slug ? `/eft/items/item/${linkedItem.slug}` : undefined}
                target={linkedItem.slug ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2 rounded-xs border-[0.5px] px-2.5 py-2 transition-colors"
                style={{
                  borderColor: `color-mix(in srgb, ${LINK_KIND_COLOR.item} 45%, transparent)`,
                  background: `color-mix(in srgb, ${LINK_KIND_COLOR.item} 10%, transparent)`,
                }}
              >
                <span className="relative size-6 shrink-0 overflow-hidden rounded-xs border-[0.5px] border-lines-hover">
                  <span className="absolute inset-0 bg-(--color-darkbase)" />
                  <span className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(linkedItem.bg ?? undefined) }} />
                  <img src={itemIconUrl(linkedItem.id)} alt="" className="absolute inset-0 size-full object-contain p-0.5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-blender-medium text-xs" style={{ color: LINK_KIND_COLOR.item }}>{linkedItem.name}</span>
                {linkedItem.slug && <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: LINK_KIND_COLOR.item }} />}
              </a>
            )}

            {/* Ряд действий квеста: «Выполнено?» (toggleQuest) + скрепка (togglePin) */}
            {questId && (
              <div className="flex w-full items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleQuest(questId)}
                  className={`flex h-7 min-w-px flex-1 items-center justify-center rounded-xs px-1 font-blender-medium text-sm uppercase transition-colors ${
                    isDone
                      ? 'bg-(--color-nvg-green)/15 text-nvg-green'
                      : 'bg-(--color-tactical-amber)/10 text-tactical-amber hover:bg-(--color-tactical-amber)/20'
                  }`}
                >
                  {isDone ? 'Выполнено' : 'Выполнено?'}
                </button>
                <button
                  type="button"
                  onClick={() => togglePin(questId)}
                  title={isPinned ? 'Открепить с Карты Квестов' : 'Закрепить на Карте Квестов'}
                  aria-pressed={isPinned}
                  className="flex size-7 shrink-0 items-center justify-center rounded border transition-colors"
                  style={isPinned ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : { borderColor: 'var(--color-lines-hover)' }}
                >
                  <Paperclip className={`h-4 w-4 ${isPinned ? 'text-(--color-darkbase)' : 'text-text-secondary'}`} />
                </button>
              </div>
            )}

            {/* Ряд admin: ⇄ Переместить · ✎ Редактировать (заменил карандаш-тоггл) */}
            {canEdit && (
              <div className="flex w-full items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onMove?.()}
                  title="Переместить маркер на карте"
                  className="flex h-7 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs border-[0.5px] border-lines-hover bg-card-menu font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary)"
                >
                  <Move3d className="h-3 w-3" /> Переместить
                </button>
                <button
                  type="button"
                  onClick={enterEdit}
                  title="Редактировать маркер"
                  className="flex h-7 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs border-[0.5px] border-lines-hover bg-card-menu font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary)"
                >
                  <MapPinPen className="h-3 w-3" /> Редактировать
                </button>
                {marker.sourceMarkerId && onHide && !deleteOpen && (
                  <button
                    type="button"
                    onClick={onHide}
                    title="Скрыть этот синканный маркер"
                    className="flex h-7 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs border-[0.5px] border-lines-hover bg-card-menu font-blender-medium text-type-micro uppercase tracking-wide text-text-secondary transition-colors hover:border-danger/50 hover:text-danger"
                  >
                    <EyeOff className="h-3 w-3" /> Скрыть
                  </button>
                )}
              </div>
            )}

            {/* Кнопка-пометка — только в РЕЖИМЕ УДАЛЕНИЯ (drawer открыт): помечает маркер (→ прозрачный
                + красный крест), уходит в drawer на батч-подтверждение. editorial → «Удалить»,
                синканый tarkov.dev → «Скрыть» (hide-override, удалить его нельзя). */}
            {canEdit && deleteKey && deleteOpen && (
              <button
                type="button"
                onClick={() => toggleDeleteMark(deleteKey)}
                title={isMarkedForDelete ? 'Убрать из списка удаления' : 'Пометить на удаление'}
                className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-xs border-[0.5px] font-blender-medium text-type-micro uppercase tracking-widest transition-colors ${
                  isMarkedForDelete ? 'border-danger bg-danger-dim text-danger' : 'border-danger/50 text-danger hover:border-danger hover:bg-danger-dim'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />{' '}
                {isMarkedForDelete ? 'В списке удаления ✓' : marker.id ? 'Удалить' : 'Скрыть'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Уголок-хвостик popup'а (28×14) — указывает вниз на каплю; чёрная обводка 1.5px. */}
      <svg width="28" height="14" viewBox="0 0 28 14" className="shrink-0 overflow-visible" aria-hidden="true">
        <path d="M0 0 L14 14 L28 0" fill="var(--color-tactical-amber)" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>

      {/* Лайтбокс скринов — полноэкранный оверлей поверх всего (portal в body). stopPropagation
          на mousedown, чтобы document-listener закрытия popup'а не схлопнул карточку. */}
      {lightbox !== null &&
        shots[lightbox] &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setLightbox(null)}
          >
            <img
              src={shots[lightbox]}
              alt=""
              className="max-h-[90vh] max-w-[92vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Закрыть"
              className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-sm border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:text-(--primary)"
            >
              <X className="h-5 w-5" />
            </button>
            {shots.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); stepLightbox(-1); }}
                  aria-label="Предыдущий"
                  className="absolute top-1/2 left-4 flex size-10 -translate-y-1/2 items-center justify-center rounded-sm border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:text-(--primary)"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); stepLightbox(1); }}
                  aria-label="Следующий"
                  className="absolute top-1/2 right-4 flex size-10 -translate-y-1/2 items-center justify-center rounded-sm border border-lines-hover bg-card-menu text-text-secondary transition-colors hover:text-(--primary)"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-sm bg-black/60 px-2 py-1 font-blender-medium text-xs text-text-primary tabular-nums">
                  {lightbox + 1} / {shots.length}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}

      {/* Пикер скринов — боковая панель СПРАВА от карточки (portal в body, якорь = cardRootRef).
          onPick добавляет URL в draft.screenshots. */}
      {picking && (
        <MediaPicker
          anchorRef={cardRootRef}
          onPick={(url) => {
            setDraft((d) => ({ ...d, screenshots: [...d.screenshots, url] }));
            setPicking(false);
          }}
          onPickMany={(urls) => {
            setDraft((d) => ({ ...d, screenshots: [...d.screenshots, ...urls] }));
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

// Амбер прогресс-бар шага визарда (N сегментов, заполнены до текущего).
// Скелетон результатов поиска предмета (§4.8: загрузка показывает ФОРМУ будущего контента —
// строки «иконка + имя» с animate-pulse, а не спиннер). Иконка-квадрат под размер строк выдачи.
function ItemSearchSkeleton({ rows = 3, icon = 28 }: { rows?: number; icon?: number }) {
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <span className="shrink-0 animate-pulse rounded-xs bg-lines-hover" style={{ width: icon, height: icon }} />
          <span
            className="h-3 animate-pulse rounded-xs bg-lines-hover"
            style={{ width: `${70 - i * 12}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function StepProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[3px] w-5 rounded-full transition-colors"
          style={{ backgroundColor: i < current ? 'var(--color-tactical-amber)' : 'var(--color-lines-hover)' }}
        />
      ))}
    </div>
  );
}

// Кнопка выбора типа связи (шаг 4).
function LinkKindButton({
  on,
  onClick,
  label,
  color,
  iconClass,
  disabled = false,
  title,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  color: string;
  /** icon-mask класс (icon-eft-*); красится currentColor кнопки (цвет связи / text-secondary). */
  iconClass?: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={on}
      className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-xs border-[0.5px] px-0.5 font-blender-medium text-[0.5625rem] uppercase tracking-tight transition-colors disabled:opacity-40"
      style={
        on
          ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }
          : { borderColor: 'var(--color-lines-hover)', color: 'var(--color-text-secondary)' }
      }
    >
      {iconClass && <span className={`icon-mask ${iconClass} size-3.5 shrink-0`} />}
      <span className="truncate">{label}</span>
    </button>
  );
}

// Глиф маркера по резолверу (тот же, что рисует на карте) — img или перекрашенная маска.
function MarkerGlyph({ input, size = 22 }: { input: MarkerIconInput; size?: number }) {
  const icon = markerIconUrl(input);
  if (!icon) return <span className="rounded-full bg-text-muted" style={{ width: size * 0.5, height: size * 0.5 }} />;
  if (icon.mode === 'img') return <img src={icon.url} alt="" className="object-contain" style={{ width: size, height: size }} />;
  return (
    <span
      style={{
        width: size,
        height: size,
        backgroundColor: markerColor(input.type),
        maskImage: `url(${icon.url})`,
        WebkitMaskImage: `url(${icon.url})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}

// Глиф с поддержкой лут-ПРЕДМЕТА (editorial: category=itemId → иконка предмета), иначе резолвер.
function GlyphFor({ shape, size }: { shape: CatShape; size: number }) {
  if (shape.type === 'loot' && isItemId(shape.category)) {
    return <img src={itemIconUrl(shape.category as string)} alt="" className="shrink-0 rounded-xs object-contain" style={{ width: size, height: size }} />;
  }
  return <MarkerGlyph input={glyphInputFor(shape)} size={size} />;
}

// Ячейка предмета «как в инвентаре»: фон редкости + внутренняя тень + иконка с drop-shadow.
// Паттерн 1:1 с каталожной EftItemTile/Media. bg = backgroundColor предмета (редкость) из priceIndex;
// нет bg — нейтральный тёмный фон (getTarkovBackgroundColor(undefined)).
function ItemCell({ id, bg, size }: { id: string; bg?: string | null; size: number }) {
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-xs border-[0.5px] border-lines-hover"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 bg-(--color-darkbase)" />
      <span className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(bg ?? undefined) }} />
      <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]" />
      <img src={itemIconUrl(id)} alt="" className="absolute inset-0 size-full object-contain p-1 drop-shadow-lg" />
    </span>
  );
}

// Иконка категории шага 1 — цветной img (у всех marker-svg свой градиент+обводка).
function CatIcon({ cat, size }: { cat: WizardCategory; size: number }) {
  return <img src={cat.src} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
}

// Ячейка сетки подкатегорий 36×36 (иконка + тултип).
function SubCell({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={on}
      className={`flex size-9 shrink-0 items-center justify-center rounded-xs border bg-card-menu transition-colors ${
        on ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)/50'
      }`}
    >
      {children}
    </button>
  );
}
