'use client';

// Карточка редакторского маркера (Figma node 2349-929). ПОКАЗ = РЕДАКТОР: те же поля
// правятся инлайн (editable). Один вариант карточки, w-87 (348). Переиспользует контролы
// квеста: «Выполнено?» = useQuestStore.toggleQuest, скрепка = togglePin (по linkId квеста).
// Данные — editorial_markers (schema-editorial). Решения: docs/decisions/editorial-markers-tool.md.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Paperclip, Pencil, ChevronLeft, ChevronRight, ZoomIn, Bookmark } from 'lucide-react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { SPAWN_CATEGORIES, LOOT_CATEGORIES, CONTAINER_CATEGORIES, defaultCategory } from '@/data/map-markers/categories';
import { markerIconUrl, markerColor, type MarkerIconInput } from '@/data/map-marker-icons';
import { MediaPicker } from '@/components/features/media/MediaPicker';
import { useQuestStore } from '@/store/useQuestStore';
import type { EditorialLinkKind } from '@/db/schema-editorial';

// Типы маркера (как в редакторе Ледокола) + POI без категории. Иконка резолвится manualMarkerIcon.
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

interface Props {
  marker: EditorialMarkerView;
  /** Разрешённый связанный квест (linkKind='quest') — для ряда трейдер/уровень/каппа. */
  linkedQuest?: LinkedQuestInfo | null;
  /** Название привязанной истории (linkKind='story') — для индикатора в показе. */
  linkedStory?: { title: string } | null;
  /** Юзер может править (admin/editor) — показывает кнопку-карандаш переключения режима. */
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
}: Props) {
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(defaultEditing);
  // Локальный черновик правок (сохранение в API — следующий шаг). Сброс при смене маркера —
  // через key={marker.id} на компоненте в родителе.
  const [draft, setDraft] = useState({
    title: marker.title,
    description: marker.description ?? '',
    screenshots: [...marker.screenshots],
    type: marker.type,
    category: marker.category ?? (null as string | null),
    faction: marker.faction ?? (null as string | null),
    linkKind: marker.linkKind,
    linkId: marker.linkId ?? null,
    linkStep: marker.linkStep ?? null,
  });
  const editField = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
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
      {/* Кнопка режима правки (admin/editor) — 36×36, стиль shell, слева над карточкой. */}
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
          title={editing ? 'Выйти из режима правки' : 'Редактировать маркер'}
          className={`mb-1 flex size-9 shrink-0 items-center justify-center self-start rounded-sm border backdrop-blur-md transition-colors ${
            editing
              ? 'border-(--primary) bg-(--primary) text-(--color-base)'
              : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
          }`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <div
        className="scrollbar-hidden flex max-h-[82vh] w-full flex-col items-center gap-2.5 overflow-y-auto rounded border-[0.5px] p-3.5"
        style={{
          borderColor: `color-mix(in srgb, ${tintVar} 60%, transparent)`,
          background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${tintVar} 18%, var(--color-base)), var(--color-base))`,
        }}
      >
        {/* ── Галерея: миниатюры 49×28 + большой скрин ── */}
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
              <div className="flex size-full items-center justify-center font-blender-book text-xs text-text-muted">Нет скриншота</div>
            )}
          </div>
        </div>

        {/* ── Категория маркера (режим правки): тип + подкатегория, как в редакторе Ледокола ── */}
        {editing && (
          <div className="flex w-full flex-col gap-1.5">
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">Категория</span>
            {/* Тип */}
            <div className="flex flex-wrap gap-1">
              {MARKER_TYPES.map((t) => {
                const on = draft.type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        type: t.key,
                        category: t.key === d.type ? d.category : null,
                        faction: t.key === 'extract' ? (d.faction ?? 'all') : null,
                      }))
                    }
                    className={`flex h-7 items-center gap-1 rounded-xs border-[0.5px] px-1.5 font-blender-medium text-[10px] uppercase transition-colors ${
                      on ? 'border-(--primary) bg-(--primary) text-(--color-base)' : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
                    }`}
                  >
                    <MarkerGlyph input={{ type: t.key, faction: 'all', category: defaultCategory(t.key) || undefined }} size={16} />
                    {t.label}
                  </button>
                );
              })}
            </div>
            {/* Подкатегория — сетка иконок 36×36 (глиф = реальная иконка маркера) + тултип */}
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
              <div className="scrollbar-hidden flex max-h-48 flex-col gap-1.5 overflow-y-auto">
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

        {/* ── Ряд привязки: трейдер/имя (слева) · уровень+каппа (справа) ── */}
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

        {/* ── Индикатор привязки к сюжету (показ) ── */}
        {!editing && marker.linkKind === 'story' && (
          <div className="flex w-full items-center gap-2">
            <Bookmark className="h-3.5 w-3.5 shrink-0" style={{ color: '#6096a6' }} />
            <span className="min-w-0 flex-1 truncate font-blender-medium text-xs" style={{ color: '#6096a6' }}>
              {linkedStory?.title ?? marker.linkId}
            </span>
            {marker.linkStep != null && (
              <span className="shrink-0 font-blender-medium text-[10px] uppercase text-text-secondary">шаг {marker.linkStep}</span>
            )}
          </div>
        )}

        {/* ── Заголовок ── */}
        {editing ? (
          <input
            value={draft.title}
            onChange={(e) => editField({ title: e.target.value })}
            placeholder="Название маркера"
            className="w-full bg-transparent font-blender-medium text-base text-text-primary outline-none placeholder:text-text-muted"
          />
        ) : (
          <p className="w-full font-blender-medium text-base leading-none text-text-primary">{marker.title}</p>
        )}

        {/* ── Описание ── */}
        {editing ? (
          <textarea
            value={draft.description}
            onChange={(e) => editField({ description: e.target.value })}
            placeholder="Описание: где искать, как дойти…"
            rows={3}
            className="w-full resize-none bg-transparent font-blender-book text-xs text-text-secondary outline-none placeholder:text-text-muted"
          />
        ) : (
          marker.description && <p className="w-full font-blender-book text-xs leading-none text-text-secondary">{marker.description}</p>
        )}

        {/* ── Ряд действий: «Выполнено?» (toggleQuest) + скрепка (togglePin) ── */}
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

        {/* ── Привязка: Без / Квест / Сюжет (режим правки) ── */}
        {editing && (questIndex || storyIndex) && (
          <div className="flex w-full flex-col gap-1.5">
            <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">Привязка</span>
            {/* Тип привязки */}
            <div className="flex gap-1">
              {(['none', 'quest', 'story'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setDraft((d) => ({ ...d, linkKind: k, linkId: null, linkStep: null })); setLinkQ(''); }}
                  className={`flex h-6 flex-1 items-center justify-center rounded-xs border-[0.5px] font-blender-medium text-[10px] uppercase transition-colors ${
                    draft.linkKind === k
                      ? 'border-(--primary) bg-(--primary) text-(--color-base)'
                      : 'border-lines-hover bg-card-menu text-text-secondary hover:text-(--primary)'
                  }`}
                >
                  {k === 'none' ? 'Без' : k === 'quest' ? 'Квест' : 'Сюжет'}
                </button>
              ))}
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

        {/* ── Ряд правки: Сохранить / Удалить (только в режиме editing) ── */}
        {editing && (
          <div className="flex w-full items-center gap-2.5">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.title.trim()}
              title={!draft.title.trim() ? 'Введите название' : undefined}
              className="flex h-7 min-w-px flex-1 items-center justify-center rounded-xs bg-(--primary) px-1 font-blender-medium text-sm uppercase text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Сохранить
            </button>
            {marker.id && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                title="Удалить маркер"
                className="flex size-7 shrink-0 items-center justify-center rounded border border-danger text-danger transition-colors hover:bg-danger-dim disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
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

