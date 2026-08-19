'use client';

// Живой обратный отсчёт до конца сезона. Официальной даты конца у BSG нет → считаем к
// гарантированному минимуму (старт + minDays), подпись это честно проговаривает (minimum).
// Тикает раз в секунду; mount-gate (now=null до маунта) убирает hydration-mismatch между SSR и клиентом.

import { useEffect, useState } from 'react';

interface Props {
  /** ISO-дата цели отсчёта. */
  target: string;
  /** Акцент сезона (CSS-цвет) — числа и строка «срок пройден». */
  accent: string;
  /** target — это минимум, а не объявленная дата (меняет тексты). */
  minimum?: boolean;
}

const UNITS = [
  { key: 'd', label: 'дни' },
  { key: 'h', label: 'часы' },
  { key: 'm', label: 'мин' },
  { key: 's', label: 'сек' },
] as const;

function split(ms: number): Record<'d' | 'h' | 'm' | 's', number> {
  const clamped = Math.max(0, ms);
  return {
    d: Math.floor(clamped / 86_400_000),
    h: Math.floor((clamped % 86_400_000) / 3_600_000),
    m: Math.floor((clamped % 3_600_000) / 60_000),
    s: Math.floor((clamped % 60_000) / 1000),
  };
}

const pad = (n: number) => n.toString().padStart(2, '0');

export function SeasonCountdown({ target, accent, minimum }: Props) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Mount-gate часов: первый снимок времени берём только на клиенте (иначе SSR-время ≠ клиентское
    // → hydration mismatch), дальше тикаем каждую секунду. Синхронный setState здесь намеренный.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now == null ? null : targetMs - now;
  const ended = remaining != null && remaining <= 0;
  const t = remaining == null ? null : split(remaining);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
        {minimum ? 'Минимум до конца сезона' : 'До конца сезона'}
      </span>

      {ended ? (
        <div className="rounded-lg border border-lines-hover bg-(--color-base) px-4 py-3">
          <span className="font-blender-medium text-sm uppercase tracking-wide" style={{ color: accent }}>
            {minimum ? 'Минимальный срок пройден — сезон может закончиться в любой момент' : 'Сезон завершён'}
          </span>
        </div>
      ) : (
        <div className="flex items-stretch justify-center gap-2 rounded-lg border border-lines-hover bg-(--color-base) px-4 py-3">
          {UNITS.map((u, i) => (
            <div key={u.key} className="flex items-stretch gap-2">
              <div className="flex min-w-11 flex-col items-center gap-0.5">
                <span
                  className="font-blender-medium text-2xl leading-none tabular-nums"
                  style={{ color: accent }}
                >
                  {t == null ? '—' : u.key === 'd' ? t.d : pad(t[u.key])}
                </span>
                <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-muted">
                  {u.label}
                </span>
              </div>
              {i < UNITS.length - 1 && (
                <span className="self-start font-blender-medium text-2xl leading-none text-text-muted" aria-hidden>
                  :
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
