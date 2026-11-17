import { store } from './profiles';

/**
 * Synthesised sound effects (Web Audio, no asset files).
 * Browsers (iOS especially) only allow audio after a user gesture: call `unlockAudio()` from one.
 */
export type Sfx =
  | 'tap'
  | 'bounce'
  | 'hit'
  | 'shoot'
  | 'boom'
  | 'coin'
  | 'zap'
  | 'out'
  | 'goal'
  | 'beep'
  | 'go'
  | 'win'
  | 'boost';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
const lastPlayed = new Map<Sfx, number>();

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null; // audio unavailable: the game stays silent
  }
}

function tone(type: OscillatorType, from: number, to: number, start: number, dur: number, vol = 0.5): void {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + dur);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noise(start: number, dur: number, filter: BiquadFilterType, freq: number, vol = 0.6): void {
  if (!ctx || !master || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(f).connect(gain).connect(master);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** A single musical note (used for little tunes). */
export function note(freq: number, dur = 0.18): void {
  if (!store.settings.sound || !ctx || ctx.state !== 'running') return;
  tone('triangle', freq, freq, ctx.currentTime, dur, 0.3);
}

export function sfx(name: Sfx): void {
  if (!store.settings.sound || !ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  // Don't stack the same sound dozens of times per second.
  if (now - (lastPlayed.get(name) ?? -1) < 0.05) return;
  lastPlayed.set(name, now);
  switch (name) {
    case 'tap':
      return tone('square', 520, 760, now, 0.07, 0.15);
    case 'bounce':
      return tone('sine', 260, 140, now, 0.09, 0.5);
    case 'hit':
      noise(now, 0.15, 'lowpass', 1200, 0.7);
      return tone('square', 220, 90, now, 0.12, 0.2);
    case 'shoot':
      return noise(now, 0.09, 'highpass', 1500, 0.4);
    case 'boom':
      noise(now, 0.5, 'lowpass', 700, 0.9);
      return tone('sine', 110, 35, now, 0.45, 0.7);
    case 'coin':
      tone('square', 988, 988, now, 0.06, 0.18);
      return tone('square', 1319, 1319, now + 0.06, 0.12, 0.18);
    case 'zap':
      return tone('sawtooth', 1400, 180, now, 0.22, 0.25);
    case 'out':
      return tone('sawtooth', 420, 90, now, 0.45, 0.25);
    case 'goal':
      [523, 659, 784].forEach((f, i) => tone('triangle', f, f, now + i * 0.08, 0.16, 0.4));
      return;
    case 'beep':
      return tone('sine', 440, 440, now, 0.14, 0.4);
    case 'go':
      return tone('sine', 880, 880, now, 0.3, 0.45);
    case 'boost':
      return tone('triangle', 300, 1200, now, 0.3, 0.35);
    case 'win':
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone('triangle', f, f, now + i * 0.11, 0.22, 0.4));
      return;
  }
}
