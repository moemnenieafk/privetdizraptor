// Стор «Ресток торговцев». Вся доменка здесь (§4.7): ОДИН тик на весь грид
// (god-node, не setInterval на карту), экстраполяция ближайшего рестока и
// планировщик уведомлений. Персистятся ТОЛЬКО настройки (offset/звук/mute) в
// localStorage — это per-device UX, бэкенд не нужен. Данные рестока — из нашего
// зеркала через /api/eft/traders/restock (BACKEND AUTONOMY, без внешних API).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { nextRestockMs, formatRestockHMS, type RestockTrader } from '@/lib/eft-restock';

interface RestockPrefs {
  offsetSec: number;
  sound: boolean;
  mutedSlugs: string[];
}

type Perm = NotificationPermission | 'unsupported';

interface RestockState {
  traders: RestockTrader[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  now: number;
  notifPerm: Perm;
  prefs: RestockPrefs;
  load: (mode: string) => Promise<void>;
  _tick: () => void;
  setOffset: (sec: number) => void;
  toggleSound: () => void;
  toggleMute: (slug: string) => void;
  refreshPerm: () => void;
  requestPerm: () => Promise<void>;
}

// ── module-singleton: один интервал на всё приложение ─────────────────────────
let intervalId: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
// slug → таймстамп рестока, для которого уведомление уже отправлено (дедуп за цикл)
const firedFor = new Map<string, number>();
let audioCtx: AudioContext | null = null;

function playBeep(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.36);
  } catch {
    /* звук — не критично */
  }
}

function notify(t: RestockTrader, offsetSec: number, remainingMs: number): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const body = offsetSec === 0 ? 'Ассортимент обновляется' : `Завоз через ${formatRestockHMS(remainingMs)}`;
  try {
    new Notification(`Завоз у торговца: ${t.nameRu}`, {
      body,
      tag: `cta-restock-${t.slug}`,
      icon: t.image || undefined,
    });
  } catch {
    /* уведомление могло быть заблокировано */
  }
}

// Пометить как «уже сработавшие» все ресток-моменты, что УЖЕ внутри окна offset —
// чтобы открытие модалки/смена offset не выстреливали уведомлением задним числом.
function seedSuppression(traders: RestockTrader[], offsetSec: number, now: number): void {
  for (const t of traders) {
    const next = nextRestockMs(t.resetTime, t.intervalSec, now);
    if (next != null && next - now <= offsetSec * 1000) firedFor.set(t.slug, next);
  }
}

export const useRestockStore = create<RestockState>()(
  persist(
    (set, get) => ({
      traders: [],
      status: 'idle',
      now: Date.now(),
      notifPerm: 'unsupported',
      prefs: { offsetSec: 0, sound: false, mutedSlugs: [] },

      load: async (mode) => {
        if (get().status === 'loading') return;
        set({ status: 'loading' });
        try {
          const res = await fetch(`/api/eft/traders/restock?mode=${encodeURIComponent(mode)}`);
          if (!res.ok) throw new Error(String(res.status));
          const data: { traders: RestockTrader[] } = await res.json();
          const now = Date.now();
          firedFor.clear();
          seedSuppression(data.traders, get().prefs.offsetSec, now);
          set({ traders: data.traders, now, status: 'ready' });
        } catch {
          set({ status: 'error' });
        }
      },

      _tick: () => {
        const now = Date.now();
        const { traders, prefs, notifPerm } = get();
        set({ now });
        for (const t of traders) {
          if (prefs.mutedSlugs.includes(t.slug)) continue;
          const next = nextRestockMs(t.resetTime, t.intervalSec, now);
          if (next == null) continue;
          const remaining = next - now;
          if (remaining <= prefs.offsetSec * 1000 && firedFor.get(t.slug) !== next) {
            firedFor.set(t.slug, next);
            if (notifPerm === 'granted') notify(t, prefs.offsetSec, remaining);
            if (prefs.sound) playBeep();
          }
        }
      },

      setOffset: (sec) => {
        seedSuppression(get().traders, sec, Date.now());
        set((s) => ({ prefs: { ...s.prefs, offsetSec: sec } }));
      },
      toggleSound: () => set((s) => ({ prefs: { ...s.prefs, sound: !s.prefs.sound } })),
      toggleMute: (slug) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            mutedSlugs: s.prefs.mutedSlugs.includes(slug)
              ? s.prefs.mutedSlugs.filter((x) => x !== slug)
              : [...s.prefs.mutedSlugs, slug],
          },
        })),

      refreshPerm: () =>
        set({ notifPerm: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported' }),
      requestPerm: async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        try {
          const perm = await Notification.requestPermission();
          set({ notifPerm: perm });
        } catch {
          /* пользователь мог отклонить */
        }
      },
    }),
    {
      name: 'cta-restock',
      partialize: (s) => ({ prefs: s.prefs }),
    },
  ),
);

/**
 * God-node тик: монтируется в любом видимом ресток-UI (кнопка/модалка).
 * Рефкаунтит единственный setInterval — тикает, пока хоть один потребитель жив.
 */
export function useRestockTick(): void {
  useEffect(() => {
    useRestockStore.getState().refreshPerm();
    refCount += 1;
    if (intervalId == null) {
      intervalId = setInterval(() => useRestockStore.getState()._tick(), 1000);
    }
    return () => {
      refCount -= 1;
      if (refCount <= 0 && intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
        refCount = 0;
      }
    };
  }, []);
}
