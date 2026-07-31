'use client';

// Карточка редакторского маркера. ДВА режима:
//  • ПОКАЗ (Figma «Marker - On Click», node 2374-2492) — для всех: медиа/строка категории/
//    заголовок/описание/чип-связи; для admin/editor ряд «⇄ Переместить / ✎ Редактировать».
//  • ПРАВКА = 4-шаговый ВИЗАРД (Figma «UI - Step Marker Creation control», node 2374-2468):
//    01 категория → 02 объект → 03 название/описание → 04 связь. Навигация Далее/Назад,
//    амбер прогресс-бар. Шаг «объект» пропускается у типов без под-категории (poi и пр.).
// Данные — editorial_markers. Решения: docs/decisions/UI - Step Marker Creation control.md,
// docs/decisions/editorial-markers-tool.md.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, X, Paperclip, ChevronLeft, ChevronRight, ZoomIn, Bookmark, Move3d, MapPinPen,
  ArrowLeft, ArrowRight, Save, Trash2,
} from 'lucide-react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { SPAWN_CATEGORIES, LOOT_CATEGORIES, CONTAINER_CATEGORIES, defaultCategory, categoryLabel } from '@/data/map-markers/categories';
import { markerIconUrl, markerColor, type MarkerIconInput } from '@/data/map-marker-icons';
import { MediaPicker } from '@/components/features/media/MediaPicker';
import { useQuestStore } from '@/store/useQuestStore';
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
const EXTRACT_FACTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'Общий' },
  { key: 'pmc', label: 'ЧВК' },
  { key: 'scav', label: 'Дикий' },
];
// Под-типы опасностей (meta.hazardType) и вид зоны задания (meta.objectiveKind) — из легенды.
const HAZARD_SUBTYPES: { key: string; label: string }[] = [
  { key: 'sniper', label: 'Снайпер' },
  { key: 'mine', label: 'Мина' },
  { key: 'mortar', label: 'Миномёт' },
  { key: 'tripwire', label: 'Растяжки' },
  { key: 'other', label: 'Зона' },
];
const QUESTZONE_KINDS: { key: string; label: string }[] = [
  { key: 'target', label: 'Цель' },
  { key: 'item', label: 'Предмет' },
];

// Цвет закладки/чипа по типу привязки (совпадает с цветом капли в MapViewerClient).
const LINK_KIND_COLOR: Record<EditorialLinkKind, string> = { story: '#6096a6', quest: '#e68e25', event: '#c26be0', none: '#8a8a95' };

// ─── Визард ─────────────────────────────────────────────────────────────────
type WizardStep = 'category' | 'object' | 'details' | 'link';
// Типы, у которых есть шаг «выбор объекта» (под-категория). Прочие (poi/transit/lock/switch/
// stationary) идут сразу к названию; их пикеры шага 2 доедут в Ф3.
const OBJECT_STEP_TYPES = new Set(['extract', 'spawn', 'loot', 'container', 'hazard', 'quest_zone']);
// Короткая подпись категории для визарда (сетка шага 1 + заголовок шага).
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
}
function makeDraft(m: EditorialMarkerView): Draft {
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
  };
}

// Подпись категории маркера для строки показа/объекта (перекрывает локальные наборы + categoryLabel).
function markerCategoryLabel(m: CatShape): string {
  if (m.type === 'poi') return 'Точка интереса';
  if (m.type === 'extract') {
    const f = EXTRACT_FACTIONS.find((x) => x.key === (m.faction ?? 'all'));
    return f ? `Выход · ${f.label}` : 'Выход';
  }
  if (m.type === 'hazard' && m.category) return HAZARD_SUBTYPES.find((x) => x.key === m.category)?.label ?? 'Опасность';
  if (m.type === 'quest_zone') return m.category ? (QUESTZONE_KINDS.find((x) => x.key === m.category)?.label ?? 'Зона задания') : 'Зона задания';
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
  /** Название привязанной истории (linkKind='story') — для чипа связи в показе. */
  linkedStory?: { title: string } | null;
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
}

