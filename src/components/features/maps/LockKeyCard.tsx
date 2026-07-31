'use client';

// Read-only карточка-поповер «Замок→Ключ»: клик по замку → какой ключ открывает + контекст.
// Данные целиком из маркера (meta.key/lockType/needsPower, linkedItemId, keyPrice) — см. решение lock-key-mapping.
import { X, Zap, ExternalLink, DoorOpen, Lock } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { formatCurrencyDisplay } from '@/lib/formatters';
import type { MapViewMarker } from './map-types';

const LOCK_TYPE_RU: Record<string, string> = {
  door: 'Дверь',
  'inner-door': 'Дверь',
  'door-breach': 'Дверь',
  container: 'Контейнер',
  trunk: 'Багажник',
};

interface LockMeta {
  lockType?: string | null;
  needsPower?: boolean | null;
  key?: { id: string; name: string; normalizedName: string } | null;
}

function doorWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'дверь';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'двери';
  return 'дверей';
}

interface Props {
  marker: MapViewMarker;
  /** сколько ещё замков на этой карте открывает тот же ключ. */
  sameKeyCount: number;
  onHighlightSiblings: () => void;
  onClose: () => void;
}

export function LockKeyCard({ marker, sameKeyCount, onHighlightSiblings, onClose }: Props) {
  const meta = (marker.meta ?? null) as LockMeta | null;
  const key = meta?.key ?? null;
  const keyId = marker.linkedItemId ?? key?.id ?? null;
  const keyName = key?.name ?? marker.label ?? null;
  const keySlug = key?.normalizedName ?? null;
  const lockRu = meta?.lockType ? (LOCK_TYPE_RU[meta.lockType] ?? meta.lockType) : null;
  const needsPower = meta?.needsPower === true;
  const price = marker.keyPrice ?? null;
  const hasKey = !!keyId && !!keyName;

  return (
    <div className="flex w-72 flex-col gap-2.5 rounded-sm border border-lines-hover bg-card-menu p-3 shadow-lg backdrop-blur-md">
      {/* Шапка: иконка ключа + имя + закрыть */}
      <div className="flex items-start gap-2.5">
        {hasKey && keyId ? (
          // Игровая ячейка инвентаря: рарностный tint + внутренняя тень + иконка сверху (как EftItemTile).
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xs border border-lines-hover">
            <div className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(marker.itemBg ?? undefined) }} />
            <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]" />
            <img src={itemIconUrl(keyId)} alt={keyName ?? ''} className="absolute inset-0 z-10 h-full w-full object-contain p-1 drop-shadow-lg" />
          </div>
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xs border border-lines-hover bg-(--color-base) text-text-muted">
            <Lock className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">{hasKey ? 'Ключ' : 'Замок'}</div>
          <div className="font-blender-book text-sm leading-snug text-text-primary">{keyName ?? 'Открывается без ключа'}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Чипы: тип замка · ток */}
      {(lockRu || needsPower) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {lockRu && (
            <span className="rounded-xs border-[0.5px] border-lines-hover px-1.5 py-0.5 text-type-micro font-blender-medium uppercase tracking-wide text-text-secondary">
              {lockRu}
            </span>
          )}
          {needsPower && (
            <span className="flex items-center gap-1 rounded-xs border-[0.5px] border-tactical-amber/40 px-1.5 py-0.5 text-type-micro font-blender-medium uppercase tracking-wide text-tactical-amber">
              <Zap className="h-3 w-3" /> Нужен ток
            </span>
          )}
        </div>
      )}

      {/* Цена ключа */}
      {hasKey && price != null && (
        <div className="flex items-center justify-between">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Цена ключа</span>
          <span className="font-blender-medium text-xs tabular-nums text-tactical-amber">{formatCurrencyDisplay(price)}</span>
        </div>
      )}

      {/* «Открывает ещё N дверей» — клик подсвечивает соседей */}
      {sameKeyCount > 0 && (
        <button
          type="button"
          onClick={onHighlightSiblings}
          className="flex items-center justify-center gap-1.5 rounded-xs border-[0.5px] border-lines-hover py-1.5 text-type-micro font-blender-medium uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          <DoorOpen className="h-3.5 w-3.5" /> Открывает ещё {sameKeyCount} {doorWord(sameKeyCount)} здесь
        </button>
      )}

      {/* Открыть страницу ключа */}
      {hasKey && keySlug && (
        <a
          href={`/eft/items/item/${keySlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xs bg-(--primary) py-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Открыть ключ
        </a>
      )}
    </div>
  );
}
