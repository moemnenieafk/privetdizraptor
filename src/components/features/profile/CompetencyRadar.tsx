import type { RoleAxes } from '@/lib/role-inference';

// Радар компетенций — SVG-полигон (§3.1, п.2). НЕ Canvas (§6/anti). Геометрия — вне JSX (§4.7).
//
// Два режима:
//  • Классический (по умолчанию): 4 биполярные оси RoleAxes (−1..+1), радиус спицы = (v+1)/2.
//    Нейтраль (всё 0) даёт ровный «seed»-полигон посередине — пустое состояние (§4.5).
//  • Явный (проп `spokes`): произвольное число осей с УЖЕ нормализованными значениями 0..1
//    и своими подписями. Досье (Figma) даёт 5 осей — БОЙ/АГРЕССИЯ/ДОБЫЧА/ВЫЖИВАНИЕ/ОТРЯД.
//  Оба режима считают геометрию одним и тем же движком — форк не нужен, только вход другой.

/** Одна ось явного режима: подпись + нормализованное значение 0..1. */
export interface RadarSpoke {
  label: string;
  /** 0..1 — доля радиуса (уже нормализовано вызывающим). */
  value: number;
}

interface CompetencyRadarProps {
  /** Классический режим: 4 биполярные оси RoleAxes. Игнорируется, если задан `spokes`. */
  axes?: RoleAxes;
  /** Явный режим: N осей с нормализованными значениями 0..1 (напр. 5-осевой радар досье). */
  spokes?: RadarSpoke[];
  /** Пиксельный размер квадрата SVG. */
  size?: number;
  /** Акцент полигона — токен var(--color-…). */
  accent?: string;
  className?: string;
}

// Классические 4 спицы. label — имя «+1»-полюса (то, к чему тянется значение).
const AXIS_SPOKES: { key: keyof RoleAxes; label: string }[] = [
  { key: 'cautionAggression', label: 'АГР' }, // агрессия
  { key: 'economyCombat', label: 'БОЙ' }, // боевой
  { key: 'sprintCollect', label: 'ЛУТ' }, // коллекционер
  { key: 'soloClan', label: 'ОТРЯД' }, // сокланы
];

interface Pt {
  x: number;
  y: number;
}

/** Точка на луче i (из n) при радиусе r (0..1) в координатах вокруг центра c. */
function pointAt(i: number, n: number, r: number, c: number, maxR: number): Pt {
  // Старт сверху (−90°), по часовой.
  const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { x: c + Math.cos(angle) * r * maxR, y: c + Math.sin(angle) * r * maxR };
}

function toPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function CompetencyRadar({
  axes,
  spokes,
  size = 200,
  accent = 'var(--primary)',
  className = '',
}: CompetencyRadarProps) {
  const c = size / 2;
  const maxR = c - 28; // поля под подписи спиц (5 осей длиннее — «ВЫЖИВАНИЕ»)
  const rings = [0.33, 0.66, 1];

  // Нормализуем оба режима к общему списку {label, r(0..1)}.
  const resolved: { label: string; r: number }[] = spokes
    ? spokes.map((s) => ({ label: s.label, r: clamp(s.value, 0, 1) }))
    : AXIS_SPOKES.map((s) => ({ label: s.label, r: (clamp(axes?.[s.key] ?? 0, -1, 1) + 1) / 2 }));

  const n = resolved.length;
  const dataPts = resolved.map((s, i) => pointAt(i, n, s.r, c, maxR));

  // «Пусто», если все спицы близки к нейтрали (классика: 0 → r≈0.5; явный: value≈0 → r≈0).
  const isSeed = spokes
    ? spokes.every((s) => clamp(s.value, 0, 1) < 0.04)
    : AXIS_SPOKES.every((s) => Math.abs(axes?.[s.key] ?? 0) < 0.06);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {/* Рендер-размер в rem (viewBox — фикс user-units): SVG масштабируется с root
          на 2K/4K вместе со всей раскладкой Досье; внутренняя геометрия и подписи тянутся
          за viewBox. Раньше width/height={size} = сырой px → радар застывал на 4K. */}
      <svg width={`${size / 16}rem`} height={`${size / 16}rem`} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Радар эффективности">
        {/* Кольца-сетка */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={resolved.map((_, i) => {
              const p = pointAt(i, n, r, c, maxR);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(' ')}
            fill="none"
            stroke="var(--color-lines-hover)"
            strokeWidth={1}
          />
        ))}
        {/* Спицы */}
        {resolved.map((_, i) => {
          const p = pointAt(i, n, 1, c, maxR);
          return (
            <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="var(--color-lines-hover)" strokeWidth={1} />
          );
        })}
        {/* Полигон данных */}
        <path
          d={toPath(dataPts)}
          fill={`color-mix(in srgb, ${accent} ${isSeed ? 10 : 24}%, transparent)`}
          stroke={accent}
          strokeWidth={isSeed ? 1 : 1.5}
          strokeOpacity={isSeed ? 0.5 : 1}
          strokeLinejoin="round"
        />
        {/* Узлы-вершины (скрыты в seed) */}
        {!isSeed &&
          dataPts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={accent} />
          ))}
        {/* Подписи спиц */}
        {resolved.map((s, i) => {
          const p = pointAt(i, n, 1.18, c, maxR);
          return (
            <text
              key={`${s.label}-${i}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="font-blender-medium uppercase"
              style={{ fontSize: 9, letterSpacing: '0.1em', fill: 'var(--color-text-muted)' }}
            >
              {s.label}
            </text>
          );
        })}
      </svg>
      {isSeed && (
        <span className="text-type-micro font-blender-book text-text-muted">собираем профиль…</span>
      )}
    </div>
  );
}
