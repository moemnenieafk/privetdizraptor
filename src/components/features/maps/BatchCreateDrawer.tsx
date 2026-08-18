'use client';

// Правый drawer «Батч-постановка» (admin, editorial-карты) — по образцу MarkerEditDrawer. Когда
// шаблон меток задан, вьюер входит в режим постановки: каждый клик по карте кладёт точку (на
// текущем этаже). Здесь — сводка шаблона, список поставленных точек (№ + этаж) с построчным
// удалением, «Отменить последнюю» и коммит всех разом. Данные держит MapViewerClient.
import { Layers, Undo2, X } from 'lucide-react';

interface Props {
  open: boolean;
  /** Сводка шаблона меток: тип (для чипа-иконки словами) + заголовок. */
  templateType: string;
  templateTitle: string;
  /** Поставленные точки — рендерятся с № и подписью этажа. */
  points: { floor: number | null }[];
  /** Убрать одну точку по индексу. */
  onRemovePoint: (index: number) => void;
  /** Отменить последнюю поставленную точку. */
  onUndo: () => void;
  /** Записать все точки разом (INSERT каждой метки). */
  onCommit: () => void;
  /** Закрыть drawer — сбрасывает сессию (шаблон + точки). */
  onCancel: () => void;
  /** Идёт запись — блокирует кнопки. */
  busy: boolean;
  /** Индекс этажа → человекочитаемое имя (для подписи точки). */
  floorName?: (floor: number | null) => string;
}

export function BatchCreateDrawer({
  open,
  templateType,
  templateTitle,
  points,
  onRemovePoint,
  onUndo,
  onCommit,
  onCancel,
  busy,
  floorName,
}: Props) {
  const n = points.length;
  return (
    <div
      className={`absolute top-0 right-0 z-[540] flex h-full w-87 flex-col border-l border-lines-hover bg-(--color-base)/95 backdrop-blur-md transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Шапка 56px: заголовок + кнопка-закрыть (та же mappin-plus иконка, что открывает режим). */}
      <div className="flex h-14 shrink-0 items-center justify-end gap-3 px-3.5">
        <span className="font-blender-medium text-base uppercase tracking-widest text-text-primary">Батч-постановка</span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Закрыть батч-постановку"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-(--primary) bg-(--primary) text-(--color-base)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Сводка шаблона: чип типа + заголовок. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-lines-hover px-3.5 pb-3">
        <Layers className="h-4 w-4 shrink-0 text-(--primary)" />
        <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-primary">{templateTitle || 'Без названия'}</span>
        <span className="shrink-0 font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">{templateType}</span>
      </div>

      {/* Список поставленных точек (№ + этаж). */}
      <div className="scrollbar-hidden flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {n === 0 ? (
          <p className="px-3 py-8 text-center font-blender-book text-xs leading-relaxed text-text-muted">
            Точек нет.
            <br />
            Кликайте по карте — каждый клик ставит метку по шаблону. Смена этажа переносит следующие клики.
          </p>
        ) : (
          points.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xs border-[0.5px] border-lines-hover px-2.5 py-2">
              <span className="w-6 shrink-0 font-blender-medium text-xs tabular-nums text-(--primary)">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-blender-book text-sm text-text-secondary">{floorName?.(p.floor) ?? '—'}</span>
              <button
                type="button"
                onClick={() => onRemovePoint(i)}
                title="Убрать точку"
                className="shrink-0 text-text-muted transition-colors hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Футер: отменить последнюю + коммит всех разом. */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-lines-hover p-3">
        <button
          type="button"
          onClick={onUndo}
          disabled={n === 0 || busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xs border border-lines-hover font-blender-medium text-sm uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Undo2 className="h-4 w-4" /> Отменить последнюю
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={n === 0 || busy}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xs bg-(--primary) font-blender-medium text-sm uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Добавить маркеры ({n})
        </button>
      </div>
    </div>
  );
}
