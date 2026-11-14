/**
 * IK de braço na CENA: do campo `ik` do personagem até o SVG que a prévia e a exportação desenham.
 * A conferência final é independente do código do IK: lê as transformações do SVG gerado e mede onde a mão ficou.
 */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { createPropNode } from '@/engine/model/factory';
import { ensurePropertyTrack, setKeyframe } from '@/engine/model/ops';
import { evaluateScene } from '@/engine/animation/evaluate';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { CharacterNodeSchema, ProjectSchema, type CharacterNode, type Project, type Scene } from '@/engine/model/schema';
import { armChain } from '@/engine/rig/armIk';
import { characterWorldMatrix } from '@/engine/rig/sceneIk';
import { apply } from '@/engine/model/hierarchy';
import { groupNodes } from '@/engine/model/ops';
import { propBounds, getProp } from '@/engine/world/props';
import { buildJrec, parseEntries } from '@/features/projects/jrec';
import { extractZip } from '@/features/projects/archive';
import { applyM, chainOf, drawnHandIn, parseSvg } from './helpers/drawn';

function setup() {
  const p = createDemoProject();
  const s = p.scenes[p.currentSceneId!]!;
  const chars = Object.values(s.nodes).filter((n): n is CharacterNode => n.kind === 'character');
  const nina = chars.find((c) => c.name === 'Nina') ?? chars[0]!;
  return { p, s, nina, zeca: chars.find((c) => c.id !== nina.id)! };
}
const frameSvg = (p: Project, s: Scene, t: number) => planToSvgString(planFrame(p, s, t, () => undefined), 64, 36);

/** Onde a mão ficou e onde está o alvo, ambos no espaço do quadro desenhado (lidos do SVG). */
function handVsTarget(p: Project, s: Scene, t: number, nodeId: string, side: 'L' | 'R', target: { x: number; y: number }) {
  const doc = parseSvg(frameSvg(p, s, t));
  const g = doc.querySelector(`g[data-node-id="${nodeId}"]`)!;
  const node = s.nodes[nodeId] as CharacterNode;
  const def = p.characters[node.characterId]!;
  const hand = drawnHandIn(def, g, side);
  // O alvo está no espaço do MUNDO: o do contêiner da câmera, acima de todos os grupos de nós (o filho fica dentro do <g> do grupo).
  let box: Element | null = g.parentElement;
  while (box && box.hasAttribute('data-node-id')) box = box.parentElement;
  const tgt = applyM(chainOf(box, true), target.x, target.y);
  return { hand, tgt, miss: Math.hypot(hand.x - tgt.x, hand.y - tgt.y) };
}
/** Um alvo alcançável: ombro do personagem (no mundo, como o desenho o coloca) + deslocamento no espaço do personagem. */
function reachableTarget(p: Project, s: Scene, node: CharacterNode, side: 'L' | 'R', off: { x: number; y: number }, t = 0) {
  const ev = evaluateScene(p, s, t);
  const rc = ev.characters[node.id]!;
  const ch = armChain(rc.def, rc.pose.bodyView, rc.pose.rig, side);
  const sh = ch.toCharacter(ch.shoulder);
  const [x, y] = apply(characterWorldMatrix(s, ev.nodes[node.id]!, ev.nodes), sh.x + off.x, sh.y + off.y);
  return { x, y };
}
const enable = (node: CharacterNode, side: 'armL' | 'armR', cfg: Partial<CharacterNode['ik']['armL']>) => Object.assign(node.ik[side], { enabled: true }, cfg);

