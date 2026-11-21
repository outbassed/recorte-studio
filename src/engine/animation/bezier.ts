/**
 * Curva cubic-bezier real (mesma definição do CSS): P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1).
 * O progresso de tempo é o X da curva; resolvemos x(s)=progresso para achar s e devolvemos y(s).
 * Função pura, sem estado: serve para prévia, seek e exportação.
 */

export interface BezierHandles {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** X precisa ficar em [0,1] para o tempo nunca andar para trás. Y pode passar para dar overshoot. */
export const HANDLE_X_MIN = 0;
export const HANDLE_X_MAX = 1;
export const HANDLE_Y_MIN = -1;
export const HANDLE_Y_MAX = 2;

const clampNum = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const finiteOr = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Dados inválidos viram o padrão; valores fora da faixa são limitados. Sempre devolve números finitos. */
export function sanitizeHandles(h: Partial<Record<keyof BezierHandles, unknown>> | null | undefined): BezierHandles {
  return {
    x1: clampNum(finiteOr(h?.x1, 0.42), HANDLE_X_MIN, HANDLE_X_MAX),
    y1: clampNum(finiteOr(h?.y1, 0), HANDLE_Y_MIN, HANDLE_Y_MAX),
    x2: clampNum(finiteOr(h?.x2, 0.58), HANDLE_X_MIN, HANDLE_X_MAX),
    y2: clampNum(finiteOr(h?.y2, 1), HANDLE_Y_MIN, HANDLE_Y_MAX),
  };
}

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-4;
const PRECISION = 1e-7;
const MAX_BISECTIONS = 40;

const coeffA = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
const coeffB = (a1: number, a2: number) => 3 * a2 - 6 * a1;
const coeffC = (a1: number) => 3 * a1;
const sample = (s: number, a1: number, a2: number) => ((coeffA(a1, a2) * s + coeffB(a1, a2)) * s + coeffC(a1)) * s;
const slope = (s: number, a1: number, a2: number) => 3 * coeffA(a1, a2) * s * s + 2 * coeffB(a1, a2) * s + coeffC(a1);

/** Resolve x(s) = x para s em [0,1]: Newton com reserva por bissecção (x(s) é monótono quando x1,x2 ∈ [0,1]). */
function solveParameter(x: number, x1: number, x2: number): number {
  let s = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const err = sample(s, x1, x2) - x;
    if (Math.abs(err) < PRECISION) return s;
    const d = slope(s, x1, x2);
    if (Math.abs(d) < NEWTON_MIN_SLOPE) break;
    s -= err / d;
  }
  let lo = 0;
  let hi = 1;
  s = x;
  for (let i = 0; i < MAX_BISECTIONS; i++) {
    const err = sample(s, x1, x2) - x;
    if (Math.abs(err) < PRECISION) break;
    if (err > 0) hi = s;
    else lo = s;
    s = (lo + hi) / 2;
  }
  return s;
}

/** y(x) da curva. Extremos exatos: 0 → 0 e 1 → 1. Entrada fora de [0,1] é limitada; NaN vira 0. */
export function cubicBezierEase(progress: number, handles: BezierHandles): number {
  if (!(progress > 0)) return 0;
  if (progress >= 1) return 1;
  const { x1, y1, x2, y2 } = sanitizeHandles(handles);
  if (x1 === y1 && x2 === y2) return progress; // diagonal = linear, sem erro numérico
  const s = solveParameter(progress, x1, x2);
  const y = sample(s, y1, y2);
  return Number.isFinite(y) ? y : progress;
}

/** Presets do editor (valores de easings.net, a referência usada por quem anima em CSS e After Effects). */
export const BEZIER_PRESETS: Array<{ id: string; label: string; handles: BezierHandles }> = [
  { id: 'linear', label: 'Linear', handles: { x1: 0, y1: 0, x2: 1, y2: 1 } },
  { id: 'ease', label: 'Suave', handles: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 } },
  { id: 'in', label: 'Acelera', handles: { x1: 0.32, y1: 0, x2: 0.67, y2: 0 } },
  { id: 'out', label: 'Desacelera', handles: { x1: 0.33, y1: 1, x2: 0.68, y2: 1 } },
  { id: 'inOut', label: 'Duas pontas', handles: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 } },
  { id: 'overshoot', label: 'Passa e volta', handles: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } },
  { id: 'anticipate', label: 'Recua e vai', handles: { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 } },
];

/** Ponto de partida do editor: aproximação cúbica do easing nomeado que o keyframe já tinha. */
export const EASING_AS_HANDLES: Record<string, BezierHandles> = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  easeIn: { x1: 0.11, y1: 0, x2: 0.5, y2: 0 },
  easeOut: { x1: 0.5, y1: 1, x2: 0.89, y2: 1 },
  easeInOut: { x1: 0.45, y1: 0, x2: 0.55, y2: 1 },
  easeInCubic: { x1: 0.32, y1: 0, x2: 0.67, y2: 0 },
  easeOutCubic: { x1: 0.33, y1: 1, x2: 0.68, y2: 1 },
  easeInOutCubic: { x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  backIn: { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 },
  backOut: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  backInOut: { x1: 0.68, y1: -0.6, x2: 0.32, y2: 1.6 },
  bounceOut: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
};
