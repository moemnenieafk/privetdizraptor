import { create } from 'zustand';

// Один распознанный оффер барахолки со скриншота (перед отправкой в наш ingest).
export interface ScannedOffer {
  inGameId: string;
  name: string; // ru-имя из каталога (для превью)
  price: number; // ₽ за предмет
}

export type CompanionStatus =
  | { kind: 'idle' }
  | { kind: 'requesting' } // ждём выбор папки / прав
  | { kind: 'watching' } // следим за папкой
  | { kind: 'scanning' } // OCR текущего скриншота
  | { kind: 'submitting' }
  | { kind: 'unsupported' } // нет File System Access (не Chromium)
  | { kind: 'error'; message: string };

interface CompanionState {
  active: boolean;
  status: CompanionStatus;
  gameMode: 'regular' | 'pve';
  /** Последняя пачка распознанных офферов (превью перед/после отправки). */
  offers: ScannedOffer[];
  /** Счётчик принятых сервером офферов за сессию (для мотивации/кармы). */
  contributed: number;
  setActive: (v: boolean) => void;
  setStatus: (s: CompanionStatus) => void;
  setGameMode: (m: 'regular' | 'pve') => void;
  setOffers: (o: ScannedOffer[]) => void;
  addContributed: (n: number) => void;
  reset: () => void;
}

export const useCompanionStore = create<CompanionState>((set) => ({
  active: false,
  status: { kind: 'idle' },
  gameMode: 'regular',
  offers: [],
  contributed: 0,
  setActive: (active) => set({ active }),
  setStatus: (status) => set({ status }),
  setGameMode: (gameMode) => set({ gameMode }),
  setOffers: (offers) => set({ offers }),
  addContributed: (n) => set((s) => ({ contributed: s.contributed + n })),
  reset: () => set({ active: false, status: { kind: 'idle' }, offers: [] }),
}));
