// Статус-LED оперативника: пульсирующая точка + подпись (ONLINE / В РЕЙДЕ / PVE / PVP).
// Пульс — существующий animate-pulse (§3.3), цвет — токен по статусу. Чистый CSS-атом.

export type OperatorStatus = 'online' | 'raid' | 'pve' | 'pvp' | 'offline';

interface StatusLedProps {
  status: OperatorStatus;
  className?: string;
}

const STATUS_META: Record<OperatorStatus, { label: string; color: string; pulse: boolean }> = {
  online: { label: 'НА СВЯЗИ', color: 'var(--color-online)', pulse: true },
  raid: { label: 'В РЕЙДЕ', color: 'var(--color-danger)', pulse: true },
  pve: { label: 'PVE', color: 'var(--color-mode-pve)', pulse: false },
  pvp: { label: 'PVP', color: 'var(--color-mode-pvp)', pulse: false },
  offline: { label: 'ОФЛАЙН', color: 'var(--color-text-muted)', pulse: false },
};

export function StatusLed({ status, className = '' }: StatusLedProps) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-block size-2 rounded-full ${meta.pulse ? 'animate-pulse' : ''}`}
        style={{
          backgroundColor: meta.color,
          boxShadow: `0 0 6px color-mix(in srgb, ${meta.color} 60%, transparent)`,
        }}
      />
      <span
        className="text-type-micro font-blender-medium uppercase tracking-widest"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
    </span>
  );
}
