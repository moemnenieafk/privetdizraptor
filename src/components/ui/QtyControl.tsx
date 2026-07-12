'use client';

// Управляемый ввод количества для трекеров. Решает боль «×4500 кликов»:
//  1) тап по числу → цифровой инпут (mobile numeric keypad), Enter/blur коммитит;
//  2) −/+ с удержанием и ускорением (для мелкой доводки на больших required);
//  3) опциональные «Макс» (залить до нужного) и «Сброс» (обнулить).
// Контролируемый (value + onChange), доменного стейта нет — чистый ui-атом.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface QtyControlProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
  /** md — крупный (шапка одиночной карточки), sm — компакт (строки заданий). */
  size?: 'sm' | 'md';
  /** Кнопка «Макс» — залить до нужного. */
  showMax?: boolean;
  /** Кнопка «Сброс» — обнулить. */
  showClear?: boolean;
}

const clamp = (n: number, max: number): number => Math.max(0, Math.min(max, n));

/**
 * Повтор действия по удержанию с ускорением (240ms → 30ms).
 * ВАЖНО: step держим в ref — иначе таймер замыкается на устаревшем value
 * и повтор бесконечно пишет одно и то же число (значение «залипает»).
 */
function useHoldRepeat(step: () => void) {
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speed = useRef(240);
  const stepRef = useRef(step);
  stepRef.current = step;

  const stop = useCallback(() => {
    if (delay.current) clearTimeout(delay.current);
    if (loop.current) clearTimeout(loop.current);
  }, []);

  const start = useCallback(() => {
    stepRef.current();
    speed.current = 240;
    const tick = () => {
      stepRef.current();
      speed.current = Math.max(30, speed.current * 0.8);
      loop.current = setTimeout(tick, speed.current);
    };
    delay.current = setTimeout(tick, 400);
  }, []);

  useEffect(() => stop, [stop]);
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

export function QtyControl({ value, max, onChange, size = 'sm', showMax = false, showClear = false }: QtyControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const done = value >= max;
  const dec = useHoldRepeat(() => onChange(clamp(value - 1, max)));
  const inc = useHoldRepeat(() => onChange(clamp(value + 1, max)));

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    onChange(clamp(parseInt(draft, 10) || 0, max));
    setEditing(false);
  };

  const btn = size === 'md' ? 'h-7 w-7' : 'h-5 w-5';
  const numW = size === 'md' ? 'w-14' : 'w-9';
  const numTxt = size === 'md' ? 'text-base' : 'text-xs';

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Убавить"
        disabled={value <= 0}
        {...(value <= 0 ? {} : dec)}
        style={{ touchAction: 'none' }}
        className={`flex ${btn} cursor-pointer select-none items-center justify-center rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-30`}
      >
        <Minus className="h-3 w-3" />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className={`${numW} h-6 rounded-xs border border-(--primary) bg-(--color-darkbase) text-center ${numTxt} font-blender-medium tabular-nums text-text-primary focus:outline-none`}
        />
      ) : (
        <button
          type="button"
          aria-label="Ввести количество"
          onClick={() => {
            setDraft(String(value));
            setEditing(true);
          }}
          className={`${numW} cursor-text text-center ${numTxt} font-blender-medium tabular-nums ${done ? 'text-success' : value > 0 ? 'text-text-primary' : 'text-text-muted'}`}
        >
          {value}
        </button>
      )}

      <button
        type="button"
        aria-label="Прибавить"
        disabled={done}
        {...(done ? {} : inc)}
        style={{ touchAction: 'none' }}
        className={`flex ${btn} cursor-pointer select-none items-center justify-center rounded-xs border border-lines-hover bg-lines-hover/50 text-text-secondary transition-colors hover:border-(--primary)/50 hover:text-(--primary) disabled:cursor-not-allowed disabled:opacity-30`}
      >
        <Plus className="h-3 w-3" />
      </button>

      {showMax && !done && (
        <button
          type="button"
          onClick={() => onChange(max)}
          className="h-6 cursor-pointer rounded-xs border border-(--primary)/50 bg-(--primary)/15 px-2 text-type-caption font-blender-medium uppercase tracking-wider text-(--primary) transition-colors hover:bg-(--primary)/25"
        >
          Макс
        </button>
      )}
      {showClear && value > 0 && (
        <button
          type="button"
          onClick={() => onChange(0)}
          className="h-6 cursor-pointer rounded-xs border border-lines-hover px-2 text-type-caption font-blender-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary"
        >
          Сброс
        </button>
      )}
    </div>
  );
}
