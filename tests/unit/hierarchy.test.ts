/** Hierarquia pai/filho: matrizes com pivô, vincular/soltar sem salto, ciclos, desagrupar e o barco com passageiros. */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { createPropNode } from '@/engine/model/factory';
import { ensurePropertyTrack, groupNodes, setKeyframe, ungroup } from '@/engine/model/ops';
import { apply, decompose, invert, localMatrix, mul, setParent, worldMatrix, type Mat } from '@/engine/model/hierarchy';
import { evaluateScene } from '@/engine/animation/evaluate';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { ProjectSchema, type CharacterNode, type Project, type Scene } from '@/engine/model/schema';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';
import { OBJECT_PREFIX } from '@/engine/world/pieces';

const close = (a: Mat, b: Mat) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 6));

function setup(): { p: Project; s: Scene; nina: CharacterNode; zeca: CharacterNode; boatId: string } {
  const p = createDemoProject();
  const s = p.scenes[p.currentSceneId!]!;
  const boat = animatedTemplate('barco')!;
  p.customObjects[boat.id] = boat;
  const node = createPropNode(OBJECT_PREFIX + boat.id, { name: 'Barco', y: 300 });
  s.nodes[node.id] = node;
  s.layerOrder.unshift(node.id);
  const chars = Object.values(s.nodes).filter((n): n is CharacterNode => n.kind === 'character');
  return { p, s, nina: chars.find((c) => c.name === 'Nina')!, zeca: chars.find((c) => c.name === 'Zeca')!, boatId: node.id };
}

describe('matrizes 2D', () => {
  it('local = translate · rotate(pivô) · scale, igual ao desenho', () => {
    const m = localMatrix({ x: 10, y: 20, rotationDeg: 90, scaleX: 2, scaleY: 3, pivotX: 5, pivotY: 0 } as CharacterNode['transform']);
    // o pivô (5,0) fica parado no lugar (x+5, y)
    const [px, py] = apply(m, 5 / 2, 0);
    expect(px).toBeCloseTo(15, 6);
    expect(py).toBeCloseTo(20, 6);
  });
  it('decompor e recompor dá a mesma matriz (com pivô e espelhamento)', () => {
    for (const t of [{ x: 3, y: -7, rotationDeg: 33, scaleX: 1.4, scaleY: 1.4, pivotX: 12, pivotY: -30 }, { x: -50, y: 9, rotationDeg: -120, scaleX: -1, scaleY: 2, pivotX: 0, pivotY: 0 }]) {
      const m = localMatrix(t as CharacterNode['transform']);
      const d = decompose(m, t.pivotX, t.pivotY);
      close(localMatrix({ ...t, ...d } as CharacterNode['transform']), m);
    }
  });
});

describe('vincular e soltar sem salto', () => {
  it('vincular a um grupo girado/escalado/deslocado mantém a posição no mundo; soltar também', () => {
    const { s, nina, zeca, boatId } = setup();
    const gid = groupNodes(s, [boatId, zeca.id], 'Barco com gente')!;
    Object.assign(s.nodes[gid]!.transform, { x: 120, y: -40, rotationDeg: 25, scaleX: 1.5, scaleY: 1.5 });
    const before = worldMatrix(s, nina.id);
    expect(setParent(s, nina.id, gid)).toBeNull();
    expect(s.nodes[nina.id]!.parentId).toBe(gid);
    expect((s.nodes[gid] as { children: string[] }).children).toContain(nina.id);
    expect(s.layerOrder).not.toContain(nina.id);
    close(worldMatrix(s, nina.id), before);
    expect(setParent(s, nina.id, null)).toBeNull();
    close(worldMatrix(s, nina.id), before);
    expect(s.layerOrder).toContain(nina.id);
  });
  it('ciclos e alvos inválidos são recusados com explicação', () => {
    const { s, nina, zeca, boatId } = setup();
    const a = groupNodes(s, [boatId, zeca.id], 'A')!;
    const b = groupNodes(s, [a, nina.id], 'B')!;
    expect(setParent(s, b, a)).toMatch(/dentro dele/);
    expect(setParent(s, a, a)).toMatch(/dentro dele/);
    expect(setParent(s, nina.id, zeca.id)).toMatch(/Só grupos/);
  });
  it('desagrupar um grupo girado não faz os filhos pularem (antes somava ângulos sem girar a posição)', () => {
    const { s, nina, zeca } = setup();
    const gid = groupNodes(s, [nina.id, zeca.id])!;
    Object.assign(s.nodes[gid]!.transform, { x: 200, y: 50, rotationDeg: 40, scaleX: 0.8, scaleY: 0.8 });
    const w = [worldMatrix(s, nina.id), worldMatrix(s, zeca.id)];
    ungroup(s, gid);
    close(worldMatrix(s, nina.id), w[0]!);
    close(worldMatrix(s, zeca.id), w[1]!);
  });
  it('desagrupar um grupo que está dentro de outro sobe os filhos um nível (sem mexer nas outras camadas)', () => {
    const { s, nina, zeca, boatId } = setup();
    const inner = groupNodes(s, [nina.id, zeca.id], 'Dentro')!;
    const outer = groupNodes(s, [boatId, inner], 'Fora')!;
    const order = [...s.layerOrder];
    const w = worldMatrix(s, nina.id);
    ungroup(s, inner);
    expect(s.layerOrder).toEqual(order);
    expect((s.nodes[outer] as { children: string[] }).children).toEqual([boatId, nina.id, zeca.id]);
    expect(s.nodes[nina.id]!.parentId).toBe(outer);
    close(worldMatrix(s, nina.id), w);
  });
});

