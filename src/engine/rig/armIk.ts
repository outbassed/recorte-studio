/**
 * Adaptador do IK de dois ossos (`ik2d.ts`) para o braço do rig EXISTENTE.
 *
 * Não muda o desenho nem o modelo de ângulos do rig: o IK só calcula `armXUpper` e `armXLower` (em graus, as mesmas
 * unidades de sempre) a partir de um ponto-alvo. O resultado entra no rig como qualquer outro valor, então preview,
 * exportação e objetos segurados continuam usando o mesmo caminho (`renderCharacter`).
 *
 * Geometria reaproveitada do renderizador (nada reescrito): comprimentos de `bodyMetrics`, ombro e ângulos de
 * `armGeometry`, quadril de `hipLayout`, inclinação do tronco de `torsoLeanDeg` e respiração de `breathScale`.
 * A "ponta" do braço é a mesma usada por objetos segurados (`forearm + 1,2 × raio da mão`).
 */
import type { CharacterDefinition, Rig, ViewId } from '../model/schema';
import { armGeometry, bodyMetrics, breathScale, handSizeOf, hipLayout, torsoLeanDeg } from '../character/render';
import { viewInfo } from '../character/views';
import { solveTwoBone, nearestAngle, type IkLimit, type Vec2 } from './ik2d';

export type ArmSide = 'L' | 'R';
export type ElbowBend = 'in' | 'out';

/** Limites do braço humano estilizado, em graus do rig (não impedem o rig manual: valem só para a solução do IK). */
export const ARM_IK_LIMITS = {
  /** `armXUpper`: do braço levemente atrás do corpo (-100°) até acima da cabeça (180°). */
  upperMin: -100,
  upperMax: 180,
  /** `armXLower`: o antebraço dobra até 150° para o lado escolhido em `bend`. */
  lowerMax: 150,
} as const;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface ArmChain {
  /** ombro no espaço do tronco (sem escala), onde o IK trabalha */
  shoulder: Vec2;
  /** comprimentos: braço e antebraço + mão */
  l1: number;
  l2: number;
  /** lado para onde o membro abre nesta vista (±1) e a folga de repouso do rig */
  side: number;
  rest: number;
  /** espaço do personagem (pés = origem, y para baixo) ↔ espaço do tronco sem escala */
  toTorso(p: Vec2): Vec2;
  toCharacter(p: Vec2): Vec2;
}

export function armChain(def: CharacterDefinition, bodyView: ViewId, rig: Rig, name: ArmSide): ArmChain {
  const m = bodyMetrics(def);
  const v = viewInfo(bodyView);
  const { hipY } = hipLayout(m, v, rig);
  const g = armGeometry(m, v, rig, name);
  const shoulderY = -m.torso + 18;
  const lean = torsoLeanDeg(def, v, rig) * RAD;
  const [sx, sy] = breathScale(rig);
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const origin = { x: 0, y: hipY - rig.bodyY };
  return {
    shoulder: { x: g.x, y: shoulderY },
    l1: m.upperArm,
    l2: m.forearm + handSizeOf(def) * 1.2,
    side: g.side,
    rest: g.rest,
    // Grupo do tronco: translate(origem) · rotate(lean) · scale(breath). Inverso: desfaz nessa ordem.
    toTorso: (p) => {
      const dx = p.x - origin.x;
      const dy = p.y - origin.y;
      return { x: (dx * c + dy * s) / sx, y: (-dx * s + dy * c) / sy };
    },
    toCharacter: (p) => {
      const x = p.x * sx;
      const y = p.y * sy;
      return { x: origin.x + x * c - y * s, y: origin.y + x * s + y * c };
    },
  };
}

export interface ArmIkSolution {
  /** ângulos do rig que levam a mão ao alvo (graus), antes de misturar com o rig atual */
  upper: number;
  lower: number;
  /** alvo e mão resultante, em coordenadas do personagem */
  target: Vec2;
  hand: Vec2;
  reached: boolean;
  /** distância (no espaço do tronco) entre a mão e o alvo depois de resolver */
  error: number;
  limited: IkLimit;
  /** alcance do braço (min/máx) e distância pedida, no espaço do tronco */
  distance: number;
  minReach: number;
  maxReach: number;
}

/** Calcula `armXUpper`/`armXLower` para a mão alcançar `target` (coordenadas do personagem). Função pura. */
export function solveArmIk(def: CharacterDefinition, bodyView: ViewId, rig: Rig, name: ArmSide, target: Vec2, bend: ElbowBend): ArmIkSolution {
  const ch = armChain(def, bodyView, rig, name);
  const t = ch.toTorso(target);
  const rel = { x: t.x - ch.shoulder.x, y: t.y - ch.shoulder.y };

  // rig → direção SVG: θ1 = −lado·(upper + rest);  φ1 = θ1 + 90°;  flexão = lowerDeg = −lado·lower.
  const phiOfUpper = (u: number) => (-ch.side * (u + ch.rest)) * RAD + Math.PI / 2;
  const a = phiOfUpper(ARM_IK_LIMITS.upperMin);
  const b = phiOfUpper(ARM_IK_LIMITS.upperMax);
  // 'in' = lower ≥ 0  ⇒ flexão tem o sinal de −lado;  'out' = lower ≤ 0 ⇒ sinal de +lado.
  const sign: 1 | -1 = (bend === 'in' ? -ch.side : ch.side) > 0 ? 1 : -1;
  const sol = solveTwoBone(rel.x, rel.y, {
    l1: ch.l1, l2: ch.l2, bend: sign,
    flexMin: 0, flexMax: ARM_IK_LIMITS.lowerMax * RAD,
    rootMin: Math.min(a, b), rootMax: Math.max(a, b),
  });

  const upper = -ch.side * ((sol.phi1 - Math.PI / 2) * DEG) - ch.rest;
  const lower = -ch.side * (sol.flexion * DEG);
  const end = { x: ch.shoulder.x + sol.end.x, y: ch.shoulder.y + sol.end.y };
  return {
    upper, lower, target,
    hand: ch.toCharacter(end),
    reached: sol.reached, error: sol.error, limited: sol.limited,
    distance: sol.distance, minReach: sol.minReach, maxReach: sol.maxReach,
  };
}

/**
 * Mistura a solução do IK com os ângulos que o rig já tinha (pose + keyframes + ações). `weight` 0 devolve o rig
 * intacto; 1 devolve o IK. O ângulo do braço é equivalente módulo 360°, então usa-se o mais próximo do atual:
 * a mistura nunca dá "a volta" ao contrário.
 */
export function blendArmIk(rig: Rig, name: ArmSide, sol: Pick<ArmIkSolution, 'upper' | 'lower'>, weight: number): Rig {
  const w = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  if (w <= 0) return rig;
  const uKey = name === 'L' ? 'armLUpper' : 'armRUpper';
  const lKey = name === 'L' ? 'armLLower' : 'armRLower';
  const cur = { u: rig[uKey], l: rig[lKey] };
  const uTarget = nearestAngle(sol.upper * RAD, cur.u * RAD) * DEG;
  const out = { ...rig };
  out[uKey] = cur.u + (uTarget - cur.u) * w;
  out[lKey] = cur.l + (sol.lower - cur.l) * w;
  return out;
}
