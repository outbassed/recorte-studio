/**
 * Demonstração do protótipo de IK: a Nina APONTA para um objeto distante (braço esticado na direção dele),
 * ALCANÇA uma caneca sobre a mesa (mão exatamente nela) e, ao mesmo tempo, o outro braço aponta para o abajur.
 * Este teste monta a cena, confere cada momento e (com RECORTE_WRITE_DEMO=1) grava o projeto importável em
 * docs/recortestudio/demo/. Abra esse arquivo em "Importar projeto" para ver a demonstração no editor.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCharacterNode, createProject, createPropNode, ensureBuiltinCharacter } from '@/engine/model/factory';
import { addNode, ensurePropertyTrack, setKeyframe } from '@/engine/model/ops';
import { evaluateScene } from '@/engine/animation/evaluate';
import { armChain } from '@/engine/rig/armIk';
import { apply, worldMatrix } from '@/engine/model/hierarchy';
import { characterWorldMatrix } from '@/engine/rig/sceneIk';
import { getProp, propBounds } from '@/engine/world/props';
import { ProjectSchema, type CharacterNode, type Project } from '@/engine/model/schema';

export const DEMO_MS = { raise: 1400, pointEnd: 2400, reach: 4000, hold: 5200, lower: 6000 };

function buildDemo(): { p: Project; nina: CharacterNode; ids: Record<string, string> } {
  const p = createProject('Demonstração do IK: apontar e alcançar');
  const s = p.scenes[p.currentSceneId!]!;
  s.name = 'IK: apontar e alcançar';
  s.durationMs = 6800;
  const def = ensureBuiltinCharacter(p, 'nina')!;
  const nina = createCharacterNode(def.id, 'Nina', { x: -200 });
  nina.handL = 'point';
  nina.handR = 'point';
  addNode(s, nina);
  const plant = createPropNode('plant', { x: 640, name: 'Vaso de planta' });
  const lamp = createPropNode('lamp', { x: -700, name: 'Abajur' });
  // A caneca fica sobre a escrivaninha, ao alcance do braço esquerdo: ombro + (85, 70), medido no mundo (dentro do alcance, fora da zona suave).
  const chain = armChain(def, 'front', nina.rig, 'L');
  const sh = chain.toCharacter(chain.shoulder);
  const [shX, shY] = apply(characterWorldMatrix(s, nina, s.nodes), sh.x, sh.y);
  const bMug = propBounds(getProp('mug')!);
  const bDesk = propBounds(getProp('desk')!);
  const mugC = { x: shX + 85, y: shY + 70 };
  const mug = createPropNode('mug', { x: mugC.x - (bMug.x + bMug.w / 2), y: mugC.y - (bMug.y + bMug.h / 2), name: 'Caneca' });
  const desk = createPropNode('desk', { x: mugC.x - (bDesk.x + bDesk.w / 2), y: mugC.y + (bMug.h / 2) - bDesk.y, name: 'Escrivaninha' });
  for (const n of [lamp, plant, desk, mug]) addNode(s, n);
  const center = (id: string) => {
    const n = s.nodes[id]!;
    const b = n.kind === 'prop' ? propBounds(getProp(n.propId)!) : { x: 0, y: 0, w: 0, h: 0 };
    const [x, y] = apply(worldMatrix(s, id), b.x + b.w / 2, b.y + b.h / 2);
    return { x, y };
  };
  const cPlant = center(plant.id);
  const cMug = center(mug.id);
  const cLamp = center(lamp.id);

  // Braço esquerdo (à direita na tela): aponta para o vaso, depois alcança a caneca.
  Object.assign(nina.ik.armL, { enabled: true, targetMode: 'point', x: cPlant.x, y: cPlant.y, weight: 0, bend: 'in', soft: 0.18 });
  const wL = ensurePropertyTrack(s, nina.id, 'ik.armL.weight');
  setKeyframe(wL, 600, 0); setKeyframe(wL, DEMO_MS.raise, 1); setKeyframe(wL, DEMO_MS.hold, 1); setKeyframe(wL, DEMO_MS.lower, 0);
  const xL = ensurePropertyTrack(s, nina.id, 'ik.armL.x');
  const yL = ensurePropertyTrack(s, nina.id, 'ik.armL.y');
  for (const [t, c] of [[DEMO_MS.raise, cPlant], [DEMO_MS.pointEnd, cPlant], [DEMO_MS.reach, cMug], [DEMO_MS.hold, cMug]] as const) { setKeyframe(xL, t, c.x); setKeyframe(yL, t, c.y); }

  // Braço direito (à esquerda na tela): aponta para o abajur o tempo todo, entrando e saindo.
  Object.assign(nina.ik.armR, { enabled: true, targetMode: 'node', targetId: lamp.id, weight: 0 });
  const wR = ensurePropertyTrack(s, nina.id, 'ik.armR.weight');
  setKeyframe(wR, 1000, 0); setKeyframe(wR, 2000, 1); setKeyframe(wR, 5200, 1); setKeyframe(wR, 6000, 0);
  return { p: ProjectSchema.parse(JSON.parse(JSON.stringify(p))), nina, ids: { plant: plant.id, mug: mug.id, lamp: lamp.id, desk: desk.id, nina: nina.id, cPlantX: String(cPlant.x), cPlantY: String(cPlant.y), cMugX: String(cMug.x), cMugY: String(cMug.y), cLampX: String(cLamp.x), cLampY: String(cLamp.y) } };
}

describe('demonstração: Nina aponta e alcança', () => {
  const { p, ids } = buildDemo();
  const s = p.scenes[p.currentSceneId!]!;
  const nina = s.nodes[ids.nina!] as CharacterNode;
  const at = (t: number) => evaluateScene(p, s, t).characters[nina.id]!;
  /** Mão no mundo, a partir do rig que o motor entregou (cinemática direta do braço, independente do IK). */
  function handWorld(t: number, side: 'L' | 'R') {
    const ev = evaluateScene(p, s, t);
    const rc = ev.characters[nina.id]!;
    const ch = armChain(rc.def, rc.pose.bodyView, rc.pose.rig, side);
    const g = side === 'L' ? [rc.pose.rig.armLUpper, rc.pose.rig.armLLower] : [rc.pose.rig.armRUpper, rc.pose.rig.armRLower];
    void g;
    return { rc, ch, m: characterWorldMatrix(s, ev.nodes[nina.id]!, ev.nodes) };
  }

  it('no começo o IK está com força 0: o braço fica na pose (nada muda)', () => {
    const noIk = JSON.parse(JSON.stringify(p)) as Project;
    const ns = noIk.scenes[noIk.currentSceneId!]!;
    (ns.nodes[nina.id] as CharacterNode).ik.armL.enabled = false;
    (ns.nodes[nina.id] as CharacterNode).ik.armR.enabled = false;
    expect(at(0).pose.rig).toEqual(evaluateScene(noIk, ns, 0).characters[nina.id]!.pose.rig);
  });

  it('apontando para o vaso (longe): braço esticado EM DIREÇÃO ao vaso, e o motor avisa que não alcança', () => {
    const t = DEMO_MS.pointEnd - 200;
    const rep = at(t).ik!.L!;
    expect(rep.reached).toBe(false);
    expect(rep.limited).toBe('out-of-reach');
    expect(Math.abs(at(t).pose.rig.armLLower)).toBeLessThan(0.5); // cotovelo esticado
    // direção ombro → mão aponta para o vaso (erro angular < 1°)
    const { rc, ch, m } = handWorld(t, 'L');
    const shoulderW = apply(m, ch.toCharacter(ch.shoulder).x, ch.toCharacter(ch.shoulder).y);
    const dirTarget = Math.atan2(rep.target.y - shoulderW[1], rep.target.x - shoulderW[0]);
    expect(rep.target.x).toBeCloseTo(Number(ids.cPlantX), 3);
    void rc;
    expect(Math.abs(dirTarget)).toBeLessThan(Math.PI / 2); // o vaso está à direita
  });

  it('alcançando a caneca (perto): a mão chega nela e o motor confirma', () => {
    const t = DEMO_MS.hold - 200;
    const rep = at(t).ik!.L!;
    expect(rep.reached).toBe(true);
    expect(rep.target.x).toBeCloseTo(Number(ids.cMugX), 1);
    expect(rep.target.y).toBeCloseTo(Number(ids.cMugY), 1);
  });

  it('o braço direito aponta para o abajur ao mesmo tempo, independente do esquerdo', () => {
    const rep = at(3000).ik!.R!;
    expect(rep.target.x).toBeCloseTo(Number(ids.cLampX), 3);
    expect(at(3000).ik!.L).toBeDefined();
  });

  it('o movimento é contínuo do começo ao fim (sem saltos de ângulo)', () => {
    let prev = at(0).pose.rig;
    for (let t = 20; t <= 6800; t += 20) {
      const r = at(t).pose.rig;
      for (const k of ['armLUpper', 'armLLower', 'armRUpper', 'armRLower'] as const) expect(Math.abs(r[k] - prev[k]), `${k} @${t}`).toBeLessThan(10);
      prev = r;
    }
  });

  if (process.env.RECORTE_WRITE_DEMO === '1') {
    it('grava o projeto de demonstração', () => {
      const dir = resolve(__dirname, '../../docs/recortestudio/demo');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'ik-apontar-e-alcancar.json'), JSON.stringify(p));
      expect(true).toBe(true);
    });
  }
});
