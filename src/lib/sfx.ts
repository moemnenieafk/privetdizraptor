// Звуковой движок на Web Audio API — синтез на лету (без файлов/лицензий).
// Чистые «тактические» тоны: blip-подтверждение, монеты, ранг-ап-арпеджио, чайм-анлок, клик.

export type SfxName = 'confirm' | 'coins' | 'rank-up' | 'unlock' | 'tick' | 'reel';

interface AudioWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let ctx: AudioContext | null = null;
let muted = false;
const MASTER = 0.5;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const w = window as unknown as AudioWindow;
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function setSfxMuted(value: boolean): void {
  muted = value;
}

interface ToneOpts {
  freq: number;
  start?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  freqTo?: number;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  const t0 = c.currentTime + (o.start ?? 0);
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo, t0 + o.dur);
  const peak = Math.max(0.0002, (o.gain ?? 0.3) * MASTER);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

/** Воспроизвести эффект. Безопасно с autoplay-политикой — вызывать по жесту пользователя. */
export function playSfx(name: SfxName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();

  switch (name) {
    case 'confirm':
      tone(c, { freq: 520, freqTo: 780, dur: 0.13, type: 'triangle', gain: 0.3 });
      break;
    case 'tick':
      tone(c, { freq: 880, dur: 0.04, type: 'square', gain: 0.12 });
      break;
    case 'reel':
      // Мягкий деревянный «ток» для прокрутки рулетки — тихий, с быстрым спадом
      // питча, не утомляет при повторах (в отличие от резкого square-тика).
      tone(c, { freq: 340, freqTo: 190, dur: 0.03, type: 'triangle', gain: 0.06 });
      break;
    case 'coins':
      [880, 1100, 1320].forEach((f, i) =>
        tone(c, { freq: f, start: i * 0.05, dur: 0.09, type: 'sine', gain: 0.18 }),
      );
      break;
    case 'unlock':
      tone(c, { freq: 660, dur: 0.26, type: 'sine', gain: 0.24 });
      tone(c, { freq: 990, dur: 0.32, type: 'sine', gain: 0.14 });
      break;
    case 'rank-up':
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(c, { freq: f, start: i * 0.09, dur: 0.24, type: 'triangle', gain: 0.28 }),
      );
      break;
  }
}
