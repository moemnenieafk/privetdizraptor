'use client';

// Панель модерации меченой комнаты (admin|editor): очередь pending-открытий → Принять / Отклонить.
// ✎ раскрывает RoomItemPicker (преднаполнен тем, что заявил подавший) — модератор правит список
// найденных предметов перед approve. PATCH /api/admin/room-opens. Принять → approved + репутация
// автору (+ при правке — замена набора предметов). Решение: docs/decisions/done/marked-rooms.md (v2.1).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ExternalLink, Pencil } from 'lucide-react';
import { itemIconUrl } from '@/lib/item-icon';
import { RoomItemPicker, type PickerItem } from './RoomItemPicker';

interface PendingItem {
  itemId: string;
  name: string;
  shortName: string;
}
interface Pending {
  id: string;
  proofYoutubeUrl: string | null;
  gameVersion: string | null;
  items: PendingItem[];
}
interface Props {
  pending: Pending[];
  mapSlug: string;
  roomSlug: string;
  /** Лут-таблица комнаты — быстрые чипы в пикере правки. */
  lootItems: PickerItem[];
}

const toPickerItems = (items: PendingItem[]): PickerItem[] =>
  items.map((it) => ({ itemId: it.itemId, name: it.name, shortName: it.shortName, backgroundColor: null }));

export function RoomOpenModeration({ pending, mapSlug, roomSlug, lootItems }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // openId с открытым пикером правки
  const [edits, setEdits] = useState<Record<string, string[]>>({}); // openId → правленый список id

  const act = async (openId: string, action: 'approve' | 'reject') => {
    setBusy(openId);
    try {
      const override = action === 'approve' ? edits[openId] : undefined; // undefined — набор не трогаем
      const res = await fetch('/api/admin/room-opens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openId, action, mapSlug, roomSlug, ...(override ? { itemIds: override } : {}) }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded border p-4" style={{ borderColor: 'color-mix(in srgb, var(--color-moderate) 40%, transparent)' }}>
      <div className="mb-3 font-blender-medium text-xs uppercase tracking-widest text-moderate">На модерации · {pending.length}</div>
      <div className="flex flex-col gap-2">
        {pending.map((o) => {
          const isEditing = editing === o.id;
          return (
            <div key={o.id} className="flex flex-col gap-2 rounded-xs border border-lines-hover p-2.5">
              <div className="flex flex-wrap items-center gap-3">
                {isEditing ? (
                  <div className="min-w-0 flex-1">
                    <RoomItemPicker lootItems={lootItems} initial={toPickerItems(o.items)} onChange={(ids) => setEdits((e) => ({ ...e, [o.id]: ids }))} />
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {o.items.map((it) => (
                      <span key={it.itemId} title={it.name} className="flex items-center gap-1 rounded-xs border border-lines-hover px-1.5 py-0.5">
                        <img src={itemIconUrl(it.itemId)} alt="" className="h-4 w-4 shrink-0 object-contain" />
                        <span className="text-xs text-text-secondary">{it.shortName || it.name}</span>
                      </span>
                    ))}
                    {edits[o.id] && <span className="text-[0.625rem] text-moderate">правлено: {edits[o.id].length}</span>}
                    {o.gameVersion && <span className="text-[0.625rem] text-text-muted">v{o.gameVersion}</span>}
                  </div>
                )}
                {o.proofYoutubeUrl && (
                  <a href={o.proofYoutubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-(--primary) hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> пруф
                  </a>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing(isEditing ? null : o.id)}
                    aria-label={isEditing ? 'Свернуть правку' : 'Править список предметов'}
                    aria-pressed={isEditing}
                    className={`flex h-8 w-8 items-center justify-center rounded-xs border transition-colors ${
                      isEditing ? 'border-(--primary) text-(--primary)' : 'border-lines-hover text-text-muted hover:text-(--primary)'
                    }`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy === o.id}
                    onClick={() => act(o.id, 'approve')}
                    aria-label="Принять"
                    className="flex h-8 w-8 items-center justify-center rounded-xs border text-nvg-green transition-colors disabled:opacity-40"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-nvg-green) 50%, transparent)' }}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy === o.id}
                    onClick={() => act(o.id, 'reject')}
                    aria-label="Отклонить"
                    className="flex h-8 w-8 items-center justify-center rounded-xs border text-danger transition-colors disabled:opacity-40"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-danger) 50%, transparent)' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
