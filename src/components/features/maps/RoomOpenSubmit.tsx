'use client';

// Публичная подача открытия меченой комнаты (любой авторизованный) → на модерацию (pending).
// Чипы предметов из лут-таблицы + обязательный пруф-ссылка YouTube → POST /api/room-opens.
// Решение: docs/decisions/marked-rooms.md (трекер v2).
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

export function RoomOpenSubmit({ roomId, mapSlug, roomSlug, lootItems }: Props) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [proof, setProof] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      const res = await fetch('/api/room-opens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, itemIds: [...sel], proofYoutubeUrl: proof, mapSlug, roomSlug }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'Ошибка отправки');
      }
      setSel(new Set());
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
        disabled={sel.size === 0 || busy}
        className="mt-3 w-full rounded-xs bg-(--primary) py-2 font-blender-medium text-type-micro uppercase tracking-widest text-(--color-base) transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? 'Отправка…' : `[ Отправить на модерацию · ${sel.size} предм. ]`}
      </button>
      <p className="mt-2 text-[10px] leading-relaxed text-text-muted">
        На видео: ключ до отпирания, подбор предметов, FIR-галка в инвентаре, версия игры и дата. На слово не верим.
      </p>
    </div>
  );
}
