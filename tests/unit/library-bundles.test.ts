/** Biblioteca: pacotes com dependências, formatos antigos, ciclos e caches de objetos. */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { CustomObjectSchema, type Asset, type Project } from '@/engine/model/schema';
import { createPiece, renderCustomObject, OBJECT_PREFIX } from '@/engine/world/pieces';
import { createCustomBackground, renderCustomBackground } from '@/engine/world/customBackgrounds';
import { sceneOf } from '@/engine/model/ops';
import { createPropNode } from '@/engine/model/factory';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import {
  buildBackgroundBundle, buildObjectBundle, mergeBackgroundBundle, mergeObjectBundle, objectContains, readBackgroundBundle, readObjectBundle,
} from '@/features/library/bundles';
import { deepClone } from '@/engine/model/ids';
import { produce } from 'immer';

const asset = (id: string): Asset => ({ id, kind: 'image', name: `${id}.png`, mime: 'image/png', size: 12, createdAt: 0, width: 10, height: 10 });
const urlOk = (id: string) => `blob:${id}`;
const none = () => undefined;

/** Placa (usa Moldura, que usa uma imagem) dentro do cenário "Praça". */
function world(): Project {
  const p = createDemoProject();
  p.assets.asset_a = asset('asset_a');
  p.assets.asset_b = asset('asset_b');
  p.customObjects.frame = CustomObjectSchema.parse({ id: 'frame', name: 'Moldura', pieces: [createPiece('image', { assetId: 'asset_a', w: 50, h: 50 })] });
  p.customObjects.sign = CustomObjectSchema.parse({ id: 'sign', name: 'Placa', pieces: [createPiece('rect', { fill: '#112233' }), createPiece('object', { refId: 'frame' })] });
  const cb = createCustomBackground(p, 'Praça');
  cb.variants.morning = { assetId: 'asset_b', fit: 'cover' };
  cb.compositions.day = { sky: '#9fd3f0', pieces: [createPiece('object', { refId: 'sign' }), createPiece('image', { assetId: 'asset_b' })] };
  return p;
}

describe('pacote de objeto', () => {
  it('leva os objetos que ele usa (fecho transitivo) e todas as imagens', () => {
    const p = world();
    const b = buildObjectBundle(p, 'sign')!;
    expect(b.objects.map((o) => o.id)).toEqual(['frame']);
    expect(b.assets.map((a) => a.id)).toEqual(['asset_a']);
  });
  it('trazer para um projeto limpo recria tudo, com as referências corretas', () => {
    const b = buildObjectBundle(world(), 'sign')!;
    const clean = createDemoProject();
    const out = produce(clean, (d) => { mergeObjectBundle(d as Project, deepClone(b)); });
    expect(Object.keys(out.customObjects).sort()).toEqual(['frame', 'sign']);
    expect(out.assets.asset_a).toBeTruthy();
    expect(out.customObjects.sign!.pieces[1]!.refId).toBe('frame');
  });
  it('trazer duas vezes não duplica; conteúdo diferente com o mesmo ID vira cópia e as referências seguem a cópia', () => {
    const b = buildObjectBundle(world(), 'sign')!;
    let out = produce(createDemoProject(), (d) => { mergeObjectBundle(d as Project, deepClone(b)); });
    out = produce(out, (d) => { mergeObjectBundle(d as Project, deepClone(b)); });
    expect(Object.keys(out.customObjects)).toHaveLength(2);
    const edited = deepClone(b);
    edited.objects[0]!.pieces[0]!.w = 999;
    out = produce(out, (d) => { mergeObjectBundle(d as Project, edited); });
    expect(Object.keys(out.customObjects)).toHaveLength(4);
    const copySign = Object.values(out.customObjects).find((o) => o.id !== 'sign' && o.name === 'Placa')!;
    const copyFrameId = copySign.pieces[1]!.refId!;
    expect(copyFrameId).not.toBe('frame');
    expect(out.customObjects[copyFrameId]!.pieces[0]!.w).toBe(999);
  });
});

