/**
 * Custo do IK (Node, sem navegador): resolver um braço e avaliar a cena com IK ligado × desligado.
 * Os limites são largos de propósito (evitam teste instável); os números reais saem com RECORTE_WRITE_PERF=1
 * em docs/recortestudio/desempenho-ik-node.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { evaluateScene } from '@/engine/animation/evaluate';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { BUILTIN_CHARACTERS, poseRig } from '@/engine/character/presets';
import { solveArmIk } from '@/engine/rig/armIk';
import { solveTwoBone } from '@/engine/rig/ik2d';
import type { CharacterNode, Project } from '@/engine/model/schema';

const now = () => performance.now();
const results: Record<string, number | string> = { node: process.version };

describe('desempenho do IK (Node)', () => {
  it('núcleo: resolver um braço de dois ossos', () => {
    const N = 2_000_000;
    let acc = 0;
    const t0 = now();
    for (let i = 0; i < N; i++) acc += solveTwoBone(Math.cos(i) * 120, Math.sin(i) * 120, { l1: 76, l2: 87, bend: 1, flexMax: 2.6, soft: 10 }).error;
    const us = ((now() - t0) / N) * 1000;
    results['solveTwoBone_us'] = Number(us.toFixed(3));
    expect(Number.isFinite(acc)).toBe(true);
    expect(us).toBeLessThan(20); // folga enorme: o real é uma fração de microssegundo
  });

  it('adaptador: resolver o braço do personagem real (geometria + conversão para ângulos do rig)', () => {
    const def = BUILTIN_CHARACTERS[0]!;
    const rig = poseRig('idle');
    const N = 100_000;
    let acc = 0;
    const t0 = now();
    for (let i = 0; i < N; i++) acc += solveArmIk(def, 'front', rig, 'L', { x: Math.cos(i) * 120, y: -200 + Math.sin(i) * 120 }, 'in', 0.1).upper;
    const us = ((now() - t0) / N) * 1000;
    results['solveArmIk_us'] = Number(us.toFixed(3));
    expect(Number.isFinite(acc)).toBe(true);
    expect(us).toBeLessThan(200);
  });

  it('cena: avaliar o quadro com IK desligado × ligado nos dois braços', () => {
    const mk = (ik: boolean): { p: Project; id: string } => {
      const p = createDemoProject();
      const s = p.scenes[p.currentSceneId!]!;
      const nina = Object.values(s.nodes).find((n): n is CharacterNode => n.kind === 'character' && n.name === 'Nina')!;
      if (ik) for (const arm of ['armL', 'armR'] as const) Object.assign(nina.ik[arm], { enabled: true, x: -150 + (arm === 'armL' ? 90 : -90), y: 80, soft: 0.1 });
      return { p, id: nina.id };
    };
    const measure = (ik: boolean) => {
      const { p } = mk(ik);
      const s = p.scenes[p.currentSceneId!]!;
      for (let i = 0; i < 200; i++) evaluateScene(p, s, i * 33); // aquecimento
      const N = 3000;
      const t0 = now();
      for (let i = 0; i < N; i++) evaluateScene(p, s, (i * 33) % 9000);
      return ((now() - t0) / N) * 1000;
    };
    const off = measure(false);
    const on = measure(true);
    results['evaluateScene_off_us'] = Number(off.toFixed(1));
    results['evaluateScene_on_us'] = Number(on.toFixed(1));
    results['evaluateScene_overhead_us'] = Number((on - off).toFixed(1));
    expect(on - off).toBeLessThan(500); // o IK de dois braços custa muito menos de 0,5 ms por quadro
  });

  it('quadro completo (avaliar + planejar + SVG) com IK ligado cabe com folga em 30 fps', () => {
    const { p } = (() => {
      const p = createDemoProject();
      const s = p.scenes[p.currentSceneId!]!;
      const nina = Object.values(s.nodes).find((n): n is CharacterNode => n.kind === 'character' && n.name === 'Nina')!;
      for (const arm of ['armL', 'armR'] as const) Object.assign(nina.ik[arm], { enabled: true, x: -150, y: 80 });
      return { p };
    })();
    const s = p.scenes[p.currentSceneId!]!;
    for (let i = 0; i < 30; i++) planToSvgString(planFrame(p, s, i * 33, () => undefined), 64, 36);
    const N = 300;
    const t0 = now();
    for (let i = 0; i < N; i++) planToSvgString(planFrame(p, s, (i * 33) % 9000, () => undefined), 1920, 1080);
    const ms = (now() - t0) / N;
    results['frame_plan_svg_ms'] = Number(ms.toFixed(2));
    expect(ms).toBeLessThan(33);
  });

  if (process.env.RECORTE_WRITE_PERF === '1') {
    it('grava os números', () => {
      const dir = resolve(__dirname, '../../docs/recortestudio');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'desempenho-ik-node.json'), JSON.stringify(results, null, 1) + '\n');
      expect(Object.keys(results).length).toBeGreaterThan(3);
    });
  }
});
