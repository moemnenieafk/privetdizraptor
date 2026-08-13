'use client';

// Модалка-обозреватель серверных папок. Навигация по диску (dev), выбор папки-источника.
// Показывает счётчик картинок в каждой подпапке — сразу видно, где лежат кропы.

import { useEffect, useState } from 'react';

interface Dir {
  name: string;
  path: string;
  images: number;
}
interface BrowseResp {
  path: string;
  parent: string | null;
  dirs: Dir[];
  images: number;
  error?: string;
}

export function FolderBrowser({ initial, onPick, onClose }: { initial: string; onPick: (path: string) => void; onClose: () => void }) {
  const [cur, setCur] = useState(initial || 'map-exports');
  const [data, setData] = useState<BrowseResp | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/mapper/browse?path=${encodeURIComponent(cur)}`)
      .then((r) => r.json())
      .then((d: BrowseResp) => {
        if (alive) setData(d);
      });
    return () => {
      alive = false;
    };
  }, [cur]);

  const here = data?.path ?? cur;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded border border-neutral-700 bg-neutral-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-neutral-800 p-3">
          <span className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">Выбор папки</span>
          <input
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-mono text-neutral-300"
          />
          <button onClick={onClose} className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500">✕</button>
        </div>

        <div className="min-h-40 flex-1 overflow-auto p-1.5">
          {data?.error && <div className="p-3 text-xs text-red-400">{data.error}</div>}
          {data?.parent && (
            <button onClick={() => setCur(data.parent!)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-900">
              <span>↑</span> ..
            </button>
          )}
          {!data && <div className="p-3 text-xs text-neutral-600">…</div>}
          {data?.dirs.map((d) => (
            <button key={d.path} onClick={() => setCur(d.path)} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-900">
              <span className="truncate">📁 {d.name}</span>
              {d.images > 0 && <span className="shrink-0 text-[10px] text-neutral-600">{d.images} img</span>}
            </button>
          ))}
          {data && data.dirs.length === 0 && <div className="p-3 text-xs text-neutral-600">нет подпапок</div>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-800 p-3">
          <span className="truncate text-[10px] text-neutral-600">{data ? `${data.images} картинок в этой папке` : ''}</span>
          <button
            onClick={() => {
              onPick(here);
              onClose();
            }}
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:border-(--primary)"
          >
            Выбрать эту папку
          </button>
        </div>
      </div>
    </div>
  );
}
