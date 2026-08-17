import {
  XP_VISIT,
  XP_DISCOVERY,
  XP_FLOW,
  ARCHETYPE_MULTIPLIER,
  SUBTRACK_THRESHOLDS,
} from '@/lib/xp';

// Инструкция «как качать архетип» — нижний блок правой панели Досье. Числа берём из XP-экономики
// (@/lib/xp, §4.7): правишь константы прокачки — текст инструкции обновляется сам, без рассинхрона.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Завершённые флоу с человекочитаемыми подписями (значения — из XP_FLOW). */
const FLOWS: ReadonlyArray<{ label: string; key: keyof typeof XP_FLOW }> = [
  { label: 'Загрузка профиля', key: 'profile-load' },
  { label: 'Сборка оружия / Gunsmith', key: 'loadout' },
  { label: 'Добавление в трекер', key: 'tracker' },
  { label: 'Шаг «Пути Новобранца»', key: 'tutorial-step' },
];

/** Строка «действие → XP»: подпись слева, значение справа акцентом. */
function XpRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 flex-1 text-type-caption font-blender-book leading-4 text-text-secondary">
        {label}
      </span>
      <span className="shrink-0 text-type-caption font-blender-medium tabular-nums tracking-wider text-(--primary)">
        {value}
      </span>
    </div>
  );
}

export interface ArchetypeLevelGuideProps {
  /** Имя активного архетипа (для персонализации вступления). */
  roleName: string;
  /** Текущий уровень под-трека 1..N. */
  level: number;
  /** Акцент архетипа (var(--color-…)) — подсветка достигнутых уровней. */
  accent: string;
}

export function ArchetypeLevelGuide({ roleName, level, accent }: ArchetypeLevelGuideProps) {
  const maxLevel = SUBTRACK_THRESHOLDS.length;

  return (
    <div>
      {/* Микро-заголовок с линией (§ rule-micro-labels) */}
      <div className="mb-3 flex items-center gap-3">
        <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          Как качать архетип
        </span>
        <div className="h-px flex-1 bg-lines-hover" />
      </div>

      <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
        Кольцо вокруг иконки — уровень архетипа{' '}
        <span className="font-blender-medium uppercase" style={{ color: accent }}>
          {roleName}
        </span>{' '}
        (сейчас {ROMAN[level - 1] ?? level} из {ROMAN[maxLevel - 1]}). Он растёт не от загрузки статы, а
        от того, чем ты реально пользуешься на портале — заходишь в разделы и доводишь действия до конца.
      </p>

      {/* Откуда берётся XP */}
      <div className="mt-4 flex flex-col gap-2 border-t border-lines-hover pt-4">
        <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
          Откуда XP
        </p>
        <div className="flex flex-col gap-1.5">
          <XpRow label="Заход в любой раздел портала" value={`+${XP_VISIT}`} />
          <XpRow label="Первое открытие новой фичи (разово)" value={`+${XP_DISCOVERY}`} />
          {FLOWS.map((f) => (
            <XpRow key={f.key} label={f.label} value={`+${XP_FLOW[f.key]}`} />
          ))}
        </div>
      </div>

      {/* Правило ×2 за «свои» разделы */}
      <div className="mt-4 rounded-md border border-tactical-amber/30 bg-tactical-amber/5 p-3">
        <p className="text-type-caption font-blender-book leading-4 text-text-secondary">
          <span className="font-blender-medium text-tactical-amber">×{ARCHETYPE_MULTIPLIER}</span> к
          под-треку дают фичи твоего архетипа — те, что подсвечены{' '}
          <span className="text-tactical-amber">амбером</span> в «Избранных разделах» выше. Прокачка
          идёт быстрее, когда качаешь «свои» разделы, а не всё подряд.
        </p>
      </div>

      {/* Лестница уровней и пороги */}
      <div className="mt-4 flex flex-col gap-2">
        <p className="text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary">
          Уровни · нужно XP
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUBTRACK_THRESHOLDS.map((threshold, i) => {
            const reached = i + 1 <= level;
            return (
              <span
                key={threshold}
                className="inline-flex items-center gap-1.5 rounded-xs border border-lines-hover px-2 py-1 text-type-micro font-blender-medium tabular-nums tracking-widest"
                style={
                  reached
                    ? { color: accent, borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }
                    : undefined
                }
              >
                <span className={reached ? '' : 'text-text-muted'}>{ROMAN[i]}</span>
                <span className={reached ? 'opacity-80' : 'text-text-muted'}>{threshold}</span>
              </span>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-type-micro font-blender-book leading-4 text-text-muted">
        У каждого архетипа свой отдельный под-трек. Сменишь архетип (иконка выбора вверху панели) —
        качаешь другой с нуля, прежний прогресс сохраняется.
      </p>
    </div>
  );
}
