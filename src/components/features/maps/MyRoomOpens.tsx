'use client';

// Личный счётчик «сколько раз Я открыл эту комнату» (localStorage, per-room) + прогресс к окупаемости
// ключа. Индивидуальный — отдельно от общего трекера сообщества. Решение: docs/decisions/marked-rooms.md.
import { useSyncExternalStore } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useRoomOpensStore } from '@/store/useRoomOpensStore';

interface Props {
  roomId: string;
  breakeven: number | null; // за сколько открытий окупается ключ
  sumEv: number;            // средняя добыча за открытие (₽)
  keyCost: number | null;   // цена получения ключа (₽)
}

const rub = (n: number) => Math.round(n).toLocaleString('ru-RU');

export function MyRoomOpens({ roomId, breakeven, sumEv, keyCost }: Props) {
  const count = useRoomOpensStore((s) => s.counts[roomId] ?? 0);
  const inc = useRoomOpensStore((s) => s.inc);
  const dec = useRoomOpensStore((s) => s.dec);
  const reset = useRoomOpensStore((s) => s.reset);
  // Гидрация persist-стора: на SSR и в первый клиентский рендер показываем 0 (совпадает с сервером),
  // после гидрации localStorage — реальное число. useSyncExternalStore — без setState-в-эффекте.
  const hydrated = useSyncExternalStore(
    (cb) => useRoomOpensStore.persist.onFinishHydration(cb),
    () => useRoomOpensStore.persist.hasHydrated(),
    () => false,
  );
  const n = hydrated ? count : 0;

  const paidOff = breakeven != null && n >= breakeven;
  const remaining = breakeven != null ? Math.max(0, breakeven - n) : null;
  const netProfit = keyCost != null ? n * sumEv - keyCost : null;

  return (
    <div className="rounded border border-lines-hover bg-card-menu p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Мои открытия</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-blender-medium text-3xl leading-none tabular-nums text-text-primary">{n}</span>
            <span className="text-xs text-text-muted">раз</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => dec(roomId)}
            disabled={n === 0}
            aria-label="Минус"
            className="flex h-9 w-9 items-center justify-center rounded-xs border border-lines-hover text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary) disabled:opacity-30"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => inc(roomId)}
            aria-label="Плюс"
            className="flex h-9 w-9 items-center justify-center rounded-xs bg-(--primary) text-(--color-base) transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => reset(roomId)}
            disabled={n === 0}
            aria-label="Сброс"
            className="flex h-9 w-9 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-30"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {breakeven != null && (
        <div className="mt-3 border-t border-lines-hover pt-2.5 text-xs">
          {paidOff ? (
            <span className="text-nvg-green">
              Ключ окупился ✓
              {netProfit != null && netProfit > 0 && (
                <> · чистыми <span className="font-blender-medium">+{rub(netProfit)} ₽</span></>
              )}
            </span>
          ) : (
            <span className="text-text-secondary">
              До окупаемости ключа: <span className="font-blender-medium text-(--primary)">{remaining}</span> откр.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
