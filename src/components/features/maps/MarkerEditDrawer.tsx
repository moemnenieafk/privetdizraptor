'use client';

// Правый drawer «Батч-правка» (admin, editorial-карты) — по образцу MarkerDeletionDrawer. В режиме
// square-pen клик по метке ВЫБИРАЕТ её (useMapUiStore.editMarks), здесь — список выбранных + кнопка
// «Редактировать (N)», которая открывает визард. Данные выбранных резолвит MapViewerClient (markedForEdit).
import { Move, SquarePen, X } from 'lucide-react';
import type { EditorialMarkerData } from './EditorialMarkerCard';

interface Props {
  /** Выбранные для батч-правки editorial-маркеры (резолвит родитель по editMarks). */
  marked: EditorialMarkerData[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Убрать маркер из выбора. */
  onUnmark: (id: string) => void;
  /** Открыть визард батч-правки (применит поля ко всем выбранным). */
  onEdit: () => void;
  /** Батч-перемещение: сдвинуть все выбранные на общий вектор (правка систематического сдвига). */
  onMove: () => void;
}

export function MarkerEditDrawer({ marked, open, onOpenChange, onUnmark, onEdit, onMove }: Props) {
  return (
    <div
      className={`absolute top-0 right-0 z-[540] flex h-full w-87 flex-col border-l border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Шапка 56px: заголовок + кнопка-закрыть (та же square-pen иконка, что открывает режим). */}
      <div className="flex h-14 shrink-0 items-center justify-end gap-3 px-3.5">
        <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">Батч-правка</span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Закрыть батч-правку"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-(--primary) bg-(--primary) text-(--color-base)"
        >
          <SquarePen className="h-5 w-5" />
        </button>
      </div>

      {/* Список выбранных */}
      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {marked.length === 0 ? (
          <p className="px-3 py-8 text-center font-blender-book text-xs leading-relaxed text-text-muted">
            Нет выбранных маркеров.
            <br />
            Кликайте по меткам на карте — они попадут сюда, затем «Редактировать».
          </p>
        ) : (
          marked.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-xs border-[0.5px] border-lines-hover px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-primary">{m.title || 'Без названия'}</span>
              <button
                type="button"
                onClick={() => m.id && onUnmark(m.id)}
                title="Убрать из выбора"
                className="shrink-0 text-text-muted transition-colors hover:text-(--primary)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Футер: переместить группу (правка сдвига калибровки) + открыть визард батч-правки полей */}
      {marked.length > 0 && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-lines-hover p-3">
          <button
            type="button"
            onClick={onMove}
            title="Сдвинуть всю группу на общий вектор (клик «откуда» → «куда»)"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xs bg-(--primary) font-blender-medium text-sm uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90"
          >
            <Move className="h-4 w-4" /> Переместить ({marked.length})
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xs border border-lines-hover font-blender-medium text-sm uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
          >
            <SquarePen className="h-4 w-4" /> Редактировать ({marked.length})
          </button>
        </div>
      )}
    </div>
  );
}
