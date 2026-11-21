/** Interpolação determinística de keyframes: valor = f(tempo), sem estado anterior. */
import type { Easing, Keyframe, KeyValue } from '../model/schema';
import { cubicBezierEase } from './bezier';

const c1 = 1.70158;
const c3 = c1 + 1;
const c2 = c1 * 1.525;

export const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  backOut: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  // Etapa 1: cúbicas e "back" de entrada (ids novos; os antigos acima não mudam).
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  backIn: (t) => c3 * t * t * t - c1 * t * t,
  backInOut: (t) => (t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2),
  bounceOut: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75;
    if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375;
    return n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375;
  },
};

/** Progresso (0–1) do segmento que parte de `a`: curva livre quando existe, senão o easing nomeado. */
export function segmentEase(a: Pick<Keyframe, 'interpolation' | 'easing' | 'bezierHandles'>, raw: number): number {
  if (a.interpolation === 'bezier' && a.bezierHandles) return cubicBezierEase(raw, a.bezierHandles);
  const fn = EASINGS[a.easing] ?? EASINGS.easeInOut;
  return fn(raw);
}

export function sortKeys(keys: readonly Keyframe[]): Keyframe[] {
  return [...keys].sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Regras:
 *  - antes do primeiro key: valor do primeiro; depois do último: valor do último;
 *  - dois keys no MESMO tempo: vale o último da lista ordenada de forma estável;
 *  - valores não numéricos e `hold` mantêm o valor até o próximo key.
 * `keys` precisa estar ordenado por tempo (as operações do modelo garantem isso).
 */
export function evaluateKeys(keys: readonly Keyframe[], timeMs: number): KeyValue | undefined {
  if (keys.length === 0) return undefined;
  if (timeMs < keys[0]!.timeMs) return keys[0]!.value;
  let lo = 0;
  let hi = keys.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (keys[mid]!.timeMs <= timeMs) lo = mid;
    else hi = mid - 1;
  }
  const a = keys[lo]!;
  const b = keys[lo + 1];
  if (!b || a.interpolation === 'hold' || typeof a.value !== 'number' || typeof b.value !== 'number') return a.value;
  const span = b.timeMs - a.timeMs;
  if (span <= 0) return a.value;
  const raw = (timeMs - a.timeMs) / span;
  const t = a.interpolation === 'linear' ? raw : segmentEase(a, raw);
  const v = a.value + (b.value - a.value) * t;
  return Number.isFinite(v) ? v : a.value;
}
