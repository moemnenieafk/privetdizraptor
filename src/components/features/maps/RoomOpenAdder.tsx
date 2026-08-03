'use client';

// Инструмент модератора: добавить подтверждённое открытие меченой комнаты.
// Пикер предметов (чипы лут-таблицы + поиск по каталогу) → POST /api/admin/room-opens.
// Рендерится только для admin|editor (страница проверяет canEditContent). Решение: docs/decisions/done/marked-rooms.md.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoomItemPicker, type PickerItem } from './RoomItemPicker';

interface Props {
  roomId: string;
  mapSlug: string;
  roomSlug: string;
  lootItems: PickerItem[];
}

export function RoomOpenAdder({ roomId, mapSlug, roomSlug, lootItems }: Props) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [pickKey, setPickKey] = useState(0); // remount пикера = сброс выбора
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/room-opens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, itemIds: ids, mapSlug, roomSlug }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Ошибка сохранения');
      }
      setPickKey((k) => k + 1);
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
        <span className="font-blender-medium text-xs text-text-muted">выбрано: {ids.length}</span>
      </div>
      <RoomItemPicker key={pickKey} lootItems={lootItems} onChange={setIds} />
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={ids.length === 0 || busy}
        className="mt-3 w-full rounded-xs bg-(--primary) py-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? 'Сохранение…' : `[ Добавить открытие · ${ids.length} предм. ]`}
      </button>
    </div>
  );
}
