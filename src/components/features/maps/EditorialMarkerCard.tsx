'use client';

// Карточка редакторского маркера (Figma node 2349-929). ПОКАЗ = РЕДАКТОР: те же поля
// правятся инлайн (editable). Один вариант карточки, w-87 (348). Переиспользует контролы
// квеста: «Выполнено?» = useQuestStore.toggleQuest, скрепка = togglePin (по linkId квеста).
// Данные — editorial_markers (schema-editorial). Решения: docs/decisions/editorial-markers-tool.md.
import { useState } from 'react';
import { Plus, X, Paperclip } from 'lucide-react';
import { traderImg, traderCssVar } from '@/lib/trader-utils';
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
  /** Режим модератора: инлайн-правка заголовка/описания + клетка «+» в галерее. */
  editable?: boolean;
  onChange?: (patch: Partial<EditorialMarkerView>) => void;
  onAddScreenshot?: () => void;
  onRemoveScreenshot?: (index: number) => void;
}

export function EditorialMarkerCard({
  marker,
  linkedQuest,
  editable = false,
  onChange,
  onAddScreenshot,
  onRemoveScreenshot,
}: Props) {
  const [sel, setSel] = useState(0);
  const completed = useQuestStore((s) => s.completedQuests);
  const pinned = useQuestStore((s) => s.pinnedQuests);
  const toggleQuest = useQuestStore((s) => s.toggleQuest);
  const togglePin = useQuestStore((s) => s.togglePin);

  const questId = marker.linkKind === 'quest' ? marker.linkId ?? null : null;
  const isDone = questId ? completed.includes(questId) : false;
  const isPinned = questId ? pinned.includes(questId) : false;

  // Тинт карточки = цвет трейдера связанного квеста (иначе нейтральный).
  const tintVar = linkedQuest ? `var(${traderCssVar(linkedQuest.traderNn)}, var(--color-lines-hover))` : 'var(--color-lines-hover)';
  const hero = marker.screenshots[sel] ?? marker.screenshots[0];

  return (
    <div className="flex w-full flex-col items-center gap-1">
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
            {marker.screenshots.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSel(i)}
                className={`relative h-7 w-[49px] shrink-0 overflow-hidden rounded-xs border transition-colors ${
                  i === sel ? 'border-(--color-tactical-amber)' : 'border-[0.5px] border-lines-hover'
                }`}
              >
                <img src={src} alt="" className="size-full object-cover" />
                {editable && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onRemoveScreenshot?.(i); }}
                    className="absolute right-0 top-0 flex size-3.5 items-center justify-center bg-black/60 text-text-secondary hover:text-danger"
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            ))}
            {editable && (
              <button
                type="button"
                onClick={onAddScreenshot}
                title="Добавить скриншот"
                className="flex h-7 w-[49px] shrink-0 items-center justify-center rounded-xs border-[0.5px] border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="aspect-[348/196] w-full overflow-hidden rounded bg-card-menu">
            {hero ? (
              <img src={hero} alt="" className="size-full object-cover" />
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
        {editable ? (
          <input
            value={marker.title}
            onChange={(e) => onChange?.({ title: e.target.value })}
            placeholder="Название маркера"
            className="w-full bg-transparent font-blender-medium text-base text-text-primary outline-none placeholder:text-text-muted"
          />
        ) : (
          <p className="w-full font-blender-medium text-base leading-none text-text-primary">{marker.title}</p>
        )}

        {/* ── Описание ── */}
        {editable ? (
          <textarea
            value={marker.description ?? ''}
            onChange={(e) => onChange?.({ description: e.target.value })}
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
      </div>

      {/* Уголок-хвостик popup'а (28×14) — указывает вниз на каплю; чёрная обводка 1.5px. */}
      <svg width="28" height="14" viewBox="0 0 28 14" className="shrink-0 overflow-visible" aria-hidden="true">
        <path d="M0 0 L14 14 L28 0" fill="var(--color-tactical-amber)" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