describe('IK na cena: compatibilidade e padrão desligado', () => {
  it('personagem novo nasce com IK desligado nos dois braços', () => {
    const { nina } = setup();
    expect(nina.ik.armL.enabled).toBe(false);
    expect(nina.ik.armR.enabled).toBe(false);
    expect(nina.ik.armL.weight).toBe(1);
  });

  it('projeto/nó ANTIGO sem o campo `ik` abre, avalia e desenha igual (e ganha o padrão desligado ao ler)', () => {
    const { p, s, nina } = setup();
    const baseline = frameSvg(p, s, 1500);
    const json = JSON.parse(JSON.stringify(p));
    for (const sc of Object.values(json.scenes) as Array<{ nodes: Record<string, Record<string, unknown>> }>) for (const n of Object.values(sc.nodes)) delete n.ik;
    expect(JSON.stringify(json)).not.toContain('"ik"');
    const old = ProjectSchema.parse(json);
    const oldScene = old.scenes[old.currentSceneId!]!;
    expect((oldScene.nodes[nina.id] as CharacterNode).ik.armL.enabled).toBe(false);
    expect(frameSvg(old, oldScene, 1500)).toBe(baseline);
    // Mesmo um nó que chegue ao motor SEM o campo (dado mal formado em memória) não quebra nada.
    const raw = JSON.parse(JSON.stringify(s.nodes[nina.id]));
    delete raw.ik;
    const bare = { ...s, nodes: { ...s.nodes, [nina.id]: raw as CharacterNode } };
    expect(() => evaluateScene(p, bare, 1500)).not.toThrow();
    expect(evaluateScene(p, bare, 1500).characters[nina.id]!.pose.rig).toEqual(evaluateScene(p, s, 1500).characters[nina.id]!.pose.rig);
  });

  it('IK desligado (ou com peso 0) não altera o rig, mesmo com alvo configurado, e não aparece em `ik`', () => {
    const { p, s, nina } = setup();
    const base = evaluateScene(p, s, 1200).characters[nina.id]!;
    Object.assign(nina.ik.armL, { x: 300, y: -200, enabled: false });
    expect(evaluateScene(p, s, 1200).characters[nina.id]!.pose.rig).toEqual(base.pose.rig);
    expect(evaluateScene(p, s, 1200).characters[nina.id]!.ik).toBeUndefined();
    enable(nina, 'armL', { weight: 0 });
    expect(evaluateScene(p, s, 1200).characters[nina.id]!.pose.rig).toEqual(base.pose.rig);
  });

  it('IK só mexe no braço ligado: o outro braço e o resto do rig ficam iguais', () => {
    const { p, s, nina } = setup();
    const before = evaluateScene(p, s, 900).characters[nina.id]!.pose.rig;
    const t = reachableTarget(p, s, nina, 'L', { x: 70, y: 40 }, 900);
    enable(nina, 'armL', { x: t.x, y: t.y });
    const after = evaluateScene(p, s, 900).characters[nina.id]!.pose.rig;
    expect(after.armLUpper).not.toBeCloseTo(before.armLUpper, 1);
    for (const k of Object.keys(before) as Array<keyof typeof before>) {
      if (k === 'armLUpper' || k === 'armLLower') continue;
      expect(after[k], k).toBe(before[k]);
    }
  });
});

