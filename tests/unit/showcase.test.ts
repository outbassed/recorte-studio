/** Modelos de ambiente e técnicos (Mar e Barco, Acampamento…) e animação de objetos aninhados. */
import { describe, expect, it } from 'vitest';
import { createFromProjectTemplate, PROJECT_TEMPLATES } from '@/features/templates/projects';
import { SHOWCASE_TEMPLATES } from '@/features/templates/showcase';
import { ProjectSchema, CustomObjectSchema, type Project, type Scene } from '@/engine/model/schema';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { allPieceLists, createPiece, OBJECT_PREFIX, renderCustomObject } from '@/engine/world/pieces';
import { renderComposition } from '@/engine/world/customBackgrounds';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';
import { createDemoProject } from '@/features/templates/projects';
import { worldMatrix } from '@/engine/model/hierarchy';
import { evaluateScene } from '@/engine/animation/evaluate';

const scene0 = (p: Project): Scene => p.scenes[p.currentSceneId!]!;
const svgAt = (p: Project, t: number) => planToSvgString(planFrame(p, scene0(p), t, () => undefined), 640, 360);

describe('todos os modelos novos', () => {
  for (const t of SHOWCASE_TEMPLATES) {
    it(`${t.name}: válido, sem referência quebrada, renderiza em vários instantes`, () => {
      const p = createFromProjectTemplate(t.id);
      expect(ProjectSchema.safeParse(JSON.parse(JSON.stringify(p))).success).toBe(true);
      expect(t.whatToTest.length).toBeGreaterThan(0);
      for (const s of Object.values(p.scenes)) {
        for (const n of Object.values(s.nodes)) {
          if (n.kind === 'prop' && n.propId.startsWith(OBJECT_PREFIX)) expect(p.customObjects[n.propId.slice(OBJECT_PREFIX.length)], n.name).toBeTruthy();
          if (n.kind === 'character') expect(p.characters[n.characterId], n.name).toBeTruthy();
          if (n.parentId) expect((s.nodes[n.parentId] as { children?: string[] }).children).toContain(n.id);
          if (n.kind === 'group') for (const c of n.children) expect(s.nodes[c]?.parentId).toBe(n.id);
        }
        for (const id of s.layerOrder) expect(s.nodes[id]).toBeTruthy();
        for (const tr of s.tracks) if ('targetNodeId' in tr && tr.targetNodeId !== '__camera__') expect(s.nodes[tr.targetNodeId] ?? tr.targetNodeId === 'camera', `${tr.name}`).toBeTruthy();
      }
      for (const list of allPieceLists(p)) for (const pc of list) if (pc.kind === 'object') expect(p.customObjects[pc.refId!], pc.name).toBeTruthy();
      for (const ms of [0, 1234, 4567]) expect(svgAt(p, ms).length).toBeGreaterThan(1000);
    });
  }
  it('aparecem na lista de modelos com categoria, sem tirar os antigos', () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    for (const old of ['vertical', 'horizontal', 'episodio', 'dialogo', 'audio', 'abertura']) expect(ids).toContain(old);
    for (const t of SHOWCASE_TEMPLATES) expect(ids).toContain(t.id);
    expect(SHOWCASE_TEMPLATES.filter((t) => t.category === 'Técnicos').map((t) => t.id)).toEqual(['laboratorio']);
  });
  it('criar a partir do modelo não altera o objeto padrão (cópia independente)', () => {
    const before = JSON.stringify(animatedTemplate('barco'));
    const p = createFromProjectTemplate('mar-barco');
    p.customObjects.tpl_barco!.name = 'Mudado';
    expect(JSON.stringify(animatedTemplate('barco'))).toBe(before);
  });
});

describe('Mar e Barco', () => {
  it('grupo com barco e dois passageiros; o grupo balança e os passageiros vão junto', () => {
    const p = createFromProjectTemplate('mar-barco');
    const s = scene0(p);
    const g = Object.values(s.nodes).find((n) => n.kind === 'group' && n.name === 'Barco com passageiros');
    expect(g?.kind).toBe('group');
    if (g?.kind !== 'group') return;
    const kinds = g.children.map((c) => s.nodes[c]!.kind).sort();
    expect(kinds).toEqual(['character', 'character', 'prop']);
    const nina = g.children.find((c) => s.nodes[c]!.name === 'Nina')!;
    const at = (t: number) => worldMatrix(s, nina, evaluateScene(p, s, t).nodes);
    expect(at(1500)[5]).toBeLessThan(at(0)[5] - 5);
    // Barco desenhado por cima dos passageiros (pernas dentro do casco).
    expect(g.children[g.children.length - 1]).toBe(g.children.find((c) => s.nodes[c]!.kind === 'prop'));
  });
  it('ondas do cenário (objeto animado dentro da composição) mudam de quadro no tempo', () => {
    const p = createFromProjectTemplate('mar-barco');
    const cb = Object.values(p.customBackgrounds)[0]!;
    const a = renderComposition(p, cb.id, 'day', cb.compositions.day!, () => undefined, 0);
    const b = renderComposition(p, cb.id, 'day', cb.compositions.day!, () => undefined, 250);
    expect(a).not.toBe(b);
    expect(renderComposition(p, cb.id, 'day', cb.compositions.day!, () => undefined, 720)).toBe(a);
  });
});

describe('Acampamento', () => {
  it('fogueira anima sem keyframes de desenho na cena', () => {
    const p = createFromProjectTemplate('acampamento');
    const s = scene0(p);
    const fire = Object.values(s.nodes).find((n) => n.name === 'Fogueira')!;
    expect(s.tracks.filter((t) => t.type === 'property' && t.targetNodeId === fire.id)).toHaveLength(0);
    const frameOf = (t: number) => { const doc = svgAt(p, t); return /data-obj-frame="(\d+)"/.exec(doc.slice(doc.indexOf(`data-node-id="${fire.id}"`)))?.[1]; };
    expect(frameOf(0)).toBe('0');
    expect(frameOf(120)).toBe('1');
    expect(frameOf(440)).toBe('0');
  });
});

describe('objeto animado dentro de outro objeto', () => {
  it('o de dentro toca no tempo do de fora (com a defasagem da cópia)', () => {
    const p = createDemoProject();
    const fire = animatedTemplate('fogueira')!;
    p.customObjects[fire.id] = fire;
    const outer = CustomObjectSchema.parse({ id: 'obj_lareira', name: 'Lareira', pieces: [createPiece('rect', { name: 'Base' }), createPiece('object', { name: 'Fogo', refId: fire.id })] });
    p.customObjects[outer.id] = outer;
    const r = (ms: number) => renderCustomObject(p, OBJECT_PREFIX + outer.id, () => undefined, 'n1', { clip: '', localMs: ms });
    expect(r(0)).not.toBe(r(120));
    expect(r(440)).toBe(r(0));
    // Sem tempo (miniatura): primeiro quadro, estável.
    expect(renderCustomObject(p, OBJECT_PREFIX + outer.id, () => undefined, 'n1')).toBe(r(0));
  });
});
