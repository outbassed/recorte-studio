/** Utilitários de geração de SVG: pequenos, puros e determinísticos. */
export const n = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const HEX = /^#[0-9a-f]{6}$/i;
const HEX_SHORT = /^#[0-9a-f]{3}$/i;
/** Cores vão para atributos SVG: só hex são aceitos (nada de url(...) ou scripts). */
export function safeColor(v: string | undefined, fallback = '#888888'): string {
  if (v && HEX.test(v)) return v;
  if (v && HEX_SHORT.test(v)) return v;
  return fallback;
}

export function shade(hex: string, amt: number): string {
  const h = safeColor(hex).slice(1);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const ch = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16);
    const t = amt < 0 ? 0 : 255;
    return Math.round(c + (t - c) * Math.abs(amt));
  };
  return `#${[ch(0), ch(2), ch(4)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export type Pt = [number, number];

/** Curva suave (Catmull-Rom → Bézier) por uma lista de pontos. */
export function smoothPath(pts: Pt[], closed = false, tension = 0.5): string {
  if (pts.length < 2) return '';
  const g = (i: number): Pt => {
    if (closed) return pts[(i + pts.length) % pts.length]!;
    return pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  };
  let d = `M${n(pts[0]![0])} ${n(pts[0]![1])}`;
  const last = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1);
    const p1 = g(i);
    const p2 = g(i + 1);
    const p3 = g(i + 2);
    const k = tension / 3;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

export function polyPath(pts: Pt[], closed = true): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('') + (closed ? 'Z' : '');
}

export const rectPath = (x: number, y: number, w: number, h: number): string =>
  `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}Z`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, attrs: string): string =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" ${attrs}/>`;

export const rect = (x: number, y: number, w: number, h: number, attrs: string): string =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;

export const path = (d: string, attrs: string): string => `<path d="${d}" ${attrs}/>`;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
