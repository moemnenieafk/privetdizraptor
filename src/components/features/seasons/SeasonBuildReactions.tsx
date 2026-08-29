'use client';

// Реакции на расшаренную сборку перков: лайк / дизлайк. Крупные боксовые кнопки
// (иконка сверху, счётчик снизу) по макету Figma node 3257-130. Оптимистичный тоггл с
// откатом; авторитетное состояние — из ответа API. Аноним — мягкий зов войти.
// Иконки — icon-mask (icon-eft-like/-dislike), красятся currentColor от text-* кнопки.
import { useCallback, useState } from 'react';
import Link from 'next/link';

type Value = -1 | 0 | 1;

interface Props {
  /** Канон-код сборки (из URL) — сервер валидирует и канонизирует повторно. */
  code: string;
  loggedIn: boolean;
  up: number;
  down: number;
  myValue: Value;
}

export function SeasonBuildReactions({ code, loggedIn, up, down, myValue }: Props) {
  const [state, setState] = useState({ up, down, myValue });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const react = useCallback(
    async (value: 1 | -1) => {
      if (busy) return;
      if (!loggedIn) {
        setNotice('login');
        return;
      }
      setBusy(true);
      setNotice(null);

      const prev = state;
      const nextMine: Value = prev.myValue === value ? 0 : value;
      const optimistic = {
        myValue: nextMine,
        up: prev.up + (nextMine === 1 ? 1 : 0) - (prev.myValue === 1 ? 1 : 0),
        down: prev.down + (nextMine === -1 ? 1 : 0) - (prev.myValue === -1 ? 1 : 0),
      };
      setState(optimistic);

      try {
        const res = await fetch('/api/eft/seasons/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, value }),
        });
        const data = (await res.json()) as { up?: number; down?: number; myValue?: Value; error?: string };
        if (!res.ok) {
          setState(prev);
          setNotice(res.status === 401 ? 'login' : (data.error ?? 'Не удалось'));
          return;
        }
        setState({ up: data.up ?? optimistic.up, down: data.down ?? optimistic.down, myValue: data.myValue ?? nextMine });
      } catch {
        setState(prev);
        setNotice('Сеть недоступна');
      } finally {
        setBusy(false);
      }
    },
    [busy, loggedIn, state, code],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-7">
        <ReactionButton
          kind="up"
          active={state.myValue === 1}
          count={state.up}
          disabled={busy}
          onClick={() => void react(1)}
        />
        <ReactionButton
          kind="down"
          active={state.myValue === -1}
          count={state.down}
          disabled={busy}
          onClick={() => void react(-1)}
        />
      </div>

      {notice === 'login' ? (
        <p className="font-blender-book text-type-caption text-text-secondary">
          <Link href="/login" className="text-(--primary) hover:underline">
            Войди
          </Link>
          , чтобы оценить сборку.
        </p>
      ) : notice ? (
        <p className="font-blender-book text-type-caption text-danger">{notice}</p>
      ) : null}
    </div>
  );
}

function ReactionButton({
  kind,
  active,
  count,
  disabled,
  onClick,
}: {
  kind: 'up' | 'down';
  active: boolean;
  count: number;
  disabled: boolean;
  onClick: () => void;
}) {
  // icon-mask наследует currentColor → цвет глифа = text-* кнопки (актив/ховер).
  const iconCls = kind === 'up' ? 'icon-eft-like' : 'icon-eft-dislike';
  const activeCls =
    kind === 'up'
      ? 'border-nvg-green bg-[color-mix(in_srgb,var(--color-nvg-green)_16%,var(--color-card-menu))] text-nvg-green'
      : 'border-danger bg-[color-mix(in_srgb,var(--color-danger)_16%,var(--color-card-menu))] text-danger';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={kind === 'up' ? 'Годнота' : 'Так себе'}
      className={`flex size-32 flex-col items-center justify-center gap-3 rounded-lg border transition-colors disabled:opacity-60 sm:size-40 ${
        active
          ? activeCls
          : 'border-lines-hover bg-card-menu text-text-secondary hover:border-(--primary) hover:text-text-primary'
      }`}
    >
      <span aria-hidden className={`icon-mask size-9 sm:size-10.5 ${iconCls}`} />
      <span className="font-blender-medium text-xl leading-none">{count}</span>
    </button>
  );
}
