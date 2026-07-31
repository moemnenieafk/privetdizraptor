'use client';

// Правый drawer «Удаление маркеров» (admin) — по образцу «Легенды карты» (MapLayersDrawer): right-slide,
// h-14 шапка, controlled open. Двухстадийное удаление: из карточки маркер ПОМЕЧАЕТСЯ (useMapUiStore.
// deleteMarks), здесь — список помеченных + батч-ПОДТВЕРЖДЕНИЕ. Данные помеченных резолвит MapViewerClient.
import { Trash2, X } from 'lucide-react';
import type { EditorialMarkerData } from './EditorialMarkerCard';

interface Props {
  /** Помеченные на удаление editorial-маркеры (резолвит родитель по deleteMarks). */
  marked: EditorialMarkerData[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Убрать маркер из списка помеченных (не удаляя). */
  onUnmark: (id: string) => void;
  /** Подтвердить батч-удаление всех помеченных. */
  onConfirm: () => void;
  busy: boolean;
}

export function MarkerDeletionDrawer({ marked, open, onOpenChange, onUnmark, onConfirm, busy }: Props) {
  return (
    <div
      className={`absolute top-0 right-0 z-[540] flex h-full w-87 flex-col border-l border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Шапка 56px: заголовок + кнопка-закрыть (danger-иконка корзины — та же роль, что открывает). */}
      <div className="flex h-14 shrink-0 items-center justify-end gap-3 px-3.5">
        <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">Удаление маркеров</span>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Закрыть удаление"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-danger bg-danger text-(--color-base)"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Список помеченных */}
      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {marked.length === 0 ? (
          <p className="px-3 py-8 text-center font-blender-book text-xs leading-relaxed text-text-muted">
            Нет помеченных маркеров.
            <br />
            Откройте маркер и нажмите «Удалить» — он попадёт сюда на подтверждение.
          </p>
        ) : (
          marked.map((m) => {
            // Ключ пометки: editorial → id; синканый → `src:<sourceMarkerId>` (тот же, что ставит карточка).
            const key = m.id ?? (m.sourceMarkerId ? `src:${m.sourceMarkerId}` : '');
            return (
              <div key={key} className="flex items-center gap-2 rounded-xs border-[0.5px] border-lines-hover px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-primary">{m.title || 'Без названия'}</span>
                {!m.id && <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-wide text-text-muted">скрыть</span>}
                <button
                  type="button"
                  onClick={() => key && onUnmark(key)}
                  title="Убрать из списка (не удалять)"
                  className="shrink-0 text-text-muted transition-colors hover:text-(--primary)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Футер: батч-подтверждение (только когда есть помеченные) */}
      {marked.length > 0 && (
        <div className="shrink-0 border-t border-lines-hover p-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xs bg-danger font-blender-medium text-sm uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Подтвердить удаление ({marked.length})
          </button>
        </div>
      )}
    </div>
  );
}
