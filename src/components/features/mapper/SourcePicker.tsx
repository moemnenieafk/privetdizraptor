'use client';

// S0/S1 вход: mapId + source (папка кропов или файл-растр) + px/м для физ-порога (решение 8).
// Кнопка «Обзор» открывает серверный обозреватель папок (пиксели по HTTP не ходят — только имена).

import { useState } from 'react';
import { useMapperStore } from '@/store/useMapperStore';
import { FolderBrowser } from './FolderBrowser';

export function SourcePicker() {
  const { mapId, source, pxPerMetre, setSource, runStage, running } = useMapperStore();
  const [m, setM] = useState(mapId);
  const [s, setS] = useState(source);
  const [p, setP] = useState(pxPerMetre?.toString() ?? '');
  const [browsing, setBrowsing] = useState(false);

  const apply = () => setSource({ mapId: m.trim(), source: s.trim(), pxPerMetre: p ? Number(p) : null });

  return (
    <section className="space-y-2 rounded border border-neutral-800 p-4">
      <div className="font-blender-medium text-[10px] uppercase tracking-widest text-neutral-500">Источник</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_8rem]">
        <input value={m} onChange={(e) => setM(e.target.value)} placeholder="mapId" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs" />
        <div className="flex gap-1">
          <input value={s} onChange={(e) => setS(e.target.value)} placeholder="папка кропов или файл-растр" className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs font-mono" />
          <button onClick={() => setBrowsing(true)} title="Обзор папок на диске" className="shrink-0 rounded border border-neutral-700 px-2.5 py-1.5 text-xs hover:border-(--primary)">
            📁 Обзор
          </button>
        </div>
        <input value={p} onChange={(e) => setP(e.target.value)} placeholder="px/м (опц.)" className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs" />
      </div>
      <div className="flex gap-2">
        <button onClick={apply} className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:border-(--primary)">Применить</button>
        <button
          onClick={() => {
            apply();
            void runStage('segment');
          }}
          disabled={running !== null}
          className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:border-(--primary) disabled:opacity-40"
        >
          Применить и сегментировать
        </button>
      </div>

      {browsing && <FolderBrowser initial={s} onPick={(path) => setS(path)} onClose={() => setBrowsing(false)} />}
    </section>
  );
}
