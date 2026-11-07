/** Interpolação determinística de keyframes: valor = f(tempo), sem estado anterior. */
import type { Easing, Keyframe, KeyValue } from '../model/schema';

const c1 = 1.70158;
const c3 = c1 + 1;

export const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  backOut: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  bounceOut: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t - 1.5 / d1) * (t - 1.5 / d1) + 0.75;
    if (t < 2.5 / d1) return n1 * (t - 2.25 / d1) * (t - 2.25 / d1) + 0.9375;
    return n1 * (t - 2.625 / d1) * (t - 2.625 / d1) + 0.984375;
  },
};

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
  const t = a.interpolation === 'linear' ? raw : EASINGS[a.easing](raw);
  return a.value + (b.value - a.value) * t;
}
