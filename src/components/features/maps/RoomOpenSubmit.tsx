'use client';

// Публичная подача открытия меченой комнаты (любой авторизованный) → на модерацию (pending).
// Пикер предметов (чипы лут-таблицы + поиск по каталогу) + обязательный пруф-ссылка YouTube → POST /api/room-opens.
// Решение: docs/decisions/done/marked-rooms.md (трекер v2 + v2.1 — поиск вне лут-таблицы).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoomItemPicker, type PickerItem } from './RoomItemPicker';

interface Props {
  roomId: string;
  mapSlug: string;
  roomSlug: string;
  lootItems: PickerItem[];
}

export function RoomOpenSubmit({ roomId, mapSlug, roomSlug, lootItems }: Props) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [pickKey, setPickKey] = useState(0); // remount пикера = сброс выбора
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/room-opens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, itemIds: ids, proofYoutubeUrl: proof, mapSlug, roomSlug }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Ошибка отправки');
      }
      setPickKey((k) => k + 1);
      setProof('');
      setDone(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded border p-4 text-center" style={{ borderColor: 'color-mix(in srgb, var(--color-nvg-green) 40%, transparent)' }}>
        <p className="text-sm text-nvg-green">Открытие отправлено на модерацию ✓</p>
        <p className="mt-1 text-xs text-text-muted">После проверки пруфа оно попадёт в ленту и пересчёт шансов, а тебе — репутация.</p>
        <button type="button" onClick={() => setDone(false)} className="mt-2 text-xs text-text-secondary underline transition-colors hover:text-(--primary)">
          добавить ещё
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-lines-hover bg-card-menu p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">Добавить своё открытие</span>
        <span className="font-blender-medium text-xs text-text-muted">выбрано: {ids.length}</span>
      </div>
      <RoomItemPicker key={pickKey} lootItems={lootItems} onChange={setIds} />
      <input
        value={proof}
        onChange={(e) => setProof(e.target.value)}
        placeholder="Ссылка на YouTube (пруф — обязательно)"
        inputMode="url"
        className="mt-3 h-9 w-full rounded-xs border border-lines-hover bg-(--color-base) px-3 font-blender-book text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-(--primary)"
      />
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={ids.length === 0 || busy}
        className="mt-3 w-full rounded-xs bg-(--primary) py-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? 'Отправка…' : `[ Отправить на модерацию · ${ids.length} предм. ]`}
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
        На видео: ключ до отпирания, подбор предметов, FIR-галка в инвентаре, версия игры и дата. На слово не верим.
      </p>
    </div>
  );
}
