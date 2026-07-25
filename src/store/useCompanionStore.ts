import { create } from 'zustand';

// Один распознанный оффер барахолки со скриншота (перед отправкой в наш ingest).
export interface ScannedOffer {
  inGameId: string;
  name: string; // ru-имя из каталога (для превью)
  price: number; // ₽ за предмет
  uses?: number; // текущие использования X (ключи/износ), из «X/Y»
  maxUses?: number; // максимум Y — разница 1/10 vs 10/10 критична для цены
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
  /** Ручная правка цены оффера (юзер исправляет погрешность OCR перед отправкой). */
  setOfferPrice: (index: number, price: number) => void;
  /** Ручная правка текущих использований X (ключи/износ): дефолт «полный», юзер ставит партиал. */
  setOfferUses: (index: number, uses: number) => void;
  /** Убрать оффер из списка (кривой/лишний). */
  removeOffer: (index: number) => void;
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
  setOfferPrice: (index, price) =>
    set((s) => ({ offers: s.offers.map((o, i) => (i === index ? { ...o, price } : o)) })),
  setOfferUses: (index, uses) =>
    set((s) => ({
      offers: s.offers.map((o, i) =>
        i === index && o.maxUses ? { ...o, uses: Math.max(1, Math.min(o.maxUses, uses)) } : o,
      ),
    })),
  removeOffer: (index) => set((s) => ({ offers: s.offers.filter((_, i) => i !== index) })),
  clearOffers: () => set({ offers: [] }),
  addContributed: (n) => set((s) => ({ contributed: s.contributed + n })),
  setKarma: (karma) => set({ karma }),
  markSubmitted: (ids) => set((s) => ({ lastSubmittedIds: ids, submitSeq: s.submitSeq + 1 })),
  reset: () => set({ active: false, status: { kind: 'idle' }, offers: [] }),
}));