describe('IK na cena: a mão desenhada (SVG da prévia/exportação) chega ao alvo no mundo', () => {
  const variants: Array<{ name: string; tweak: (p: Project, s: Scene, n: CharacterNode) => void }> = [
    { name: 'personagem solto, escala 1', tweak: () => undefined },
    { name: 'escala 1,35 e rotação 25°', tweak: (_p, _s, n) => Object.assign(n.transform, { scaleX: 1.35, scaleY: 1.35, rotationDeg: 25 }) },
    { name: 'espelhado (escala X negativa)', tweak: (_p, _s, n) => Object.assign(n.transform, { scaleX: -1, scaleY: 1 }) },
    { name: 'com pivô deslocado e rotação', tweak: (_p, _s, n) => Object.assign(n.transform, { pivotX: 30, pivotY: -120, rotationDeg: -40 }) },
    { name: 'dentro de um grupo girado e escalado', tweak: (_p, s, n) => { const other = Object.values(s.nodes).find((x) => x.kind === 'character' && x.id !== n.id)!; const g = groupNodes(s, [n.id, other.id], 'Grupo')!; Object.assign(s.nodes[g]!.transform, { x: 120, y: -40, rotationDeg: 20, scaleX: 1.2, scaleY: 1.2 }); } },
    { name: 'com escala de profundidade (perspectiva)', tweak: (_p, s, n) => { Object.assign(s.perspective, { enabled: true, strength: 0.0012, refY: 300 }); n.useDepthScale = true; n.transform.y = 480; } },
  ];
  for (const v of variants) {
    it(v.name, () => {
      const { p, s, nina } = setup();
      v.tweak(p, s, nina);
      for (const side of ['L', 'R'] as const) {
        for (const off of [{ x: 70, y: 35 }, { x: -60, y: -55 }, { x: 20, y: 90 }]) {
          for (const bend of ['in', 'out'] as const) {
            const key = side === 'L' ? 'armL' : 'armR';
            Object.assign(nina.ik.armL, { enabled: false });
            Object.assign(nina.ik.armR, { enabled: false });
            const t = reachableTarget(p, s, nina, side, off);
            enable(nina, key, { x: t.x, y: t.y, bend });
            const r = evaluateScene(p, s, 600).characters[nina.id]!.ik![side]!;
            const { miss } = handVsTarget(p, s, 600, nina.id, side, t);
            if (r.reached) expect(miss, `${side} ${bend} ${JSON.stringify(off)}`).toBeLessThan(1.2 * Math.max(1, Math.abs(nina.transform.scaleX)));
          }
        }
      }
    });
  }

  it('os dois braços ao mesmo tempo, cada um no seu alvo', () => {
    const { p, s, nina } = setup();
    const tl = reachableTarget(p, s, nina, 'L', { x: 80, y: -40 });
    const tr = reachableTarget(p, s, nina, 'R', { x: -80, y: -60 });
    enable(nina, 'armL', { x: tl.x, y: tl.y });
    enable(nina, 'armR', { x: tr.x, y: tr.y });
    expect(handVsTarget(p, s, 300, nina.id, 'L', tl).miss).toBeLessThan(1.2);
    expect(handVsTarget(p, s, 300, nina.id, 'R', tr).miss).toBeLessThan(1.2);
  });
});

