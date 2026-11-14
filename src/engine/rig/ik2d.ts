/**
 * Cinemática inversa 2D de DOIS ossos (ombro → cotovelo → mão), em forma fechada (lei dos cossenos).
 *
 * É matemática pura: sem DOM, sem estado, sem aleatoriedade e sem olhar para quadros anteriores. A mesma
 * entrada sempre devolve exatamente a mesma saída, então a prévia, o seek na timeline e a exportação
 * concordam. Nada aqui conhece o personagem; o adaptador `armIk.ts` faz a ponte com o rig.
 *
 * Convenções (iguais às do SVG, com y para BAIXO):
 *  - ângulo de um osso = direção do osso medida a partir de +x, em radianos (π/2 = apontando para baixo);
 *  - `flexion` = rotação do cotovelo, φ2 − φ1, normalizada para (−π, π];
 *  - `bend` (+1 ou −1) escolhe QUAL das duas soluções espelhadas usar: o sinal da flexão do cotovelo.
 *    Como a escolha é um sinal fixo (e não "cotovelo para baixo"), a resposta é contínua enquanto o alvo se move.
 *
 * Alvos impossíveis nunca geram NaN nem "pulos": fora do alcance o braço estica na direção do alvo; perto
 * demais, dobra o máximo possível; limites de junta são respeitados e o erro restante é devolvido em `error`.
 */

export interface Vec2 { x: number; y: number }

export interface TwoBoneParams {
  /** comprimento do osso 1 (braço) e do osso 2 (antebraço + mão) */
  l1: number;
  l2: number;
  /** sinal da flexão do cotovelo: +1 ou −1 */
  bend: 1 | -1;
  /** Limites da flexão do cotovelo medida a favor de `bend` (≥ 0), em radianos. Padrão: 0 … π. */
  flexMin?: number;
  flexMax?: number;
  /** Limites do ângulo absoluto do osso 1, em radianos. Sem os dois, não há limite. */
  rootMin?: number;
  rootMax?: number;
}

export type IkLimit = 'none' | 'out-of-reach' | 'too-close' | 'elbow-limit' | 'root-limit';

export interface TwoBoneResult {
  /** ângulo absoluto do osso 1 e do osso 2 */
  phi1: number;
  phi2: number;
  /** φ2 − φ1, em (−π, π] */
  flexion: number;
  /** posições relativas à raiz (ombro) */
  elbow: Vec2;
  end: Vec2;
  /** distância pedida (raiz → alvo) e alcance possível do braço */
  distance: number;
  minReach: number;
  maxReach: number;
  /** o efetuador chegou ao alvo (dentro da tolerância)? */
  reached: boolean;
  /** distância final entre o efetuador e o alvo */
  error: number;
  limited: IkLimit;
}

const TAU = Math.PI * 2;
/** Direção padrão quando o alvo está exatamente na raiz: para baixo (braço relaxado). Determinístico. */
const FALLBACK_DIR = Math.PI / 2;

/** Normaliza para (−π, π]. */
export function wrapAngle(a: number): number {
  if (!Number.isFinite(a)) return 0;
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  else if (r <= -Math.PI) r += TAU;
  return r;
}

/** O ângulo equivalente a `a` (módulo 2π) mais próximo de `reference`. Mantém a interpolação pelo caminho curto. */
export function nearestAngle(a: number, reference: number): number {
  return reference + wrapAngle(a - reference);
}

const finiteOr = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Cinemática direta: dado φ1 e a flexão, onde ficam o cotovelo e a ponta. */
export function forwardTwoBone(phi1: number, flexion: number, l1: number, l2: number): { elbow: Vec2; end: Vec2 } {
  const elbow = { x: Math.cos(phi1) * l1, y: Math.sin(phi1) * l1 };
  const phi2 = phi1 + flexion;
  return { elbow, end: { x: elbow.x + Math.cos(phi2) * l2, y: elbow.y + Math.sin(phi2) * l2 } };
}

/** Resolve o braço para que a ponta alcance (tx, ty), relativo ao ombro. */
export function solveTwoBone(tx: number, ty: number, p: TwoBoneParams): TwoBoneResult {
  const l1 = Math.max(0, finiteOr(p.l1, 0));
  const l2 = Math.max(0, finiteOr(p.l2, 0));
  const bend: 1 | -1 = p.bend === -1 ? -1 : 1;
  const x = finiteOr(tx, 0);
  const y = finiteOr(ty, 0);
  const d = Math.hypot(x, y);
  const minReach = Math.abs(l1 - l2);
  const maxReach = l1 + l2;
  const eps = 1e-6 * Math.max(1, maxReach);

  const flexMin = clamp(finiteOr(p.flexMin ?? 0, 0), 0, Math.PI);
  const flexMax = clamp(finiteOr(p.flexMax ?? Math.PI, Math.PI), flexMin, Math.PI);

  // Esqueleto degenerado (algum osso sem comprimento): não há o que resolver, e nada pode virar NaN.
  if (l1 < 1e-9 || l2 < 1e-9) {
    const dir = d < 1e-9 ? FALLBACK_DIR : Math.atan2(y, x);
    const f = clamp(0, flexMin, flexMax) * bend;
    const fk = forwardTwoBone(dir, f, l1, l2);
    const err = Math.hypot(fk.end.x - x, fk.end.y - y);
    return { phi1: dir, phi2: dir + f, flexion: wrapAngle(f), elbow: fk.elbow, end: fk.end, distance: d, minReach, maxReach, reached: err <= eps, error: err, limited: d > maxReach + eps ? 'out-of-reach' : 'none' };
  }

  const dir = d < 1e-9 ? FALLBACK_DIR : Math.atan2(y, x);
  const dEff = clamp(d, minReach, maxReach);

  // Ângulo interno no cotovelo (lei dos cossenos). Flexão = π − interno (0 = braço esticado).
  const cosInner = clamp((l1 * l1 + l2 * l2 - dEff * dEff) / (2 * l1 * l2), -1, 1);
  const flexFree = Math.PI - Math.acos(cosInner);
  const flex = clamp(flexFree, flexMin, flexMax);
  const elbowClamped = flex !== flexFree;

  // Com a flexão definida, a ponta fica a `beta` do osso 1; o osso 1 é girado para apontar a ponta ao alvo.
  const beta = Math.atan2(bend * l2 * Math.sin(flex), l1 + l2 * Math.cos(flex));
  let phi1 = dir - beta;

  let rootClamped = false;
  if (p.rootMin !== undefined && p.rootMax !== undefined && Number.isFinite(p.rootMin) && Number.isFinite(p.rootMax)) {
    const lo = Math.min(p.rootMin, p.rootMax);
    const hi = Math.max(p.rootMin, p.rootMax);
    const mid = (lo + hi) / 2;
    const unwrapped = nearestAngle(phi1, mid);
    const c = clamp(unwrapped, lo, hi);
    rootClamped = c !== unwrapped;
    phi1 = c;
  }

  const flexion = bend * flex;
  const fk = forwardTwoBone(phi1, flexion, l1, l2);
  const error = Math.hypot(fk.end.x - x, fk.end.y - y);
  const limited: IkLimit = d > maxReach + eps ? 'out-of-reach' : d < minReach - eps ? 'too-close' : elbowClamped ? 'elbow-limit' : rootClamped ? 'root-limit' : 'none';
  return { phi1, phi2: phi1 + flexion, flexion: wrapAngle(flexion), elbow: fk.elbow, end: fk.end, distance: d, minReach, maxReach, reached: error <= Math.max(eps, 1e-4), error, limited };
}
