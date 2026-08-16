// Жетон-dog-tag: SVG-силуэт армейского жетона + ник + сервис-№ (штрих-код repeating-
// linear-gradient, tabular-nums). Мотив из §3.2. Пустое состояние (нет ника) → placeholder
// «ОПЕРАТИВНИК» + прочерк-№, зовущий добавить профиль. Чистый презентационный компонент.

interface DogTagProps {
  /** Ник оперативника. Пусто/undefined → placeholder. */
  nickname?: string | null;
  /** Сервис-номер (стабильный, из id профиля). Пусто → прочерк. */
  serviceNo?: string | null;
  /** Фракция — подпись на жетоне. */
  faction?: 'USEC' | 'BEAR' | null;
  className?: string;
}

/** Стабильный сервис-№ из строки id (детерминированный, без random). */
export function serviceNumberFrom(id: string | null | undefined): string {
  if (!id) return '';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % 1_000_000).padStart(6, '0');
}

export function DogTag({ nickname, serviceNo, faction, className = '' }: DogTagProps) {
  const name = nickname?.trim() || 'ОПЕРАТИВНИК';
  const isPlaceholder = !nickname?.trim();
  const num = serviceNo?.trim() || '— — — — — —';

  return (
    <div
      className={`relative flex items-center gap-3 bg-(--color-base) px-4 py-3 ${className}`}
      style={{
        // Силуэт жетона: срезанный левый-верхний угол + отверстие-паз слева.
        clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)',
        border: '1px solid var(--color-lines-hover)',
      }}
    >
      {/* Паз-отверстие жетона */}
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full border"
        style={{ borderColor: 'var(--color-text-muted)' }}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={`truncate text-sm font-blender-medium uppercase tracking-widest ${
            isPlaceholder ? 'text-text-muted' : 'text-text-primary'
          }`}
        >
          {name}
        </span>
        <div className="flex items-center gap-2">
          {/* Штрих-код */}
          <span
            aria-hidden
            className="h-3 w-16 shrink-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(90deg, var(--color-text-muted) 0, var(--color-text-muted) 1px, transparent 1px, transparent 3px)',
            }}
          />
          <span className="text-type-micro font-blender-medium tabular-nums tracking-widest text-text-secondary">
            №{num}
          </span>
        </div>
      </div>

      {faction && (
        <span className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
          {faction}
        </span>
      )}
    </div>
  );
}
