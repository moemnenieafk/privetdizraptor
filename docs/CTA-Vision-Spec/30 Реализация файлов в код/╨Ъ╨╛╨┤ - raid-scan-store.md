---
title: Код - raid-scan-store
tags: [cta, vision, code, typescript]
status: parsed-clean
repo_path: src/store/raid-scan-store.ts
lines: 53
created: 2026-08-24
---

# `src/store/raid-scan-store.ts`

Состояние сессии скана на клиенте. `ScanState` — дискриминированное объединение, UI рендерит скелетон по `status === 'scanning'`.

- [[Архитектура пайплайна]]

```typescript
import { create } from 'zustand';
import type { ScanResponse, ScanFailure, RecognizedSlot } from '@/lib/vision/types';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'ready'; result: ScanResponse }
  | { status: 'failed'; failure: ScanFailure };

type RaidScanStore = {
  scan: ScanState;
  selectedSlot: number | null;
  runScan: (file: File) => Promise<void>;
  selectSlot: (index: number | null) => void;
  reset: () => void;
};

export const useRaidScanStore = create<RaidScanStore>((set) => ({
  scan: { status: 'idle' },
  selectedSlot: null,

  runScan: async (file) => {
    set({ scan: { status: 'scanning' }, selectedSlot: null });

    const body = new FormData();
    body.append('screenshot', file);

    try {
      const response = await fetch('/api/vision/inventory', { method: 'POST', body });
      const payload: unknown = await response.json();

      if (!response.ok) {
        set({ scan: { status: 'failed', failure: payload as ScanFailure } });
        return;
      }
      set({ scan: { status: 'ready', result: payload as ScanResponse } });
    } catch {
      set({
        scan: {
          status: 'failed',
          failure: { error: 'upstream', message: 'Сервер недоступен' },
        },
      });
    }
  },

  selectSlot: (index) => set({ selectedSlot: index }),
  reset: () => set({ scan: { status: 'idle' }, selectedSlot: null }),
}));

export function isRecognized(slot: RecognizedSlot): boolean {
  return slot.kind !== 'unknown';
}
```

---

Сырой файл: `_src/src/store/raid-scan-store.ts`. Копируется в репозиторий по пути `src/store/raid-scan-store.ts`.
