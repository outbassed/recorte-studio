/** Adaptador do IK para o rig existente: a mão desenhada de verdade (renderCharacter) cai no alvo. */
import { describe, expect, it } from 'vitest';
import { renderCharacter, bodyMetrics, type CharacterPose } from '@/engine/character/render';
import type { FaceState } from '@/engine/character/face';
import { BUILTIN_CHARACTERS, poseRig } from '@/engine/character/presets';
import { VIEW_ORDER } from '@/engine/character/views';
import type { Rig } from '@/engine/model/schema';
import { drawnHandIn, parseSvg } from './helpers/drawn';
import { ARM_IK_LIMITS, armChain, blendArmIk, solveArmIk, type ArmSide } from '@/engine/rig/armIk';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const face = { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 } as unknown as FaceState;
const poseOf = (view: (typeof VIEW_ORDER)[number], rig: Rig): CharacterPose => ({ bodyView: view, headView: view, rig, face, handL: 'open', handR: 'open' });

/** Onde a mão foi DESENHADA no SVG do personagem (espaço do personagem). */
const drawnHand = (def: (typeof BUILTIN_CHARACTERS)[number], svg: string, side: ArmSide) => drawnHandIn(def, parseSvg(svg).documentElement, side);
/** Tolerância contra o SVG desenhado: o SVG arredonda ângulos a 0,1° e posições a 0,1 px (`n`), o que dá até ~0,4 px na ponta. */
const DRAW_TOL = 0.5;
const keys = (s: ArmSide) => (s === 'L' ? (['armLUpper', 'armLLower'] as const) : (['armRUpper', 'armRLower'] as const));

