'use client';

// Read-only карточка требований выхода: клик по выходу → подвид, фракция, предмет-пропуск (+ссылка),
// рубильник, спец-условие (сигнал/без рюкзака). Данные из маркера (см. решение — паттерн Замок→Ключ).
import { X, ExternalLink, ToggleRight, Flame, Backpack } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';
import { extractSubtype, markerIconUrl } from '@/data/map-marker-icons';
import type { MapViewMarker } from './map-types';

const SUBTYPE_RU: Record<string, string> = {
  greenflare: 'Зелёный сигнал',
  codeword: 'Кодовое слово',
  paidcar: 'Платный (машина)',
  paidhely: 'Платный (вертолёт)',
  redrebel: 'Тропа альпиниста',
  nobackpack: 'Без рюкзака',
  pmc: 'Только ЧВК',
  scav: 'Только Дикий',
  shared: 'Общий',
};
const FACTION_RU: Record<string, string> = { pmc: 'ЧВК', scav: 'Дикий', all: 'Общий', shared: 'Общий' };

interface ExtractMeta {
  switches?: { id: string; name: string | null }[] | null;
  transferItem?: { id: string; name: string; count: number } | null;
}

export function ExtractCard({ marker, onClose }: { marker: MapViewMarker; onClose: () => void }) {
  const meta = (marker.meta ?? null) as ExtractMeta | null;
  const subtype = extractSubtype({
    type: marker.type,
    category: marker.category,
    faction: marker.faction,
    label: marker.label,
    transferItemName: marker.transferItemName,
  });
  const subRu = SUBTYPE_RU[subtype] ?? subtype;
  const facRu = marker.faction ? (FACTION_RU[marker.faction.toLowerCase()] ?? marker.faction) : 'Общий';
  const ti = meta?.transferItem ?? null;
  const tiId = marker.linkedItemId ?? ti?.id ?? null;
  const tiName = ti?.name ?? marker.transferItemName ?? null;
  const tiCount = ti?.count ?? null;
  const tiSlug = marker.itemSlug ?? null;
  const switches = meta?.switches ?? [];
  const icon = markerIconUrl(marker);

  return (
    <div className="flex w-72 flex-col gap-2.5 rounded-lg border border-lines-hover bg-card-menu p-3 shadow-lg backdrop-blur-md">
      {/* Шапка: иконка выхода + имя + закрыть */}
      <div className="flex items-start gap-2.5">
        {icon && <img src={icon.url} alt="" className="h-9 w-9 shrink-0 object-contain drop-shadow" />}
        <div className="min-w-0 flex-1">
          <div className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Выход</div>
          <div className="font-blender-book text-sm leading-snug text-text-primary">{marker.label ?? 'Выход'}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="shrink-0 text-text-muted transition-colors hover:text-(--primary)">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Чипы: фракция · подвид */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-xs border-[0.5px] border-lines-hover px-1.5 py-0.5 text-type-micro font-blender-medium uppercase tracking-wide text-text-secondary">{facRu}</span>
        <span className="rounded-xs border-[0.5px] border-(--primary)/40 px-1.5 py-0.5 text-type-micro font-blender-medium uppercase tracking-wide text-(--primary)">{subRu}</span>
      </div>

      {/* Требуется рубильник */}
      {switches.length > 0 && (
        <div className="flex items-start gap-1.5 text-text-secondary">
          <ToggleRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tactical-amber" />
          <span className="font-blender-book text-xs leading-snug">
            Сначала активируй рубильник{switches.some((s) => s.name) ? `: ${switches.map((s) => s.name).filter(Boolean).join(', ')}` : ''}
          </span>
        </div>
      )}

      {/* Спец-условие без предмета */}
      {!ti && subtype === 'greenflare' && (
        <div className="flex items-start gap-1.5 text-text-secondary">
          <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tactical-amber" />
          <span className="font-blender-book text-xs leading-snug">Активация зелёным сигнальным патроном (РСП-30 / 26×75).</span>
        </div>
      )}
      {!ti && subtype === 'nobackpack' && (
        <div className="flex items-start gap-1.5 text-text-secondary">
          <Backpack className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tactical-amber" />
          <span className="font-blender-book text-xs leading-snug">Пройти можно только без рюкзака.</span>
        </div>
      )}

      {/* Предмет-пропуск (ячейка + N× имя + ссылка). Покрывает платный (валюта), кодовое слово, Red Rebel. */}
      {ti && tiName && (
        <div className="flex flex-col gap-2 rounded border-[0.5px] border-lines-hover p-2">
          <span className="text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">Требуется</span>
          <div className="flex items-center gap-2.5">
            {tiId && (
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded border border-lines-hover">
                <div className="absolute inset-0 bg-(--color-darkbase)" />
                <div className="absolute inset-0" style={{ backgroundColor: getTarkovBackgroundColor(marker.itemBg ?? undefined) }} />
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
                <img src={itemIconUrl(tiId)} alt={tiName} className="absolute inset-0 z-10 h-full w-full object-contain p-1 drop-shadow-lg" />
              </div>
            )}
            <span className="min-w-0 flex-1 font-blender-book text-sm leading-snug text-text-primary">
              {tiCount && tiCount > 1 ? `${tiCount.toLocaleString('ru-RU')}× ` : ''}
              {tiName}
            </span>
          </div>
          {tiSlug && (
            <a
              href={`/eft/items/item/${tiSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xs bg-(--primary) py-1.5 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Открыть предмет
            </a>
          )}
        </div>
      )}
    </div>
  );
}
