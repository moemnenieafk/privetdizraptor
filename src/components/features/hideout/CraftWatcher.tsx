'use client';

/**
 * Глобальный вотчер готовности крафтов (спека craft-production-tracker §2).
 *
 * Без UI: тикает ~1с по `useCraftProductionStore.active`, и на переходе любого
 * крафта producing→done шлёт браузер-`Notification` + звук — ОДИН раз на крафт.
 * Паттерн зеркалит `game-timer-dock` (ресток торговцев, useRestockStore): тот же
 * синтез-бип через AudioContext, тот же guard по разрешению, та же дедупликация
 * через `tag` уведомления.
 *
 * Anti-spam на перезагрузке: крафты, УЖЕ готовые в момент монтирования, сразу
 * помечаются «сработавшими» (по startedAt) — уведомление летит только на живой
 * переход, наблюдённый в этой сессии.
 */
import { useEffect } from 'react';
import {
  useCraftProductionStore,
  productionStatus,
  type ProductionEntry,
} from '@/store/useCraftProductionStore';

// module-singleton дедуп: stationKey → startedAt крафта, для которого уведомление уже ушло.
const firedFor = new Map<string, number>();
let audioCtx: AudioContext | null = null;

function playBeep(): void {
  if (typeof window === 'undefined') return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

function notify(stationKey: string, entry: ProductionEntry): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification('Крафт готов', {
      body: `${entry.label} — ${entry.stationName}`,
      tag: `cta-craft-${stationKey}`,
      icon: '/icons/eft/04-progression/hideout-modules/hideout-build-icon.svg',
    });
  } catch {
    /* уведомление могло быть заблокировано */
  }
}

export function CraftWatcher(): null {
  useEffect(() => {
    // Не тикаем до гидрации persist-стора — иначе active пуст и seed промахнётся.
    const seed = (): void => {
      const now = Date.now();
      const { active } = useCraftProductionStore.getState();
      for (const [stationKey, entry] of Object.entries(active)) {
        if (productionStatus(entry, now) === 'done') firedFor.set(stationKey, entry.startedAt);
      }
    };
    if (useCraftProductionStore.getState()._hasHydrated) {
      seed();
    } else {
      // одноразово при завершении гидрации
      const unsub = useCraftProductionStore.subscribe((s) => {
        if (s._hasHydrated) {
          seed();
          unsub();
        }
      });
    }

    const tick = (): void => {
      const now = Date.now();
      const { active } = useCraftProductionStore.getState();
      const liveKeys = new Set(Object.keys(active));
      // подчистить дедуп для снятых крафтов, чтобы повторный запуск станции уведомил снова.
      for (const key of firedFor.keys()) {
        if (!liveKeys.has(key)) firedFor.delete(key);
      }
      for (const [stationKey, entry] of Object.entries(active)) {
        if (productionStatus(entry, now) !== 'done') continue;
        if (firedFor.get(stationKey) === entry.startedAt) continue;
        firedFor.set(stationKey, entry.startedAt);
        notify(stationKey, entry);
        playBeep();
      }
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