describe('IK no braço do rig existente', () => {
  it('a mão DESENHADA (renderCharacter) cai no alvo, em todos os personagens, vistas, braços e cotovelos', () => {
    const r = rng(99);
    let checked = 0;
    for (const def of BUILTIN_CHARACTERS) {
      for (const view of VIEW_ORDER) {
        for (const side of ['L', 'R'] as const) {
          for (const bend of ['in', 'out'] as const) {
            // contexto de rig variado: tronco inclinado, respiração, sentado, corpo elevado
            const base: Rig = { ...poseRig('idle'), torsoLean: (r() - 0.5) * 30, breath: r() * 1.2, sit: r() < 0.3 ? r() : 0, bodyY: r() < 0.3 ? r() * 60 : 0 };
            const ch = armChain(def, view, base, side);
            const reach = ch.l1 + ch.l2;
            // alvo bem dentro do alcance, em volta do ombro (no espaço do personagem)
            const ang = r() * Math.PI * 2;
            const d = reach * (0.45 + r() * 0.5);
            const sh = ch.toCharacter(ch.shoulder);
            const target = { x: sh.x + Math.cos(ang) * d, y: sh.y + Math.sin(ang) * d };
            const sol = solveArmIk(def, view, base, side, target, bend);
            const [kU, kL] = keys(side);
            const rig: Rig = { ...base, [kU]: sol.upper, [kL]: sol.lower };
            const drawn = renderCharacter(def, poseOf(view, rig), def.id);
            const hand = drawnHand(def, drawn.svg, side);
            // a mão prevista pelo IK é exatamente a que o desenho coloca (com tronco inclinado, respiração, sentado...)
            // O SVG arredonda a 0,1° e 0,1 px: diferença máxima de poucos décimos de pixel, invisível.
            expect(Math.hypot(sol.hand.x - hand.x, sol.hand.y - hand.y), `${def.id} ${view} ${side} ${bend}`).toBeLessThan(DRAW_TOL);
            if (sol.reached) {
              expect(Math.hypot(hand.x - target.x, hand.y - target.y), `${def.id} ${view} ${side} ${bend}`).toBeLessThan(DRAW_TOL);
              checked++;
            } else {
              expect(sol.limited).not.toBe('none');
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(BUILTIN_CHARACTERS.length * 8 * 4 * 0.4); // a maioria dos alvos é alcançável
  });

  it('a solução respeita os limites do braço (ombro e cotovelo) e o lado do cotovelo pedido', () => {
    const def = BUILTIN_CHARACTERS[0]!;
    const r = rng(4);
    for (const view of VIEW_ORDER) {
      for (const bend of ['in', 'out'] as const) {
        for (let i = 0; i < 100; i++) {
          const rig = poseRig('idle');
          const target = { x: (r() - 0.5) * 700, y: -(r() * 500) };
          const sol = solveArmIk(def, view, rig, 'L', target, bend);
          const e = 1e-6;
          expect(sol.upper).toBeGreaterThanOrEqual(ARM_IK_LIMITS.upperMin - e);
          expect(sol.upper).toBeLessThanOrEqual(ARM_IK_LIMITS.upperMax + e);
          if (bend === 'in') { expect(sol.lower).toBeGreaterThanOrEqual(-e); expect(sol.lower).toBeLessThanOrEqual(ARM_IK_LIMITS.lowerMax + e); }
          else { expect(sol.lower).toBeLessThanOrEqual(e); expect(sol.lower).toBeGreaterThanOrEqual(-ARM_IK_LIMITS.lowerMax - e); }
          for (const v of [sol.upper, sol.lower, sol.hand.x, sol.hand.y, sol.error]) expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it('alvo fora do alcance: braço estica na direção do alvo e informa; alvo dentro: alcança', () => {
    const def = BUILTIN_CHARACTERS[0]!;
    const rig = poseRig('idle');
    const ch = armChain(def, 'front', rig, 'L');
    const sh = ch.toCharacter(ch.shoulder);
    const far = solveArmIk(def, 'front', rig, 'L', { x: sh.x + 900, y: sh.y }, 'in');
    expect(far.reached).toBe(false);
    expect(far.limited).toBe('out-of-reach');
    expect(Math.abs(far.lower)).toBeLessThan(1e-6);
    expect(far.error).toBeGreaterThan(500);
    const closeBy = solveArmIk(def, 'front', rig, 'L', { x: sh.x + 80, y: sh.y + 20 }, 'in');
    expect(closeBy.reached).toBe(true);
    expect(closeBy.limited).toBe('none');
  });

  it('determinismo e ausência de histórico: mesma entrada, mesma saída, em qualquer ordem', () => {
    const def = BUILTIN_CHARACTERS[1]!;
    const rig = poseRig('hips');
    const targets = Array.from({ length: 50 }, (_, i) => ({ x: -300 + i * 12, y: -350 + ((i * 37) % 200) }));
    const run = (t: { x: number; y: number }) => solveArmIk(def, 'front-right', rig, 'R', t, 'in');
    const a = targets.map(run);
    const b = [...targets].reverse().map(run).reverse();
    expect(b).toEqual(a);
  });

  it('simetria: braço esquerdo e direito, vista de frente, com alvo espelhado em torno do eixo do corpo', () => {
    const def = BUILTIN_CHARACTERS[0]!;
    const rig = poseRig('idle');
    const L = armChain(def, 'front', rig, 'L');
    const R = armChain(def, 'front', rig, 'R');
    expect(Math.abs(L.shoulder.x + R.shoulder.x)).toBeLessThan(1e-9);
    const sl = L.toCharacter(L.shoulder);
    const sr = R.toCharacter(R.shoulder);
    const off = { x: 70, y: 40 };
    const a = solveArmIk(def, 'front', rig, 'L', { x: sl.x + off.x, y: sl.y + off.y }, 'in');
    const b = solveArmIk(def, 'front', rig, 'R', { x: sr.x - off.x, y: sr.y + off.y }, 'in');
    expect(a.upper).toBeCloseTo(b.upper, 6);
    expect(a.lower).toBeCloseTo(b.lower, 6);
  });

  it('o IK acompanha o tronco: inclinar o corpo ou respirar não descola a mão do alvo', () => {
    const def = BUILTIN_CHARACTERS[2]!;
    for (const lean of [-25, 0, 18]) {
      for (const breath of [0, 1.5]) {
        const base: Rig = { ...poseRig('idle'), torsoLean: lean, breath };
        const ch = armChain(def, 'front', base, 'R');
        const sh = ch.toCharacter(ch.shoulder);
        const target = { x: sh.x - 70, y: sh.y - 60 }; // acima e ao lado do ombro, bem dentro do alcance
        const sol = solveArmIk(def, 'front', base, 'R', target, 'in');
        const drawn = renderCharacter(def, poseOf('front', { ...base, armRUpper: sol.upper, armRLower: sol.lower }), def.id);
        const hand = drawnHand(def, drawn.svg, 'R');
        expect(sol.reached).toBe(true);
        expect(Math.hypot(hand.x - target.x, hand.y - target.y)).toBeLessThan(DRAW_TOL);
      }
    }
  });

  it('âncora de objetos segurados (handL/handR): coincide com o desenho só sem tronco inclinado/respiração (aproximação PRÉ-EXISTENTE)', () => {
    const def = BUILTIN_CHARACTERS[0]!;
    const rig = poseRig('point-L');
    const flat = renderCharacter(def, poseOf('front', rig), def.id);
    const d0 = drawnHand(def, flat.svg, 'L');
    expect(Math.hypot(d0.x - flat.handL[0], d0.y - flat.handL[1])).toBeLessThan(DRAW_TOL);
    const lean = renderCharacter(def, poseOf('front', { ...rig, torsoLean: 20 }), def.id);
    const d1 = drawnHand(def, lean.svg, 'L');
    // Hoje a âncora ignora a inclinação do tronco: a diferença é real e fica registrada aqui (ver docs/recortestudio).
    expect(Math.hypot(d1.x - lean.handL[0], d1.y - lean.handL[1])).toBeGreaterThan(10);
  });

  it('mistura: peso 0 devolve o rig intacto, peso 1 devolve o IK, meio-termo fica no caminho curto', () => {
    const rig: Rig = { ...poseRig('idle'), armLUpper: 30, armLLower: 10 };
    const sol = { upper: 100, lower: 60 };
    expect(blendArmIk(rig, 'L', sol, 0)).toBe(rig);
    const full = blendArmIk(rig, 'L', sol, 1);
    expect(full.armLUpper).toBeCloseTo(100, 9);
    expect(full.armLLower).toBeCloseTo(60, 9);
    const half = blendArmIk(rig, 'L', sol, 0.5);
    expect(half.armLUpper).toBeCloseTo(65, 9);
    expect(half.armLLower).toBeCloseTo(35, 9);
    expect(half.armRUpper).toBe(rig.armRUpper); // o outro braço não é tocado
    // equivalente módulo 360°: -260 ≡ 100 e o rig está em 20 → o caminho curto vai para 100, não para -260
    const wrap = blendArmIk({ ...rig, armLUpper: 20 }, 'L', { upper: -260, lower: 0 }, 1);
    expect(wrap.armLUpper).toBeCloseTo(100, 9);
    expect(blendArmIk(rig, 'L', sol, NaN)).toBe(rig);
    expect(blendArmIk(rig, 'L', sol, -3)).toBe(rig);
    expect(blendArmIk(rig, 'L', sol, 9).armLUpper).toBeCloseTo(100, 9);
  });

  it('comprimentos do braço vêm de bodyMetrics (corpo maior alcança mais longe)', () => {
    const small = BUILTIN_CHARACTERS.reduce((a, b) => (bodyMetrics(a).upperArm < bodyMetrics(b).upperArm ? a : b));
    const big = BUILTIN_CHARACTERS.reduce((a, b) => (bodyMetrics(a).upperArm > bodyMetrics(b).upperArm ? a : b));
    const rig = poseRig('idle');
    expect(armChain(big, 'front', rig, 'L').l1).toBeGreaterThan(armChain(small, 'front', rig, 'L').l1);
  });
});