describe('barco com passageiros (mesmo renderizador da exportação)', () => {
  function boatScene() {
    const ctx = setup();
    const { s, nina, zeca, boatId } = ctx;
    const gid = groupNodes(s, [boatId, nina.id, zeca.id], 'Barco com passageiros')!;
    const ty = ensurePropertyTrack(s, gid, 'transform.y');
    setKeyframe(ty, 0, 0); setKeyframe(ty, 1000, -60); setKeyframe(ty, 2000, 0);
    const tr = ensurePropertyTrack(s, gid, 'transform.rotationDeg');
    setKeyframe(tr, 0, -6); setKeyframe(tr, 1000, 6); setKeyframe(tr, 2000, -6);
    return { ...ctx, gid };
  }
  it('o barco move e balança; os passageiros vão junto e mantêm as próprias animações', () => {
    const { p, s, nina, zeca, gid, boatId } = boatScene();
    const at = (t: number) => {
      const r = evaluateScene(p, s, t);
      return { r, wN: worldMatrix(s, nina.id, r.nodes), wB: worldMatrix(s, boatId, r.nodes) };
    };
    const a = at(0);
    const b = at(1000);
    // Barco e passageiros: a posição relativa ao barco não muda (vão juntos).
    const rel = (x: { wN: Mat; wB: Mat }) => mul(invert(x.wB), x.wN);
    close(rel(a), rel(b));
    expect(b.wN[5]).toBeLessThan(a.wN[5] - 20);
    // Locais intactos: o grupo é que se move.
    expect(b.r.nodes[nina.id]!.transform.y).toBe(a.r.nodes[nina.id]!.transform.y);
    expect(b.r.nodes[gid]!.transform.rotationDeg).toBeCloseTo(6, 6);
    // Animações próprias continuam: a demo tem fala da Nina e dança do Zeca; o desenho deles muda no tempo.
    const svg = (t: number) => planToSvgString(planFrame(p, s, t, () => undefined), 640, 360);
    const part = (doc: string, id: string) => doc.slice(doc.indexOf(`data-node-id="${id}"`), doc.indexOf(`data-node-id="${id}"`) + 4000);
    expect(part(svg(800), nina.id)).not.toBe(part(svg(100), nina.id));
    expect(part(svg(5000), zeca.id)).not.toBe(part(svg(3000), zeca.id));
    // No SVG final, os passageiros ficam DENTRO do grupo.
    const doc = svg(1000);
    const g = doc.indexOf(`data-node-id="${gid}"`);
    expect(g).toBeGreaterThan(-1);
    expect(doc.indexOf(`data-node-id="${nina.id}"`)).toBeGreaterThan(g);
  });
  it('buscar fora de ordem e salvar/reabrir dão o mesmo quadro', () => {
    const { p, s } = boatScene();
    const times = [0, 333, 1000, 1500, 2000, 777];
    const seq = times.map((t) => planToSvgString(planFrame(p, s, t, () => undefined), 320, 180));
    const reopened = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    const s2 = reopened.scenes[reopened.currentSceneId!]!;
    const again = [...times].reverse().map((t) => planToSvgString(planFrame(reopened, s2, t, () => undefined), 320, 180)).reverse();
    expect(again).toEqual(seq);
  });
});