describe('IK na cena: alvo que é outro elemento, tempo e animação', () => {
  it('a mão acompanha um objeto que se move (alvo = elemento), em vários instantes', () => {
    const { p, s, nina } = setup();
    const chair = createPropNode('chair', { x: nina.transform.x + 120, y: nina.transform.y - 180 });
    s.nodes[chair.id] = chair;
    s.layerOrder.unshift(chair.id);
    const kx = ensurePropertyTrack(s, chair.id, 'transform.x');
    const ky = ensurePropertyTrack(s, chair.id, 'transform.y');
    setKeyframe(kx, 0, chair.transform.x); setKeyframe(kx, 3000, chair.transform.x + 60);
    setKeyframe(ky, 0, chair.transform.y); setKeyframe(ky, 3000, chair.transform.y - 70);
    enable(nina, 'armL', { targetMode: 'node', targetId: chair.id });
    const b = propBounds(getProp('chair')!);
    for (const t of [0, 800, 1500, 2300, 3000]) {
      const ev = evaluateScene(p, s, t);
      const c = ev.nodes[chair.id]!.transform;
      const center = { x: c.x + b.x + b.w / 2, y: c.y + b.y + b.h / 2 };
      const rep = ev.characters[nina.id]!.ik!.L!;
      expect(rep.target.x).toBeCloseTo(center.x, 6);
      expect(rep.target.y).toBeCloseTo(center.y, 6);
      if (rep.reached) expect(handVsTarget(p, s, t, nina.id, 'L', center).miss).toBeLessThan(1.2);
    }
  });

  it('alvo inexistente, o próprio personagem ou objeto segurado: o braço fica no rig (sem erro)', () => {
    const { p, s, nina } = setup();
    const base = evaluateScene(p, s, 700).characters[nina.id]!.pose.rig;
    for (const targetId of [null, 'nao-existe', nina.id]) {
      Object.assign(nina.ik.armL, { enabled: true, targetMode: 'node', targetId });
      const r = evaluateScene(p, s, 700).characters[nina.id]!;
      expect(r.pose.rig).toEqual(base);
      expect(r.ik).toBeUndefined();
    }
    const cup = createPropNode('chair', { x: 0, y: 0 });
    cup.heldBy = `${nina.id}:R`;
    s.nodes[cup.id] = cup;
    Object.assign(nina.ik.armL, { targetId: cup.id });
    expect(evaluateScene(p, s, 700).characters[nina.id]!.pose.rig).toEqual(base);
  });

  it('força do IK animada 0 → 1: começa no rig, termina no IK, e o caminho é contínuo', () => {
    const { p, s, nina } = setup();
    const t = reachableTarget(p, s, nina, 'L', { x: 90, y: -30 });
    enable(nina, 'armL', { x: t.x, y: t.y, weight: 0 });
    const w = ensurePropertyTrack(s, nina.id, 'ik.armL.weight');
    setKeyframe(w, 1000, 0);
    setKeyframe(w, 3000, 1);
    const noIk = (() => { const c = JSON.parse(JSON.stringify(p)) as Project; const cs = c.scenes[c.currentSceneId!]!; (cs.nodes[nina.id] as CharacterNode).ik.armL.enabled = false; return evaluateScene(c, cs, 1000).characters[nina.id]!.pose.rig; })();
    expect(evaluateScene(p, s, 1000).characters[nina.id]!.pose.rig.armLUpper).toBeCloseTo(noIk.armLUpper, 1);
    const end = evaluateScene(p, s, 3000).characters[nina.id]!;
    expect(end.ik!.L!.reached).toBe(true);
    const mid = evaluateScene(p, s, 2000).characters[nina.id]!.pose.rig.armLUpper;
    const a = evaluateScene(p, s, 1000).characters[nina.id]!.pose.rig.armLUpper;
    const z = end.pose.rig.armLUpper;
    expect(Math.min(a, z) - 1e-6).toBeLessThanOrEqual(mid);
    expect(Math.max(a, z) + 1e-6).toBeGreaterThanOrEqual(mid);
    let prev = a;
    let worst = 0;
    for (let ms = 1000; ms <= 3000; ms += 20) {
      const u = evaluateScene(p, s, ms).characters[nina.id]!.pose.rig.armLUpper;
      worst = Math.max(worst, Math.abs(u - prev));
      prev = u;
    }
    expect(worst).toBeLessThan(2.5); // graus por 20 ms
  });

  it('o alvo X/Y animado por keyframes move o braço continuamente', () => {
    const { p, s, nina } = setup();
    const t0 = reachableTarget(p, s, nina, 'R', { x: -90, y: 60 });
    const t1 = reachableTarget(p, s, nina, 'R', { x: -70, y: -90 });
    enable(nina, 'armR', { x: t0.x, y: t0.y });
    const kx = ensurePropertyTrack(s, nina.id, 'ik.armR.x');
    const ky = ensurePropertyTrack(s, nina.id, 'ik.armR.y');
    setKeyframe(kx, 0, t0.x); setKeyframe(kx, 2000, t1.x);
    setKeyframe(ky, 0, t0.y); setKeyframe(ky, 2000, t1.y);
    for (const ms of [0, 500, 1000, 1500, 2000]) {
      const u = ms / 2000;
      const tgt = { x: t0.x + (t1.x - t0.x) * u, y: t0.y + (t1.y - t0.y) * u };
      const rep = evaluateScene(p, s, ms).characters[nina.id]!.ik!.R!;
      expect(rep.target.x).toBeCloseTo(tgt.x, 3);
      if (rep.reached) expect(handVsTarget(p, s, ms, nina.id, 'R', tgt).miss).toBeLessThan(1.2);
    }
  });

  it('sem histórico: avaliar o instante T direto dá o mesmo resultado que depois de percorrer a cena (seek)', () => {
    const { p, s, nina } = setup();
    const t = reachableTarget(p, s, nina, 'L', { x: 80, y: 20 });
    enable(nina, 'armL', { x: t.x, y: t.y });
    const w = ensurePropertyTrack(s, nina.id, 'ik.armL.weight');
    setKeyframe(w, 0, 0); setKeyframe(w, 4000, 1);
    const direct = JSON.stringify(evaluateScene(p, s, 2750).characters[nina.id]);
    for (let ms = 0; ms <= 6000; ms += 130) evaluateScene(p, s, ms);
    for (let ms = 6000; ms >= 0; ms -= 410) evaluateScene(p, s, ms);
    expect(JSON.stringify(evaluateScene(p, s, 2750).characters[nina.id])).toBe(direct);
    // e prévia = exportação: o mesmo plano gera sempre o mesmo SVG
    expect(frameSvg(p, s, 2750)).toBe(frameSvg(p, s, 2750));
  });

  it('alvo fora do alcance: o braço estica, o resultado informa e nada vira NaN', () => {
    const { p, s, nina } = setup();
    enable(nina, 'armL', { x: nina.transform.x + 5000, y: nina.transform.y - 100 });
    const r = evaluateScene(p, s, 400).characters[nina.id]!;
    expect(r.ik!.L!.reached).toBe(false);
    expect(r.ik!.L!.limited).toBe('out-of-reach');
    expect(r.ik!.L!.error).toBeGreaterThan(100);
    for (const v of Object.values(r.pose.rig)) expect(Number.isFinite(v)).toBe(true);
    expect(frameSvg(p, s, 400)).not.toContain('NaN');
  });

  it('personagem com escala 0 (sem área) não quebra: o braço fica no rig', () => {
    const { p, s, nina } = setup();
    Object.assign(nina.transform, { scaleX: 0, scaleY: 0 });
    enable(nina, 'armL', { x: 10, y: 10 });
    expect(() => evaluateScene(p, s, 0)).not.toThrow();
    expect(evaluateScene(p, s, 0).characters[nina.id]!.ik).toBeUndefined();
  });
});

