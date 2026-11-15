/**
 * IK das pernas no rig SVG existente. Compartilha a geometria do renderizador:
 * quadril → joelho → tornozelo, sem alterar a pose quando desligado.
 * O alvo fica no mundo da cena; a avaliação continua pura em relação ao tempo.
 */
import type { CharacterDefinition, Rig, ViewId } from '../model/schema';
import { bodyMetrics, legGeometry } from '../character/render';
import { viewInfo } from '../character/views';
import { nearestAngle, solveTwoBone, type IkLimit, type Vec2 } from './ik2d';

export type LegSide = 'L' | 'R';
export type KneeBend = 'forward' | 'backward';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Limites conservadores em graus das propriedades do rig. */
export const LEG_IK_LIMITS = { upperMin: -120, upperMax: 120, kneeMax: 145 } as const;

export interface LegChain {
  hip: Vec2;
  thigh: number;
  shin: number;
  dir: number;
  k: number;
  sitAngle: number;
  upperDeg: number;
  lowerDeg: number;
}

export function legChain(def: CharacterDefinition, view: ViewId, rig: Rig, side: LegSide): LegChain {
  const g = legGeometry(bodyMetrics(def), viewInfo(view), rig, side);
  // hipY está em coordenadas do grupo raiz, deslocado por -rig.bodyY no desenho.
  return { hip: { x: g.x, y: g.hipY - rig.bodyY }, thigh: g.thigh, shin: g.shin,
    dir: g.dir, k: g.k, sitAngle: g.sitAngle, upperDeg: g.upperDeg, lowerDeg: g.lowerDeg };
}

/** Posição do tornozelo realmente desenhado, antes da correção visual do calçado. */
export function footAnkleLocal(def: CharacterDefinition, view: ViewId, rig: Rig, side: LegSide): Vec2 {
  const ch = legChain(def, view, rig, side);
  const a = ch.upperDeg * RAD;
  const b = (ch.upperDeg + ch.lowerDeg) * RAD;
  return { x: ch.hip.x - Math.sin(a) * ch.thigh - Math.sin(b) * ch.shin,
    y: ch.hip.y + Math.cos(a) * ch.thigh + Math.cos(b) * ch.shin };
}

export interface LegIkSolution {
  upper: number;
  lower: number;
  ankle: Vec2;
  reached: boolean;
  error: number;
  limited: IkLimit;
  distance: number;
  maxReach: number;
}

/** Solução de dois ossos em coordenadas LOCAIS do personagem (pés na origem). */
export function solveLegIk(
  def: CharacterDefinition, view: ViewId, rig: Rig,
  side: LegSide, target: Vec2, bend: KneeBend, soft = 0,
): LegIkSolution {
  const ch = legChain(def, view, rig, side);
  const rel = { x: target.x - ch.hip.x, y: target.y - ch.hip.y };
  const original = footAnkleLocal(def, view, rig, side);
  const initialError = Math.hypot(original.x - target.x, original.y - target.y);
  // Ativar o IK com o alvo sobre o tornozelo não deve saltar nem redesenhar o joelho,
  // mesmo numa pose manual além dos limites conservadores do solver.
  if (initialError < 1e-4) return {
    upper: side === 'L' ? rig.legLUpper : rig.legRUpper,
    lower: side === 'L' ? rig.legLLower : rig.legRLower,
    ankle: original, reached: true, error: initialError, limited: 'none',
    distance: Math.hypot(rel.x, rel.y), maxReach: ch.thigh + ch.shin,
  };
  const phi = (upper: number) => (-ch.dir * (upper * ch.k + ch.sitAngle)) * RAD + Math.PI / 2;
  const a = phi(LEG_IK_LIMITS.upperMin);
  const b = phi(LEG_IK_LIMITS.upperMax);
  // A direção do joelho acompanha a vista; o usuário pode inverter explicitamente.
  const sign: 1 | -1 = ((bend === 'forward' ? ch.dir : -ch.dir) > 0 ? 1 : -1);
  const sol = solveTwoBone(rel.x, rel.y, {
    l1: ch.thigh,
    l2: ch.shin,
    bend: sign,
    flexMax: LEG_IK_LIMITS.kneeMax * RAD,
    rootMin: Math.min(a, b),
    rootMax: Math.max(a, b),
    soft: Math.max(0, Number.isFinite(soft) ? soft : 0) * (ch.thigh + ch.shin),
  });
  const upperDeg = (sol.phi1 - Math.PI / 2) * DEG;
  const lowerDeg = sol.flexion * DEG;
  // Exatamente o inverso de legGeometry, incluindo o fator 0.4 da vista frontal.
  const upper = (-ch.dir * upperDeg - ch.sitAngle) / ch.k;
  const lower = (ch.dir * lowerDeg - ch.sitAngle) / ch.k;
  return { upper, lower, ankle: { x: ch.hip.x + sol.end.x, y: ch.hip.y + sol.end.y },
    reached: sol.reached, error: sol.error, limited: sol.limited,
    distance: sol.distance, maxReach: sol.maxReach };
}

/** Blenda determinística. Peso 0: devolve o mesmo rig (compatibilidade). */
export function blendLegIk(rig: Rig, side: LegSide, solution: Pick<LegIkSolution, 'upper' | 'lower'>, weight: number): Rig {
  const w = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  if (w <= 0) return rig;
  const upper = side === 'L' ? 'legLUpper' : 'legRUpper';
  const lower = side === 'L' ? 'legLLower' : 'legRLower';
  const targetUpper = nearestAngle(solution.upper * RAD, rig[upper] * RAD) * DEG;
  return { ...rig,
    [upper]: rig[upper] + (targetUpper - rig[upper]) * w,
    [lower]: rig[lower] + (solution.lower - rig[lower]) * w };
}
