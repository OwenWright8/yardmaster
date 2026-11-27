// Little synthesized sounds (no audio files): couplings, the loco moving, chimes, coins. iOS only lets audio start
// after a tap, so the audio context is created on the first one.
let ctx: AudioContext | null = null, master: GainNode | null = null;
export let muted = false;
export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
export function unlockAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination); } catch { return; } }
  if (ctx.state === 'suspended') ctx.resume();
}
const now = () => ctx!.currentTime;
function tone(f: number, t: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t: number, dur: number, vol: number, freq = 1200, q = 1) {
  if (!ctx || !master) return;
  const len = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
export const sfx = {
  tap() { if (ctx) tone(880, now(), 0.06, 0.05, 'triangle'); },
  clank() { if (!ctx) return; const t = now(); noise(t, 0.12, 0.6, 900, 2); tone(140, t, 0.12, 0.12, 'square', 0.6); noise(t + 0.05, 0.08, 0.3, 2400, 4); },
  uncouple() { if (!ctx) return; const t = now(); noise(t, 0.08, 0.3, 1800, 3); tone(420, t, 0.08, 0.05, 'triangle', 0.7); },
  move() { if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) noise(t + i * 0.13, 0.09, 0.18, 300, 1); tone(70, t, 0.5, 0.06, 'sawtooth', 1.2); },
  horn() { if (!ctx) return; const t = now(); tone(392, t, 0.35, 0.07, 'sawtooth'); tone(494, t, 0.35, 0.05, 'sawtooth'); },
  error() { if (!ctx) return; const t = now(); tone(180, t, 0.16, 0.08, 'square'); tone(150, t + 0.09, 0.18, 0.08, 'square'); },
  star(i: number) { if (!ctx) return; tone(660 * Math.pow(1.26, i), now(), 0.35, 0.1, 'triangle'); },
  coins() { if (!ctx) return; const t = now(); [1319, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.18, 0.06, 'triangle')); },
  win() { if (!ctx) return; const t = now(); [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.4, 0.09, 'triangle')); },
};
// a tiny tap of feedback on phones (the native haptics when it's the app, a vibration where the browser allows)
export function buzz(kind: 'light' | 'medium' | 'heavy' = 'light') {
  const h = (window as any).Capacitor?.Plugins?.Haptics;
  if (h) { h.impact({ style: kind.toUpperCase() }).catch(() => {}); return; }
  navigator.vibrate?.(kind === 'heavy' ? 30 : kind === 'medium' ? 18 : 8);
}
