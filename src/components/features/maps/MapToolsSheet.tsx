'use client';

import { Crosshair, MapPin, Ruler, SquarePen, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/layout/BottomSheet';
import { useMapUiStore } from '@/store/useMapUiStore';
import type { TrackerControls } from './PlayerTracker';

interface MapToolsSheetProps {
  /** admin/editor — показывать инструменты правки меток (постановка/редактирование/удаление). */
  canEditMarkers?: boolean;
  /** Единый инстанс трекера (тот же, что низ-право/MobileMapBar). GPS-строка. */
  tracker: TrackerControls;
}

/**
 * Шит «Инструменты» (mobile, M2 Figma 2587:2772). Собирает инструменты карты, которые на
 * десктопе живут в верхнем баре (MapTopBar): добавить метку · измерить расстояние · режим
 * правки меток · режим удаления · GPS-трекинг. Режимы — во взаимоисключающем сторе useMapUiStore
 * (addMode/rulerActive/overrideMode/deleteOpen), поэтому строки читают и переключают их напрямую.
 * Открытие — иконкой инструментов в MobileMapBar (openSheet('tools')). Переключение режима
 * закрывает шит, чтобы освободить карту под клик (как на десктопе).
 */
export function MapToolsSheet({ canEditMarkers, tracker }: MapToolsSheetProps) {
  const open = useMapUiStore((s) => s.activeSheet === 'tools');
  const close = useMapUiStore((s) => s.closeSheet);

  const addMode = useMapUiStore((s) => s.addMode);
  const toggleAddMode = useMapUiStore((s) => s.toggleAddMode);
  const rulerActive = useMapUiStore((s) => s.rulerActive);
  const toggleRuler = useMapUiStore((s) => s.toggleRuler);
  const overrideMode = useMapUiStore((s) => s.overrideMode);
  const toggleOverrideMode = useMapUiStore((s) => s.toggleOverrideMode);
  const deleteOpen = useMapUiStore((s) => s.deleteOpen);
  const toggleDelete = useMapUiStore((s) => s.toggleDelete);

  // Переключение режима + закрытие шита (карта должна быть доступна под клик/замер).
  const run = (fn: () => void) => {
    fn();
    close();
  };

  const gpsSupported = tracker.supported || tracker.active;

  return (
    <BottomSheet open={open} title="Инструменты" onClose={close}>
      <ul className="flex flex-col gap-1 pb-2">
        {canEditMarkers && (
          <ToolRow
            icon={<MapPin className="size-4" strokeWidth={2} />}
            label="Добавить свою метку"
            active={addMode}
            onClick={() => run(toggleAddMode)}
          />
        )}
        <ToolRow
          icon={<Ruler className="size-4" strokeWidth={2} />}
          label="Измерить расстояние"
          active={rulerActive}
          onClick={() => run(toggleRuler)}
        />
        {canEditMarkers && (
          <ToolRow
            icon={<SquarePen className="size-4" strokeWidth={2} />}
            label="Режим редактирования меток"
            active={overrideMode}
            onClick={() => run(toggleOverrideMode)}
          />
        )}
        {canEditMarkers && (
          <ToolRow
            icon={<Trash2 className="size-4" strokeWidth={2} />}
            label="Режим удаления меток"
            active={deleteOpen}
            danger
            onClick={() => run(toggleDelete)}
          />
        )}
        <ToolRow
          icon={<Crosshair className={`size-4 ${tracker.requesting ? 'animate-pulse' : ''}`} strokeWidth={2} />}
          label="GPS, трекинг игрока на локации"
          hint="Работает на ПК, нужна установленная игра"
          active={tracker.active}
          disabled={!gpsSupported}
          onClick={() => run(tracker.toggle)}
        />
      </ul>
    </BottomSheet>
  );
}

function ToolRow({
  icon,
  label,
  hint,
  active,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  // Статические классы (не интерполяция) — Tailwind JIT их видит; амбер = --primary (§6),
  // деструктивная строка удаления = danger.
  const rowActive = danger ? 'border-danger bg-danger/10' : 'border-(--primary) bg-(--primary)/10';
  const boxActive = danger ? 'border-danger text-danger' : 'border-(--primary) text-(--primary)';
  const labelActive = danger ? 'text-danger' : 'text-(--primary)';
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        className={`flex w-full items-center gap-3.5 rounded-xs border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? rowActive : 'border-lines-hover bg-card-menu'
        }`}
      >
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded border transition-colors ${
            active ? boxActive : 'border-lines-hover text-text-secondary'
          }`}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={`font-blender-medium text-xs uppercase tracking-widest ${
              disabled ? 'text-text-muted' : active ? labelActive : 'text-text-primary'
            }`}
          >
            {label}
          </span>
          {hint && (
            <span className="font-blender-book text-[8px] uppercase tracking-widest text-danger">{hint}</span>
          )}
        </span>
      </button>
    </li>
  );
}