describe('IK: dados do usuário (.jrec, esquema) preservados', () => {
  it('salvar e abrir um .jrec mantém a configuração de IK, as animações dela e o desenho', async () => {
    const { p, s, nina } = setup();
    const t = reachableTarget(p, s, nina, 'L', { x: 80, y: -20 });
    enable(nina, 'armL', { x: t.x, y: t.y, bend: 'out', weight: 0.8 });
    const w = ensurePropertyTrack(s, nina.id, 'ik.armL.weight');
    setKeyframe(w, 0, 0); setKeyframe(w, 2000, 1);
    const before = frameSvg(p, s, 1234);
    const { blob } = await buildJrec(p, { getBlob: async () => undefined, allowMissing: true });
    const parsed = await parseEntries(extractZip(new Uint8Array(await blob.arrayBuffer())));
    if (parsed.kind === 'media') throw new Error('esperava um projeto');
    const back = parsed.project;
    const bs = back.scenes[back.currentSceneId!]!;
    const bn = bs.nodes[nina.id] as CharacterNode;
    expect(bn.ik.armL).toMatchObject({ enabled: true, bend: 'out', weight: 0.8, targetMode: 'point' });
    expect(bn.ik.armL.x).toBeCloseTo(t.x, 6);
    expect(bs.tracks.some((tr) => tr.type === 'property' && tr.targetNodeId === nina.id && tr.propertyPath === 'ik.armL.weight')).toBe(true);
    expect(frameSvg(back, bs, 1234)).toBe(before);
  });

  it('valores inválidos no `ik` são recusados pelo esquema (nunca entram no motor)', () => {
    const { nina } = setup();
    const raw = JSON.parse(JSON.stringify(nina));
    raw.ik.armL.x = 'abc';
    expect(CharacterNodeSchema.safeParse(raw).success).toBe(false);
    raw.ik.armL.x = 1;
    raw.ik.armL.bend = 'diagonal';
    expect(CharacterNodeSchema.safeParse(raw).success).toBe(false);
    raw.ik.armL.bend = 'in';
    raw.ik.armL.weight = Infinity;
    expect(CharacterNodeSchema.safeParse(raw).success).toBe(false);
  });
});
