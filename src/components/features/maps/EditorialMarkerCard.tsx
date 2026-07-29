'use client';

// Карточка редакторского маркера (Figma node 2349-929). ПОКАЗ = РЕДАКТОР: те же поля
// правятся инлайн (editable). Один вариант карточки, w-87 (348). Переиспользует контролы
// квеста: «Выполнено?» = useQuestStore.toggleQuest, скрепка = togglePin (по linkId квеста).
// Данные — editorial_markers (schema-editorial). Решения: docs/decisions/editorial-markers-tool.md.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Paperclip, Pencil, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
import { MediaPicker } from '@/components/features/media/MediaPicker';
import { useQuestStore } from '@/store/useQuestStore';
import type { EditorialLinkKind } from '@/db/schema-editorial';

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
}

interface Props {
  marker: EditorialMarkerView;
  /** Разрешённый связанный квест (linkKind='quest') — для ряда трейдер/уровень/каппа. */
  linkedQuest?: LinkedQuestInfo | null;
  /** Юзер может править (admin/editor) — показывает кнопку-карандаш переключения режима. */
  canEdit?: boolean;
  /** Открыть сразу в режиме правки (новый маркер, только что поставленный). */
  defaultEditing?: boolean;
  /** slug карты — для ревалидации кэша страницы при сохранении. */
  mapSlug?: string;
  /** После успешного сохранения/удаления — родитель обновляет данные (router.refresh) и закрывает. */
  onMutated?: () => void;
}

export function EditorialMarkerCard({
  marker,
  linkedQuest,
  canEdit = false,
  defaultEditing = false,
  mapSlug,
  onMutated,
}: Props) {
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(defaultEditing);
  // Локальный черновик правок (сохранение в API — следующий шаг). Сброс при смене маркера —
  // через key={marker.id} на компоненте в родителе.
  const [draft, setDraft] = useState({ title: marker.title, description: marker.description ?? '', screenshots: [...marker.screenshots] });
  const editField = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));
  const [picking, setPicking] = useState(false);

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
          type: marker.type,
          category: marker.category,
          title: draft.title,
          description: draft.description,
          screenshots: draft.screenshots,
          linkKind: marker.linkKind,
          linkId: marker.linkId,
          linkStep: marker.linkStep,
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
        className="flex w-full flex-col items-center gap-2.5 rounded border-[0.5px] p-3.5 backdrop-blur-md"
        style={{
          borderColor: `color-mix(in srgb, ${tintVar} 60%, transparent)`,
          background: `radial-gradient(circle at 0% 0%, color-mix(in srgb, ${tintVar} 15%, transparent), rgba(0,0,0,0.84))`,
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

        {/* ── Ряд правки: Сохранить / Удалить (только в режиме editing) ── */}
        {editing && (
          <div className="flex w-full items-center gap-2.5">
            <button
              type="button"
              onClick={save}
              disabled={busy}
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
