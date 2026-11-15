/** IK de pernas: geometria comparada com o SVG real, peso, vista, pé fixo e compatibilidade. */
import { describe, expect, it } from 'vitest';
import { bodyMetrics, renderCharacter, type CharacterPose } from '@/engine/character/render';
import { VIEW_ORDER } from '@/engine/character/views';
import { BUILTIN_CHARACTERS, poseRig } from '@/engine/character/presets';
import { createDemoProject } from '@/features/templates/projects';
import { CharacterNodeSchema, ProjectSchema, type CharacterNode, type Rig } from '@/engine/model/schema';
import { evaluateScene } from '@/engine/animation/evaluate';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { characterWorldMatrix } from '@/engine/rig/sceneIk';
import { apply } from '@/engine/model/hierarchy';
import { blendLegIk, footAnkleLocal, legChain, solveLegIk } from '@/engine/rig/legIk';
import { applyM, chainOf, parseSvg } from './helpers/drawn';

const face = { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 };
const poseOf = (view: (typeof VIEW_ORDER)[number], rig: Rig): CharacterPose =>
  ({ bodyView: view, headView: view, rig, face, handL: 'open', handR: 'open' } as CharacterPose);

function drawnAnkle(svg: string, side: 'L' | 'R', shin: number) {
  const root = parseSvg(svg).documentElement;
  const lower = root.querySelector(`g[data-part="leg-${side}"] > g[transform] > g[transform]`);
  if (!lower) throw new Error('canela não encontrada no SVG');
  return applyM(chainOf(lower), 0, shin);
}
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('IK da perna no desenho real', () => {
  it('padrão desligado para os dois pés, inclusive em projetos antigos', () => {
    const node = CharacterNodeSchema.parse({ id: 'a', kind: 'character', name: 'A', characterId: 'teste' });
    expect(node.ik.legL.enabled).toBe(false);
    expect(node.ik.legR.enabled).toBe(false);
    expect(node.ik.legL.weight).toBe(1);
    const old = CharacterNodeSchema.parse({ ...node, ik: { armL: node.ik.armL, armR: node.ik.armR } });
    expect(old.ik.legL.enabled).toBe(false);
    expect(old.ik.legR.enabled).toBe(false);
  });

  it('posição matemática do tornozelo coincide com o SVG em oito vistas, dois lados e diferentes rigs', () => {
    for (const def of BUILTIN_CHARACTERS.slice(0, 5)) for (const view of VIEW_ORDER) {
      for (const rig of [
        { ...poseRig('idle') },
        { ...poseRig('idle'), legLUpper: 26, legLLower: 78, legRUpper: -21, legRLower: -62, sit: 0.3, bodyY: 18 },
        { ...poseRig('idle'), legLUpper: -42, legLLower: -48, legRUpper: 32, legRLower: 85, sit: 0.6, bodyY: 40 },
      ]) {
        const draw = renderCharacter(def, poseOf(view, rig), def.id);
        for (const side of ['L', 'R'] as const) {
          const expected = footAnkleLocal(def, view, rig, side);
          const actual = drawnAnkle(draw.svg, side, bodyMetrics(def).shin);
          expect(distance(expected, actual), `${def.id}/${view}/${side}`).toBeLessThan(0.55);
        }
      }
    }
  });

  it('alvo = pé atual: resolve sem deslocar a perna e sem alterar o outro pé', () => {
    for (const def of BUILTIN_CHARACTERS.slice(0, 5)) for (const view of VIEW_ORDER) for (const side of ['L', 'R'] as const) {
      const base: Rig = { ...poseRig('idle'), legLUpper: 15, legLLower: 75, legRUpper: -17, legRLower: -63, sit: 0.15 };
      const target = footAnkleLocal(def, view, base, side);
      const ch = legChain(def, view, base, side);
      const bend = ch.lowerDeg * ch.dir < 0 ? 'backward' : 'forward';
      const sol = solveLegIk(def, view, base, side, target, bend);
      const rig = blendLegIk(base, side, sol, 1);
      const foot = drawnAnkle(renderCharacter(def, poseOf(view, rig), def.id).svg, side, bodyMetrics(def).shin);
      expect(distance(foot, target), `${def.id}/${view}/${side}`).toBeLessThan(0.65);
      expect(blendLegIk(base, side, sol, 0)).toBe(base);
      const other = side === 'L' ? ['legRUpper', 'legRLower'] as const : ['legLUpper', 'legLLower'] as const;
      expect(rig[other[0]]).toBe(base[other[0]]);
      expect(rig[other[1]]).toBe(base[other[1]]);
    }
  });

  it('alvos distantes têm limite físico, sem NaN ou deslocar o corpo', () => {
    const def = BUILTIN_CHARACTERS[0]!;
    const base = poseRig('idle');
    const sol = solveLegIk(def, 'front', base, 'L', { x: 5000, y: 5000 }, 'forward');
    expect(sol.reached).toBe(false);
    expect(sol.limited).toBe('out-of-reach');
    expect(Number.isFinite(sol.upper) && Number.isFinite(sol.lower)).toBe(true);
    expect(blendLegIk(base, 'L', sol, 1).bodyY).toBe(base.bodyY);
  });

  it('o pé plantado permanece no mundo quando o personagem se move (enquanto alcançável)', () => {
    const p = createDemoProject();
    const s = p.scenes[p.currentSceneId!]!;
    const nina = Object.values(s.nodes).find((n): n is CharacterNode => n.kind === 'character' && n.name === 'Nina')!;
    nina.secondary.enabled = false;
    Object.assign(nina.rig, { legLUpper: 30, legLLower: 95 });
    const before = evaluateScene(p, s, 0);
    const rc = before.characters[nina.id]!;
    const ankle = footAnkleLocal(rc.def, rc.pose.bodyView, rc.pose.rig, 'L');
    const [x, y] = apply(characterWorldMatrix(s, before.nodes[nina.id]!, before.nodes), ankle.x, ankle.y);
    Object.assign(nina.ik.legL, { enabled: true, x, y, weight: 1, bend: 'forward' });
    const locked = evaluateScene(p, s, 0).characters[nina.id]!;
    expect(locked.feet?.L).toBeDefined();
    nina.transform.x += 6;
    const moved = evaluateScene(p, s, 0);
    const next = moved.characters[nina.id]!;
    const local = footAnkleLocal(next.def, next.pose.bodyView, next.pose.rig, 'L');
    const [wx, wy] = apply(characterWorldMatrix(s, moved.nodes[nina.id]!, moved.nodes), local.x, local.y);
    expect(Math.hypot(wx - x, wy - y)).toBeLessThan(1);
    expect(next.feet?.L?.reached).toBe(true);
  });

  it('um projeto antigo sem IK de pernas mantém quadros idênticos', () => {
    const p = createDemoProject();
    const s = p.scenes[p.currentSceneId!]!;
    const before = planToSvgString(planFrame(p, s, 1200, () => undefined), 64, 36);
    const data = JSON.parse(JSON.stringify(p));
    for (const scene of Object.values(data.scenes) as Array<{ nodes: Record<string, Record<string, unknown>> }>)
      for (const n of Object.values(scene.nodes)) {
        const ik = n.ik as Record<string, unknown> | undefined;
        if (ik) { delete ik.legL; delete ik.legR; }
      }
    const old = ProjectSchema.parse(data);
    const oldScene = old.scenes[old.currentSceneId!]!;
    const after = planToSvgString(planFrame(old, oldScene, 1200, () => undefined), 64, 36);
    expect(after).toBe(before);
  });
});
