/** Animação própria do objeto (quadros salvos no objeto): modos, função pura do tempo, instâncias e compatibilidade. */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { CustomObjectSchema, ProjectSchema, PropNodeSchema, type CustomObject, type ObjectClip, type Project } from '@/engine/model/schema';
import { createPropNode } from '@/engine/model/factory';
import { createPiece, clipFrameIndex, objectPiecesAt, OBJECT_PREFIX, resolveClip } from '@/engine/world/pieces';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { ensurePropertyTrack, setKeyframe } from '@/engine/model/ops';
import { buildObjectBundle, readObjectBundle } from '@/features/library/bundles';

const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
const clip = (mode: ObjectClip['mode'], ms = [100, 100, 100, 100]): ObjectClip => ({
  id: 'clip_fogo', name: 'Aceso', mode,
  frames: ms.map((d, i) => ({ id: `f${i}`, durationMs: d, pieces: [createPiece('ellipse', { id: `p${i}`, name: 'Chama', fill: COLORS[i % 4]!, x: 0, y: -60, w: 80, h: 120 })] })),
});
const fire = (mode: ObjectClip['mode'] = 'loop'): CustomObject => CustomObjectSchema.parse({ id: 'obj_fogo', name: 'Fogueira', width: 120, height: 140, pieces: [createPiece('rect', { name: 'Lenha', fill: '#7a4a2a' })], clips: [clip(mode)], defaultClip: 'clip_fogo' });

describe('quadro no tempo (função pura)', () => {
  it('loop: repete; tempo negativo também cai num quadro válido', () => {
    const c = clip('loop');
    expect([0, 99, 100, 250, 399, 400, 1234, 1450].map((t) => clipFrameIndex(c, t))).toEqual([0, 0, 1, 2, 3, 0, 0, 2]);
    expect(clipFrameIndex(c, -50)).toBe(3);
  });
  it('uma vez: para no último quadro', () => {
    const c = clip('once');
    expect([0, 150, 399, 400, 9999, -10].map((t) => clipFrameIndex(c, t))).toEqual([0, 1, 3, 3, 3, 0]);
  });
  it('vai e volta: 0 1 2 3 2 1 0 …', () => {
    const c = clip('pingpong');
    expect([0, 100, 200, 300, 400, 500, 600].map((t) => clipFrameIndex(c, t))).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });
  it('durações diferentes por quadro', () => {
    const c = clip('loop', [50, 300, 50, 100]);
    expect([0, 49, 50, 349, 350, 400, 499, 500].map((t) => clipFrameIndex(c, t))).toEqual([0, 0, 1, 1, 2, 3, 3, 0]);
  });
  it('mesmo instante = mesmo quadro, sempre (sem estado acumulado)', () => {
    const c = clip('loop');
    const a = Array.from({ length: 50 }, (_, i) => clipFrameIndex(c, i * 37));
    const b = Array.from({ length: 50 }, (_, i) => clipFrameIndex(c, i * 37)).reverse().reverse();
    expect(a).toEqual(b);
  });
  it('objeto sem animação, animação vazia ou "estático" usam o desenho estático', () => {
    const o = fire();
    expect(objectPiecesAt(o, 'static', 120).frame).toBe(-1);
    expect(objectPiecesAt(o, 'nao-existe', 120).frame).toBe(-1);
    expect(resolveClip({ ...o, clips: [{ ...clip('loop'), frames: [] }] }, '')).toBeNull();
    expect(objectPiecesAt(o, '', 120).frame).toBe(1);
  });
});

function withFires(offsets: number[]): { p: Project; ids: string[] } {
  const p = createDemoProject();
  p.customObjects.obj_fogo = fire();
  const s = p.scenes[p.currentSceneId!]!;
  const ids: string[] = [];
  offsets.forEach((off, i) => {
    const node = PropNodeSchema.parse({ ...createPropNode(OBJECT_PREFIX + 'obj_fogo', { name: `Fogo ${i}` }), clipOffsetMs: off });
    s.nodes[node.id] = node;
    s.layerOrder.push(node.id);
    ids.push(node.id);
  });
  return { p, ids };
}
const framesAt = (p: Project, t: number, ids: string[]) => {
  const svg = planToSvgString(planFrame(p, p.scenes[p.currentSceneId!]!, t, () => undefined), 320, 180);
  return ids.map((id) => {
    const at = svg.indexOf(`data-node-id="${id}"`);
    return Number(/data-obj-frame="(\d+)"/.exec(svg.slice(at))?.[1] ?? -1);
  });
};

