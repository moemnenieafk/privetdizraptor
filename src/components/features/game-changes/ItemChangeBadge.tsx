import Link from 'next/link';
import { ArrowUp, ArrowDown, ArrowRight, Activity } from 'lucide-react';
import { fieldLabel, verdict } from '@/lib/game-changes-format';
import type { ItemChangeEntry } from '@/db/game-changes';

// In-context плашка: недавние изменения этого предмета (статы/офферы/крафты)
// прямо на его странице. Тянет к полному ченджлогу. Пусто → не рендерится.
export function ItemChangeBadge({ changes }: { changes: ItemChangeEntry[] }) {
  if (changes.length === 0) return null;

  return (
    <div className="mb-4 rounded-sm border border-(--primary)/30 bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Недавно изменено
        </span>
        <Link
          href="/eft/comlink/game-updates"
          className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:text-(--primary)"
        >
          Все обновления →
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        {changes.map((c, i) => {
          const scopePrefix = c.category === 'trader' || c.category === 'craft' ? `${c.scope} · ` : '';

          if (c.kind === 'added') {
            const label =
              c.category === 'trader' ? `${c.scope} — новый оффер` : c.category === 'craft' ? `${c.scope} — новый крафт` : 'Добавлен';
            return (
              <span key={i} className="font-blender-medium text-xs uppercase tracking-widest text-nvg-green">
                {label}
              </span>
            );
          }
          if (c.kind === 'removed') {
            return (
              <span key={i} className="font-blender-medium text-xs uppercase tracking-widest text-danger">
                {scopePrefix}убран
              </span>
            );
          }

          const v = verdict(c.field, c.oldValue, c.newValue);
          const tone = v === 'buff' ? 'text-nvg-green' : v === 'nerf' ? 'text-danger' : 'text-(--primary)';
          const Icon = v === 'buff' ? ArrowUp : v === 'nerf' ? ArrowDown : ArrowRight;
          return (
            <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
                {scopePrefix}
                {fieldLabel(c.field)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-blender-medium text-xs text-text-secondary">{c.oldValue ?? '—'}</span>
                <Icon className={`h-3 w-3 ${tone}`} aria-hidden="true" />
                <span className={`font-blender-medium text-xs ${tone}`}>{c.newValue ?? '—'}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
