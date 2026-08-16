import type { EditionType } from '@/components/layout/header-modules/ProfileSettingsModal';

/**
 * Карточка-жетон (dog-tag) идентичности игрока — 1:1 по Figma «DogTag-Like Profile» (288×160).
 * Чистый презентационный индикатор (§4.7): вся логика — в консюмере, тут только отображение.
 * Ни onClick, ни инпутов, ни кнопок. Нет данных → «—»/скрыть (§4.5), не падаем.
 *
 * Раскладка: подложка-жетон с вырезом-отверстием на левой кромке, три ряда —
 * [бейдж режима · эмблема фракции] → [edition-эмблема · ник] → [уровень · престиж].
 */

/**
 * Стиль издания — зеркалит EDITIONS из ProfileSettingsModal: эмблема (icon-mask),
 * цвет ника (text-) и тинт эмблемы (bg-) красятся цветом издания (§6, токен --color-edition-*).
 * Ник и эмблема НАПРЯМУЮ зависят от издания, выбранного в модалке настроек профиля.
 */
const EDITION_STYLE: Record<EditionType, { icon: string; text: string; fill: string }> = {
  TUE: { icon: 'icon-eft-profile-tue', text: 'text-edition-tue', fill: 'bg-edition-tue' },
  EOD: { icon: 'icon-eft-profile-eod', text: 'text-edition-eod', fill: 'bg-edition-eod' },
  PFE: { icon: 'icon-eft-profile-pfe', text: 'text-edition-pfe', fill: 'bg-edition-pfe' },
  LB: { icon: 'icon-eft-profile-lb', text: 'text-edition-lb', fill: 'bg-edition-lb' },
  Standard: { icon: 'icon-eft-profile-s', text: 'text-edition-std', fill: 'bg-edition-std' },
};

/** Группа иконки уровня: <5 → 1, дальше по пятёркам с потолком 16 (как getLevelGroup в ProfileStats). */
const levelGroup = (level: number) => (level < 5 ? 1 : Math.min(16, Math.floor(level / 5) + 1));

export interface DogTagProfileCardProps {
  nickname: string | null;
  faction: 'BEAR' | 'USEC' | null;
  edition: EditionType;
  level: number | null;
  prestige: number;
  pve: boolean;
}

export function DogTagProfileCard({ nickname, faction, edition, level, prestige, pve }: DogTagProfileCardProps) {
  const modeColor = pve ? 'var(--color-mode-pve)' : 'var(--color-mode-pvp)';
  const group = level == null || Number.isNaN(level) ? 1 : levelGroup(level);
  const ed = EDITION_STYLE[edition];

  return (
    <div className="relative flex h-40 w-72 flex-col justify-between rounded-2xl border border-lines-hover bg-card-menu py-4 pr-5 pl-10">
      {/* Вырез-отверстие жетона на левой кромке (читается как дырка) */}
      <span
        aria-hidden
        className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full border border-lines-hover bg-(--color-darkbase) shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]"
      />

      {/* Верхний ряд: бейдж режима · эмблема фракции */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 rounded-xs border px-2 py-1 text-type-micro font-blender-medium uppercase tracking-widest"
          style={{
            color: modeColor,
            background: `color-mix(in srgb, ${modeColor} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${modeColor} 40%, transparent)`,
          }}
        >
          <span
            aria-hidden
            className="icon-mask size-3.5"
            style={{
              backgroundColor: modeColor,
              WebkitMaskImage: `url(/icons/eft/04-progression/seasons/${pve ? 'pve' : 'pvp'}-mode-icon.svg)`,
              maskImage: `url(/icons/eft/04-progression/seasons/${pve ? 'pve' : 'pvp'}-mode-icon.svg)`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
          {pve ? 'PvE-режим' : 'PvP-режим'}
        </span>
        {faction && (
          <img
            src={`/icons/eft/${faction}-faction-icon.svg`}
            alt={faction}
            className="size-7 object-contain"
          />
        )}
      </div>

      {/* Строка ника: edition-эмблема · ник (recessed-панель) */}
      <div className="flex h-9 items-center gap-3 rounded-md bg-(--color-base) px-3">
        <span className={`icon-mask ${ed.icon} size-7 shrink-0 ${ed.fill}`} aria-hidden />
        <span className={`truncate text-xl font-blender-medium tracking-wide ${ed.text}`}>
          {nickname ?? '—'}
        </span>
      </div>

      {/* Нижний ряд: уровень · престиж */}
      <div className="flex gap-3">
        <div className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-(--color-base) px-3">
          <img
            src={`/icons/eft/lvl-icons/player-level-group-${group}.webp`}
            alt={level == null || Number.isNaN(level) ? 'Уровень' : `Уровень ${level}`}
            className="size-7 object-contain"
          />
          <span className="text-xl font-blender-medium tabular-nums text-text-primary">
            {level == null || Number.isNaN(level) ? '—' : level}
          </span>
        </div>
        <div className="flex h-9 flex-1 items-center gap-2 rounded-md bg-(--color-base) px-3">
          {prestige > 0 ? (
            <img
              src={`/icons/eft/prestige/prestige-${prestige}.webp`}
              alt={`Престиж ${prestige}`}
              className="size-7 object-contain"
            />
          ) : (
            <span className="icon-mask icon-eft-prog-prestige size-4 bg-lines-hover" aria-hidden />
          )}
          <span className="text-sm font-blender-medium uppercase tracking-widest text-text-secondary">
            Престиж {prestige > 0 ? prestige : 0}
          </span>
        </div>
      </div>
    </div>
  );
}