describe('na cena e na exportação (planFrame)', () => {
  it('3 instâncias do MESMO objeto, defasagens diferentes, sem nenhum keyframe de desenho', () => {
    const { p, ids } = withFires([0, 100, 250]);
    expect(p.scenes[p.currentSceneId!]!.tracks.filter((t) => t.type === 'property' && ids.includes(t.targetNodeId))).toHaveLength(0);
    expect(framesAt(p, 0, ids)).toEqual([0, 1, 2]);
    expect(framesAt(p, 150, ids)).toEqual([1, 2, 0]);
    expect(framesAt(p, 1000, ids)).toEqual([2, 3, 0]);
  });
  it('buscar fora de ordem dá o mesmo resultado que tocar em sequência', () => {
    const { p, ids } = withFires([0, 70]);
    const times = [0, 33, 66, 100, 133, 500, 1001, 2350];
    const seq = times.map((t) => framesAt(p, t, ids));
    const shuffled = [...times].reverse().map((t) => framesAt(p, t, ids)).reverse();
    expect(shuffled).toEqual(seq);
  });
  it('velocidade por instância', () => {
    const { p, ids } = withFires([0, 0]);
    const n1 = p.scenes[p.currentSceneId!]!.nodes[ids[1]!]!;
    if (n1.kind === 'prop') n1.clipSpeed = 2;
    expect(framesAt(p, 150, ids)).toEqual([1, 3]);
  });
  it('animação acionada por keyframe começa no instante do keyframe', () => {
    const { p, ids } = withFires([0]);
    const s = p.scenes[p.currentSceneId!]!;
    const t = ensurePropertyTrack(s, ids[0]!, 'clip');
    setKeyframe(t, 0, 'static');
    setKeyframe(t, 1000, 'clip_fogo');
    expect(framesAt(p, 500, ids)).toEqual([-1]);
    expect(framesAt(p, 1000, ids)).toEqual([0]);
    expect(framesAt(p, 1150, ids)).toEqual([1]);
  });
});

describe('compatibilidade e portabilidade', () => {
  it('objeto e nó antigos (sem animação) continuam válidos e estáticos', () => {
    const old = CustomObjectSchema.parse({ id: 'o', name: 'Velho', pieces: [] });
    expect(old.clips).toEqual([]);
    expect(old.defaultClip).toBe('');
    const node = PropNodeSchema.parse({ ...createPropNode('obj:o'), clip: undefined, clipSpeed: undefined, clipOffsetMs: undefined });
    expect([node.clip, node.clipSpeed, node.clipOffsetMs]).toEqual(['', 1, 0]);
  });
  it('projeto com animações sobrevive a JSON (como no .jrec) sem perder quadros', () => {
    const { p } = withFires([0, 100]);
    const back = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(back.customObjects.obj_fogo!.clips[0]!.frames).toHaveLength(4);
    expect(back.customObjects.obj_fogo!.defaultClip).toBe('clip_fogo');
  });
  it('pacote da biblioteca leva imagens e objetos usados DENTRO dos quadros', () => {
    const p = createDemoProject();
    const inner = CustomObjectSchema.parse({ id: 'obj_brasa', name: 'Brasa', pieces: [] });
    const o = fire();
    o.clips[0]!.frames[2]!.pieces.push(createPiece('object', { refId: 'obj_brasa' }), createPiece('image', { assetId: 'media_x' }));
    p.customObjects = { obj_fogo: o, obj_brasa: inner };
    p.assets.media_x = { id: 'media_x', kind: 'image', name: 'x.png', mime: 'image/png', size: 1, createdAt: 0, width: 1, height: 1 } as Project['assets'][string];
    const b = buildObjectBundle(p, 'obj_fogo')!;
    expect(b.objects.map((x) => x.id)).toEqual(['obj_brasa']);
    expect(b.assets.map((a) => a.id)).toEqual(['media_x']);
    const read = readObjectBundle(JSON.parse(JSON.stringify(b)));
    expect(read.ok && read.bundle.object.clips[0]!.frames).toHaveLength(4);
  });
  it('limites: duração de quadro e quantidade são validadas', () => {
    expect(CustomObjectSchema.safeParse({ id: 'o', name: 'x', clips: [{ id: 'c', frames: [{ id: 'f', durationMs: 5 }] }] }).success).toBe(false);
    expect(CustomObjectSchema.safeParse({ id: 'o', name: 'x', clips: [{ id: 'c', frames: Array.from({ length: 241 }, (_, i) => ({ id: `f${i}` })) }] }).success).toBe(false);
  });
});
