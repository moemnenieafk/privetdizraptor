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
  /** Счётчик принятых сервером предложений за сессию. */
  contributed: number;
  /** Репутация компаньона (накопительная, приходит с сервера). */
  karma: number;
  /** id предметов последней успешной выгрузки — worklist убирает их из списка. */
  lastSubmittedIds: string[];
  /** Счётчик выгрузок — тик для реакции worklist (даже если id повторяются). */
  submitSeq: number;
  setActive: (v: boolean) => void;
  setStatus: (s: CompanionStatus) => void;
  setGameMode: (m: 'regular' | 'pve') => void;
  /** Накопить офферы нового скриншота в общий список (дедуп по предмет+цена). */
  addOffers: (o: ScannedOffer[]) => void;
  clearOffers: () => void;
  addContributed: (n: number) => void;
  setKarma: (k: number) => void;
  /** Отметить успешную выгрузку: id предметов + тик seq (для worklist). */
  markSubmitted: (ids: string[]) => void;
  reset: () => void;
}

const offerKey = (o: ScannedOffer) => `${o.inGameId}:${o.price}`;

export const useCompanionStore = create<CompanionState>((set) => ({
  active: false,
  status: { kind: 'idle' },
  gameMode: 'regular',
  offers: [],
  contributed: 0,
  karma: 0,
  lastSubmittedIds: [],
  submitSeq: 0,
  setActive: (active) => set({ active }),
  setStatus: (status) => set({ status }),
  setGameMode: (gameMode) => set({ gameMode }),
  addOffers: (incoming) =>
    set((s) => {
      const seen = new Set(s.offers.map(offerKey));
      const merged = [...s.offers];
      for (const o of incoming) {
        const k = offerKey(o);
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(o);
        }
      }
      return { offers: merged };
    }),
  clearOffers: () => set({ offers: [] }),
  addContributed: (n) => set((s) => ({ contributed: s.contributed + n })),
  setKarma: (karma) => set({ karma }),
  markSubmitted: (ids) => set((s) => ({ lastSubmittedIds: ids, submitSeq: s.submitSeq + 1 })),
  reset: () => set({ active: false, status: { kind: 'idle' }, offers: [] }),
}));
