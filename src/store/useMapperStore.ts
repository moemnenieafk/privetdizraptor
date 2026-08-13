'use client';

// cta-mapper — состояние UI (Zustand живёт только в src/store, §3).
// Тяжёлые пиксели по HTTP не ходят: стор шлёт {mapId, source} на роут и хранит СВОДКУ +
// снимок манифеста (объекты для гейтов). Превью объектов — отдельный ≤512px эндпоинт (TODO).

import { create } from 'zustand';
import type { MapperManifest, MapperObject, PipelineStage } from '@/lib/mapper/types';

interface MapperState {
  mapId: string;
  source: string;
  pxPerMetre: number | null;
  manifest: MapperManifest | null;
  objects: MapperObject[];
  running: PipelineStage | null;
  log: string[];
  error: string | null;
  billing: boolean;

  setSource: (p: { mapId: string; source: string; pxPerMetre?: number | null }) => void;
  reload: () => Promise<void>;
  runStage: (stage: PipelineStage) => Promise<void>;
  setSubject: (id: string, subject: string) => void;
}

export const useMapperStore = create<MapperState>((set, get) => ({
  mapId: 'customs',
  source: 'map-exports/OBJECTS-MAPS/cut/customs/objects',
  pxPerMetre: null,
  manifest: null,
  objects: [],
  running: null,
  log: [],
  error: null,
  billing: false,

  setSource: ({ mapId, source, pxPerMetre }) => set({ mapId, source, pxPerMetre: pxPerMetre ?? null }),

  reload: async () => {
    const { mapId } = get();
    const r = await fetch(`/api/mapper/manifest?mapId=${encodeURIComponent(mapId)}`);
    const m = (await r.json()) as MapperManifest | { objects: MapperObject[] };
    set({ manifest: 'palette' in m ? (m as MapperManifest) : null, objects: m?.objects ?? [] });
  },

  runStage: async (stage) => {
    const { mapId, source, pxPerMetre } = get();
    set({ running: stage, error: null, billing: false });
    try {
      const r = await fetch(`/api/mapper/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId, source, pxPerMetre }),
      });
      const j = await r.json();
      if (!r.ok) set({ error: j.error ?? 'ошибка', billing: !!j.billing });
      else {
        set((s) => ({ log: [`✓ ${stage}: ${JSON.stringify(j)}`, ...s.log].slice(0, 50) }));
        await get().reload();
      }
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ running: null });
    }
  },

  // Локальный оптимистичный правок subject на гейте S5. Персист в манифест — отдельный PATCH (TODO).
  setSubject: (id, subject) => set((s) => ({ objects: s.objects.map((o) => (o.id === id ? { ...o, subject } : o)) })),
}));
