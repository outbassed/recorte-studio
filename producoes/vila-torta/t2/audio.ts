/** Áudio 100% original sintetizado em código (nenhuma amostra, voz ou música existente). WAV mono 16-bit, 22,05 kHz. */
export const SR = 22050;
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const buf = (sec: number) => new Float32Array(Math.round(sec * SR));
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));

export function toWav(x: Float32Array): Uint8Array {
  const n = x.length; const out = new Uint8Array(44 + n * 2); const v = new DataView(out.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => out[o + i] = c.charCodeAt(0));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i]!)) * 32000, true);
  return out;
}

/** Base de trap original: 92 bpm, 4 compassos (kick, caixa, chimbal, 808 e um motivo de sintetizador). */
export function beat(): Float32Array {
  const bpm = 92; const step = 60 / bpm / 4; const steps = 64; const x = buf(steps * step);
  const add = (t0: number, f: (t: number) => number, dur: number) => { const i0 = Math.round(t0 * SR); for (let i = 0; i < dur * SR && i0 + i < x.length; i++) x[i0 + i] += f(i / SR); };
  const kicks = [0, 6, 10, 16, 22, 26, 32, 38, 42, 48, 54, 58, 62];
  const bass = [55, 55, 65.4, 49]; const lead = [220, 0, 261.6, 0, 329.6, 0, 261.6, 220, 0, 196, 0, 220, 0, 0, 261.6, 0];
  for (let s = 0; s < steps; s++) {
    const t = s * step; const bar = Math.floor(s / 16);
    if (kicks.includes(s)) add(t, (u) => Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-u * 18)) * u) * env(u, 0.002, 0.18) * 0.9, 0.4);
    if (s % 16 === 4 || s % 16 === 12) add(t, (u) => (noise() * 0.6 + Math.sin(2 * Math.PI * 190 * u) * 0.4) * env(u, 0.002, 0.07) * 0.6, 0.3);
    if (s % 2 === 0 || (s % 16 > 11 && s % 16 !== 12)) { let p = 0; add(t, (u) => { const n = noise(); const o = n - p; p = n; return o * env(u, 0.001, 0.02) * 0.28; }, 0.1); }
    if (s % 8 === 0) { const f = bass[bar]!; add(t, (u) => Math.tanh(Math.sin(2 * Math.PI * f * u) * 2.2) * env(u, 0.01, 0.55) * 0.5, 1.2); }
    const lf = lead[s % 16]!; if (lf) add(t, (u) => (Math.sign(Math.sin(2 * Math.PI * lf * 2 * u)) * 0.5 + Math.sin(2 * Math.PI * lf * 2 * u) * 0.5) * env(u, 0.004, 0.12) * 0.13, 0.35);
  }
  return x;
}
export function crowd(sec = 6): Float32Array {
  const x = buf(sec); let lp = 0, lp2 = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; lp += (noise() - lp) * 0.18; lp2 += (lp - lp2) * 0.3; x[i] = lp2 * (0.8 + 0.25 * Math.sin(t * 2.3) + 0.15 * Math.sin(t * 7.1)); }
  for (let k = 0; k < 14; k++) { const i0 = Math.floor(rnd() * (x.length - 2000)); for (let i = 0; i < 1500; i++) x[i0 + i]! += noise() * Math.exp(-i / 260) * 0.35; }
  return x;
}
export function street(sec = 6): Float32Array {
  const x = buf(sec); let lp = 0;
  for (let i = 0; i < x.length; i++) { lp += (noise() - lp) * 0.03; x[i] = lp * 1.6; }
  for (let k = 0; k < 2; k++) { const c = Math.floor((0.2 + 0.5 * k + rnd() * 0.2) * x.length); for (let i = -9000; i < 9000; i++) if (c + i >= 0 && c + i < x.length) x[c + i]! += Math.sin(2 * Math.PI * (70 + 25 * (i / 18000)) * i / SR) * Math.exp(-Math.abs(i) / 3500) * 0.25 + noise() * Math.exp(-Math.abs(i) / 3000) * 0.05; }
  return x;
}
export function whistle(): Float32Array {
  const x = buf(0.8); for (let i = 0; i < x.length; i++) { const t = i / SR; const trill = 0.65 + 0.35 * Math.sin(2 * Math.PI * 32 * t); x[i] = Math.sin(2 * Math.PI * (2900 + 120 * Math.sin(2 * Math.PI * 6 * t)) * t) * trill * Math.min(1, t * 40) * Math.min(1, (0.8 - t) * 20) * 0.5; }
  return x;
}
/** Disparo distante: estouro curto abafado (sem realismo; apenas sinal sonoro de alarme). */
export function distant(): Float32Array {
  const x = buf(0.7); let lp = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; lp += (noise() - lp) * 0.12; x[i] = (lp * Math.exp(-t * 14) * 1.6 + Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 18) * 0.5 + lp * Math.exp(-(t - 0.18) * 9) * (t > 0.18 ? 0.35 : 0)) * 0.9; }
  return x;
}
export function drop(): Float32Array {
  const x = buf(0.7);
  for (const [t0, a] of [[0, 1], [0.13, 0.5], [0.22, 0.3], [0.28, 0.18]] as const) { const i0 = Math.round(t0 * SR); for (let i = 0; i < 0.12 * SR; i++) x[i0 + i]! += (Math.sin(2 * Math.PI * (210 - 700 * (i / SR)) * i / SR) * 0.6 + noise() * 0.4) * Math.exp(-i / 500) * a; }
  return x;
}
export function steps(sec = 2): Float32Array {
  const x = buf(sec); for (let k = 0; k < sec * 5; k++) { const i0 = Math.floor((k / 5) * SR); for (let i = 0; i < 1400; i++) x[i0 + i]! += noise() * Math.exp(-i / 280) * 0.4; }
  return x;
}
export function engine(sec = 3): Float32Array {
  const x = buf(sec); let lp = 0;
  for (let i = 0; i < x.length; i++) { const t = i / SR; const f = 40 + 70 * Math.min(1, t / sec); lp += (noise() - lp) * 0.08; x[i] = (Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2 * t) * 0.25 + lp * 0.5) * Math.min(1, t * 4) * Math.min(1, (sec - t) * 3) * 0.7; }
  return x;
}
export function office(sec = 6): Float32Array {
  const x = buf(sec); for (let i = 0; i < x.length; i++) x[i] = Math.sin(2 * Math.PI * 120 * i / SR) * 0.03 + noise() * 0.015;
  for (let k = 0; k < 18; k++) { const i0 = Math.floor(rnd() * (x.length - 800)); for (let i = 0; i < 500; i++) x[i0 + i]! += noise() * Math.exp(-i / 70) * 0.25; }
  return x;
}
export function cheer(): Float32Array {
  const x = crowd(1.6); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i]! *= Math.min(1, t * 6) * Math.min(1, (1.6 - t) * 2) * 1.6; } return x;
}
export function sting(): Float32Array { /* "disco riscado": parada abrupta com ruído curto */
  const x = buf(0.5); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (noise() * 0.5 + Math.sin(2 * Math.PI * (900 - 1800 * t) * t) * 0.5) * Math.exp(-t * 7) * 0.6; } return x;
}
export function chime(): Float32Array {
  const x = buf(0.9); for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] = (Math.sin(2 * Math.PI * 880 * t) + 0.5 * Math.sin(2 * Math.PI * 1320 * t)) * Math.exp(-t * 5) * 0.3; } return x;
}
export function registerAudio(B: import('../lib').Builder) {
  const reg = (k: string, x: Float32Array, name: string, cat: 'music' | 'sfx' | 'ambient' | 'voice') => B.addAudio(k, toWav(x), x, SR, name, cat);
  reg('beat', beat(), 'Base de trap original (92 bpm, 4 compassos)', 'music');
  reg('plateia', crowd(), 'Plateia (ambiente)', 'ambient');
  reg('rua', street(), 'Rua (ambiente)', 'ambient');
  reg('delegacia', office(), 'Delegacia (ambiente)', 'ambient');
  reg('apito', whistle(), 'Apito do fiscal', 'sfx');
  reg('disparo', distant(), 'Estouro distante (alerta)', 'sfx');
  reg('queda', drop(), 'Celular caindo', 'sfx');
  reg('passos', steps(), 'Passos rápidos', 'sfx');
  reg('motor', engine(), 'Veículo partindo', 'sfx');
  reg('gritaria', cheer(), 'Plateia vibra', 'sfx');
  reg('freada', sting(), 'Corte brusco', 'sfx');
  reg('sino', chime(), 'Aviso', 'sfx');
}
