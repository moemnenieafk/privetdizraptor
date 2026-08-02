'use client';

// Инструмент модератора: добавить подтверждённое открытие меченой комнаты.
// Чипы — предметы из лут-таблицы комнаты (частый случай); выбор → POST /api/admin/room-opens.
// Рендерится только для admin|editor (страница проверяет canEditContent). Решение: docs/decisions/marked-rooms.md.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { itemIconUrl } from '@/lib/item-icon';
import { getTarkovBackgroundColor } from '@/lib/tarkov-colors';

interface LootItem {
  itemId: string;
  name: string;
  shortName: string;
  backgroundColor: string | null;
}
interface Props {
  roomId: string;
  mapSlug: string;
  roomSlug: string;
  lootItems: LootItem[];
}

export function RoomOpenAdder({ roomId, mapSlug, roomSlug, lootItems }: Props) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async () => {
    if (sel.size === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/room-opens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, itemIds: [...sel], mapSlug, roomSlug }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Ошибка сохранения');
      }
      setSel(new Set());
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-lines-hover bg-card-menu p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Модератор: добавить открытие</span>
        <span className="font-blender-medium text-xs text-text-muted">выбрано: {sel.size}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {lootItems.map((it) => {
          const on = sel.has(it.itemId);
          return (
            <button
              key={it.itemId}
              type="button"
              onClick={() => toggle(it.itemId)}
              title={it.name}
              aria-pressed={on}
              className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xs border transition-colors ${
                on ? 'border-(--primary)' : 'border-lines-hover hover:border-(--primary)/40'
              }`}
              style={{ backgroundColor: getTarkovBackgroundColor(it.backgroundColor ?? undefined) }}
            >
              <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]" />
              <img src={itemIconUrl(it.itemId)} alt="" className="absolute inset-0 z-10 h-full w-full object-contain p-0.5" />
              {on && <div className="absolute inset-0 z-20 rounded-xs ring-1 ring-inset ring-(--primary)" />}
            </button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={sel.size === 0 || busy}
        className="mt-3 w-full rounded-xs bg-(--primary) py-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? 'Сохранение…' : `[ Добавить открытие · ${sel.size} предм. ]`}
      </button>
    </div>
  );
}