describe('pacote de cenário', () => {
  it('leva imagens de horários, de composições e objetos (com os aninhados)', () => {
    const w = world();
    const b = buildBackgroundBundle(w, Object.keys(w.customBackgrounds)[0]!)!;
    expect(b.assets.map((a) => a.id).sort()).toEqual(['asset_a', 'asset_b']);
    expect(b.objects.map((o) => o.id).sort()).toEqual(['frame', 'sign']);
  });
  it('ida e volta para projeto limpo: o cenário desenha igual e a Praça não vira cópia ao trazer de novo', () => {
    const p = world();
    const cbId = Object.keys(p.customBackgrounds)[0]!;
    const b = buildBackgroundBundle(p, cbId)!;
    let id = '';
    const out = produce(createDemoProject(), (d) => { id = mergeBackgroundBundle(d as Project, deepClone(b)).id; });
    expect(id).toBe(cbId);
    const bg = { ...sceneOf(out, out.sceneOrder[0]!).background, presetId: `custom:${id}`, timeOfDay: 'day' as const };
    const bg0 = { ...bg, presetId: `custom:${cbId}` };
    expect(renderCustomBackground(out, bg, urlOk)).toBe(renderCustomBackground(p, bg0, urlOk));
    const again = produce(out, (d) => { expect(mergeBackgroundBundle(d as Project, deepClone(b)).copied).toBe(false); });
    expect(Object.keys(again.customBackgrounds)).toHaveLength(1);
  });
});

describe('formatos antigos e incompatíveis', () => {
  const p = world();
  const cb = p.customBackgrounds[Object.keys(p.customBackgrounds)[0]!]!;
  it('1.1: assets como registro { id: asset }', () => {
    const r = readBackgroundBundle({ background: { id: 'c1', name: 'Velho', variants: { day: { assetId: 'asset_b', fit: 'cover' } }, createdAt: 1 }, assets: { asset_b: asset('asset_b') } });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bundle.assets).toHaveLength(1);
      expect(r.bundle.background.compositions).toEqual({});
    }
  });
  it('1.2 inicial: assets como lista, sem objetos', () => {
    const r = readBackgroundBundle({ background: deepClone(cb), assets: [asset('asset_a'), asset('asset_b')] });
    expect(r.ok).toBe(true);
  });
  it('objeto 1.2 inicial: { object, assets[] }', () => {
    const r = readObjectBundle({ object: deepClone(p.customObjects.frame), assets: [asset('asset_a')] });
    expect(r.ok && r.bundle.objects).toEqual([]);
  });
  it.each([
    [null], ['texto'], [{}], [{ background: 5 }], [{ background: { id: 1 } }],
    [{ background: deepClone(cb), assets: [{ lixo: true }] }],
    [{ background: deepClone(cb), objects: 'x' }],
  ])('registro ilegível %# vira erro claro, sem exceção', (data) => {
    const r = readBackgroundBundle(data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
  });
  it('objeto ilegível também', () => {
    expect(readObjectBundle({ object: { id: 3 } }).ok).toBe(false);
    expect(readObjectBundle(undefined).ok).toBe(false);
  });
});

describe('dependências e ciclos', () => {
  it('detecta ciclos diretos e indiretos', () => {
    const p = world();
    expect(objectContains(p, 'sign', 'frame')).toBe(true);
    expect(objectContains(p, 'frame', 'sign')).toBe(false);
    expect(objectContains(p, 'frame', 'frame')).toBe(true);
  });
});

describe('caches de objetos', () => {
  it('editar um objeto refaz os objetos que o contêm, as cenas e os cenários', () => {
    const p = world();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const node = createPropNode(OBJECT_PREFIX + 'sign', { name: 'Placa' });
    s.nodes[node.id] = node;
    s.layerOrder.push(node.id);
    const cbId = Object.keys(p.customBackgrounds)[0]!;
    s.background = { ...s.background, presetId: `custom:${cbId}`, timeOfDay: 'day' };
    // produce congela como o Immer do app: as referências antigas ficam, as novas são trocadas.
    const before = produce(p, () => undefined);
    const svgBefore = planToSvgString(planFrame(before, sceneOf(before, before.sceneOrder[0]!), 0, urlOk), 400, 225);
    expect(svgBefore).toContain('width="50"');
    const after = produce(before, (d) => { d.customObjects.frame!.pieces[0]!.w = 321; });
    const svgAfter = planToSvgString(planFrame(after, sceneOf(after, after.sceneOrder[0]!), 0, urlOk), 400, 225);
    // Dentro da Placa (aninhado) e dentro do cenário (composição): nenhum ficou com a versão velha.
    expect((svgAfter.match(/width="321"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svgAfter).not.toContain('width="50"');
  });
  it('carregar uma imagem depois refaz o desenho (disponibilidade na chave)', () => {
    const p = produce(world(), () => undefined);
    const missing = renderCustomObject(p, OBJECT_PREFIX + 'sign', none, 'n1');
    const loaded = renderCustomObject(p, OBJECT_PREFIX + 'sign', urlOk, 'n1');
    expect(missing).not.toBe(loaded);
    expect(loaded).toContain('blob:asset_a');
  });
});