export function EditorialMarkerCard({
  marker,
  linkedQuest,
  linkedStory,
  canEdit = false,
  defaultEditing = false,
  questIndex,
  storyIndex,
  mapSlug,
  onMutated,
  onCancel,
}: Props) {
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(defaultEditing);
  // Локальный черновик правок. Сброс при смене маркера — через key={marker.id} на компоненте в родителе.
  const [draft, setDraft] = useState<Draft>(() => makeDraft(marker));
  const editField = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const selectType = (key: string) =>
    setDraft((d) => ({ ...d, type: key, category: key === d.type ? d.category : null, faction: key === 'extract' ? (d.faction ?? 'all') : null }));

  // ── Шаги визарда: набор зависит от типа (poi и пр. без шага «объект»). ──
  const [stepIdx, setStepIdx] = useState(0);
  const steps = useMemo<WizardStep[]>(() => {
    const s: WizardStep[] = ['category'];
    if (OBJECT_STEP_TYPES.has(draft.type)) s.push('object');
    s.push('details', 'link');
    return s;
  }, [draft.type]);
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
    if (marker.id) {
      setDraft(makeDraft(marker));
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

  const [picking, setPicking] = useState(false);
  // Подсказка «скоро» для кнопки «Переместить» (полноценный move-режим — следующий шаг визарда).
  const [moveHint, setMoveHint] = useState(false);
  const showMoveHint = () => {
    setMoveHint(true);
    setTimeout(() => setMoveHint(false), 2600);
  };
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

  // Сохранение/удаление через API (запись защищена canEditContent на сервере).
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
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
  const completed = useQuestStore((s) => s.completedQuests);
  const pinned = useQuestStore((s) => s.pinnedQuests);
  const toggleQuest = useQuestStore((s) => s.toggleQuest);
  const togglePin = useQuestStore((s) => s.togglePin);

  const questId = marker.linkKind === 'quest' ? marker.linkId ?? null : null;
  const isDone = questId ? completed.includes(questId) : false;
  const isPinned = questId ? pinned.includes(questId) : false;

  // Тинт карточки = цвет трейдера связанного квеста (иначе нейтральный).
  const tintVar = linkedQuest ? `var(${traderCssVar(linkedQuest.traderNn)}, var(--color-lines-hover))` : 'var(--color-lines-hover)';
  const hero = shots[sel] ?? shots[0];

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div
        className="scrollbar-hidden flex max-h-[82vh] w-full flex-col items-center gap-2.5 overflow-y-auto rounded border-[0.5px] p-3.5"
        style={{
          borderColor: `color-mix(in srgb, ${tintVar} 60%, transparent)`,
          background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${tintVar} 18%, var(--color-base)), var(--color-base))`,
        }}
      >
        {/* ── Галерея: миниатюры 49×28 + большой скрин (общая для показа и визарда) ── */}
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
                {editing ? 'Нет изображения. Добавьте скрин через «+».' : 'Нет скриншота'}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          /* ═════════════════ ВИЗАРД (правка) ═════════════════ */
          <>
            {/* Шаг + заголовок + амбер прогресс-бар */}
            <div className="flex w-full items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-blender-medium text-type-micro tabular-nums text-tactical-amber">{String(si + 1).padStart(2, '0')}</span>
                <span className="min-w-0 truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary">
                  {si === 0 ? 'Категория маркера' : WIZARD_TYPE_LABEL[draft.type] ?? 'Маркер'}
                </span>
              </span>
              <StepProgress total={steps.length} current={si + 1} />
            </div>

            {/* Индикатор выбранного объекта (шаги 2-4) */}
            {si >= 1 && (
              <div className="flex w-full items-center gap-2">
                <TypeGlyph input={glyphInputFor(draft)} size={24} />
                <span className="min-w-0 truncate font-blender-medium text-xs text-text-primary">{markerCategoryLabel(draft)}</span>
              </div>
            )}

            {/* ── Шаг 1: сетка категорий (3 колонки) ── */}
            {curStep === 'category' && (
              <div className="grid w-full grid-cols-3 gap-1.5">
                {MARKER_TYPES.map((t) => {
                  const on = draft.type === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => selectType(t.key)}
                      className={`flex h-11 items-center justify-center gap-1.5 rounded-xs border-[0.5px] px-1 transition-colors ${
                        on ? 'border-(--primary) bg-(--primary)/10' : 'border-lines-hover bg-card-menu hover:border-(--primary)/50'
                      }`}
                    >
                      <TypeGlyph input={{ type: t.key, faction: 'all', category: defaultCategory(t.key) || undefined }} size={18} />
                      <span className={`truncate font-blender-medium text-[10px] uppercase tracking-tight ${on ? 'text-(--primary)' : 'text-text-secondary'}`}>
                        {WIZARD_TYPE_LABEL[t.key] ?? t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Шаг 2: выбор объекта (под-категория). Пикеры уточняются в Ф3. ── */}
            {curStep === 'object' && (
              <div className="flex w-full flex-col gap-1.5">
                {draft.type === 'extract' && (
                  <div className="flex flex-wrap gap-1">
                    {EXTRACT_FACTIONS.map((f) => (
                      <SubCell key={f.key} on={(draft.faction ?? 'all') === f.key} onClick={() => setDraft((d) => ({ ...d, faction: f.key }))} label={f.label}>
                        <MarkerGlyph input={{ type: 'extract', faction: f.key }} size={24} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {draft.type === 'spawn' && (
                  <div className="flex flex-wrap gap-1">
                    {SPAWN_CATEGORIES.map((c) => (
                      <SubCell key={c.key} on={draft.category === c.key} onClick={() => setDraft((d) => ({ ...d, category: c.key }))} label={c.label}>
                        <MarkerGlyph input={{ type: 'spawn', category: c.key }} size={22} />
                      </SubCell>
                    ))}
                  </div>
                )}
                {(draft.type === 'loot' || draft.type === 'container') && (
                  <div className="scrollbar-hidden flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                    {(draft.type === 'loot' ? LOOT_CATEGORIES : CONTAINER_CATEGORIES).map((g) => (
                      <div key={g.group} className="flex flex-col gap-1">
                        <span className="font-blender-medium text-[9px] uppercase tracking-wide text-text-muted">{g.group}</span>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map((it) => {
                            const on = draft.category === it.key;
                            return (
                              <SubCell key={it.key} on={on} onClick={() => setDraft((d) => ({ ...d, category: it.key }))} label={it.label}>
                                {draft.type === 'loot' && it.icon ? (
                                  <span className={`icon-mask ${it.icon} size-6`} style={{ backgroundColor: on ? 'var(--primary)' : 'var(--color-text-secondary)' }} />
                                ) : (
                                  <MarkerGlyph input={{ type: 'container', category: it.key }} size={30} />
                                )}
                              </SubCell>
                            );
                          })}
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
                </div>

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
              <button
                type="button"
                onClick={goNext}
                disabled={((curStep === 'details' || isLast) && !titleOk) || busy}
                title={(curStep === 'details' || isLast) && !titleOk ? 'Введите название' : undefined}
                className="flex h-9 min-w-px flex-1 items-center justify-center gap-1.5 rounded-xs bg-(--primary) font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isLast ? <><Save className="h-3.5 w-3.5" /> Сохранить</> : <>Далее <ArrowRight className="h-3.5 w-3.5" /></>}
              </button>
            </div>
            {isLast && marker.id && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="flex items-center gap-1.5 font-blender-medium text-[10px] uppercase tracking-wide text-text-muted transition-colors hover:text-danger disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Удалить маркер
              </button>
            )}
          </>
        ) : (
          /* ═════════════════ ПОКАЗ (Marker - On Click) ═════════════════ */
          <>
            {/* Строка категории: иконка + подпись слева · закладка связи справа */}
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <TypeGlyph input={glyphInputFor(marker)} size={28} />
                <span className="min-w-0 truncate font-blender-medium text-type-micro uppercase tracking-widest text-text-secondary">
                  {markerCategoryLabel(marker)}
                </span>
              </div>
              {marker.linkKind !== 'none' && (
                <Bookmark className="h-4 w-4 shrink-0" style={{ color: LINK_KIND_COLOR[marker.linkKind] }} />
              )}
            </div>

            {/* Ряд привязки: трейдер/имя (слева) · уровень+каппа (справа) */}
            {linkedQuest && (
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-2">
                  <img src={traderImg(linkedQuest.traderNn)} alt="" className="size-4 shrink-0 rounded-[1px] border-[0.5px] border-black/50 object-cover" />
                  <span className="font-blender-medium text-xs text-text-primary">{linkedQuest.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {linkedQuest.minPlayerLevel != null && (
                    <span className="font-blender-medium text-[10px] uppercase text-text-secondary">ур. {linkedQuest.minPlayerLevel}+</span>
                  )}
                  {linkedQuest.lightkeeperRequired && <span className="icon-mask icon-eft-profile-lightkeeper size-4 text-(--color-lightkeeper)" />}
                  {linkedQuest.kappaRequired && <span className="icon-mask icon-eft-profile-kappa size-4 text-(--color-kappa)" />}
                </div>
              </div>
            )}

            {/* Заголовок */}
            <p className="w-full font-blender-medium text-base leading-none text-text-primary">{marker.title}</p>

            {/* Описание */}
            {marker.description && <p className="w-full font-blender-book text-xs leading-none text-text-secondary">{marker.description}</p>}

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
                  {marker.linkKind === 'story' ? (linkedStory?.title ?? marker.linkId) : (marker.linkId ?? 'Событие')}
                </span>
                {marker.linkKind === 'story' && marker.linkStep != null && (
                  <span className="shrink-0 font-blender-medium text-[10px] uppercase text-text-secondary">шаг {marker.linkStep}</span>
                )}
              </div>
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
              <>
                <div className="flex w-full items-center gap-2.5">
                  <button
                    type="button"
                    onClick={showMoveHint}
                    title="Режим перемещения — в следующем обновлении"
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
                </div>
                {moveHint && (
                  <p className="w-full text-center font-blender-book text-[10px] leading-tight text-text-muted">
                    Режим перемещения появится в следующем обновлении.
                  </p>
                )}
              </>
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

      {/* Пикер скринов из медиатеки. Рендерится ВНУТРИ карточки (DOM-потомок overlay) →
          outside-close popup'а не срабатывает. onPick добавляет URL в draft.screenshots. */}
      {picking && (
        <MediaPicker
          onPick={(url) => {
            setDraft((d) => ({ ...d, screenshots: [...d.screenshots, url] }));
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

// Амбер прогресс-бар шага визарда (N сегментов, заполнены до текущего).
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
      className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-xs border-[0.5px] px-0.5 font-blender-medium text-[9px] uppercase tracking-tight transition-colors disabled:opacity-40"
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

// Глиф категории с фолбэком для POI (у него нет img-арта в резолвере → маска point-of-interest).
function TypeGlyph({ input, size }: { input: MarkerIconInput; size: number }) {
  const icon = markerIconUrl(input);
  if (!icon && input.type === 'poi')
    return <span className="icon-mask icon-eft-point-of-interest shrink-0" style={{ width: size, height: size, backgroundColor: 'var(--color-text-secondary)' }} />;
  return <MarkerGlyph input={input} size={size} />;
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
