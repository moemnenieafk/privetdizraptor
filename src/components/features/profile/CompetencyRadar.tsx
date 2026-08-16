import type { RoleAxes } from '@/lib/role-inference';

// Радар компетенций — SVG-полигон по 4 осям RoleAxes (§3.1, п.2). НЕ Canvas (§6/anti).
// Каждая ось биполярна (−1..+1): радиус спицы = (value+1)/2, поэтому нейтраль (всё 0) даёт
// ровный «seed»-полигон посередине — это и есть пустое состояние (§4.5): подпись «собираем
// профиль», без обмана «нулём». Геометрия считается вне JSX (§4.7).

interface CompetencyRadarProps {
  axes: RoleAxes;
  /** Пиксельный размер квадрата SVG. */
  size?: number;
  /** Акцент полигона — токен var(--color-…). */
  accent?: string;
  className?: string;
}

// 4 спицы. label — имя «+1»-полюса (то, к чему тянется значение).
const SPOKES: { key: keyof RoleAxes; label: string }[] = [
  { key: 'cautionAggression', label: 'АГР' }, // агрессия
  { key: 'economyCombat', label: 'БОЙ' }, // боевой
  { key: 'sprintCollect', label: 'ЛУТ' }, // коллекционер
  { key: 'soloClan', label: 'ОТРЯД' }, // сокланы
];

interface Pt {
  x: number;
  y: number;
}

/** Точка на луче i (из 4) при радиусе r (0..1) в координатах вокруг центра c. */
function pointAt(i: number, r: number, c: number, maxR: number): Pt {
  // Старт сверху (−90°), по часовой.
  const angle = -Math.PI / 2 + (i / SPOKES.length) * Math.PI * 2;
  return { x: c + Math.cos(angle) * r * maxR, y: c + Math.sin(angle) * r * maxR };
}

function toPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';
}

export function CompetencyRadar({
  axes,
  size = 200,
  accent = 'var(--primary)',
  className = '',
}: CompetencyRadarProps) {
  const c = size / 2;
  const maxR = c - 22; // поля под подписи спиц
  const rings = [0.33, 0.66, 1];

  // Радиус каждой спицы из биполярного значения.
  const spokeR = SPOKES.map((s) => (clamp(axes[s.key], -1, 1) + 1) / 2);
  const dataPts = spokeR.map((r, i) => pointAt(i, r, c, maxR));

  // «Пусто», если все оси ~ нейтральны (полигон вырождается в ровный seed).
  const isSeed = SPOKES.every((s) => Math.abs(axes[s.key]) < 0.06);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Радар компетенций">
        {/* Кольца-сетка */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={SPOKES.map((_, i) => {
              const p = pointAt(i, r, c, maxR);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            }).join(' ')}
            fill="none"
            stroke="var(--color-lines-hover)"
            strokeWidth={1}
          />
        ))}
        {/* Спицы */}
        {SPOKES.map((_, i) => {
          const p = pointAt(i, 1, c, maxR);
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
        {SPOKES.map((s, i) => {
          const p = pointAt(i, 1.16, c, maxR);
          return (
            <text
              key={s.key}
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

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
