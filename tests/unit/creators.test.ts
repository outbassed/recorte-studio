/** Criador de Objetos e Criador de Cenários: dados, desenho, uso em cena e .jrec. */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { ProjectSchema, CustomObjectSchema, type Background, type Project } from '@/engine/model/schema';
import { createPropNode } from '@/engine/model/factory';
import { sceneOf } from '@/engine/model/ops';
import { cloneComposition, createPiece, customObjectUsage, freezeCharacter, OBJECT_PREFIX, pieceAssetIds, renderPieces } from '@/engine/world/pieces';
import { applyCustomBackground, availableTimes, createCustomBackground, renderCustomBackground, resolveCustomVariant } from '@/engine/world/customBackgrounds';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { buildJrec, commitParsedProject, parseEntries, referencedAssetIds } from '@/features/projects/jrec';
import { extractZip } from '@/features/projects/archive';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 6, 7, 8]);
const url = () => undefined;

function projectWithCreations(): Project {
  const p = createDemoProject();
  p.assets.asset_logo = { id: 'asset_logo', kind: 'image', name: 'logo.png', mime: 'image/png', size: PNG.length, createdAt: 0, width: 10, height: 10 };
  p.customObjects.obj_a = CustomObjectSchema.parse({
    id: 'obj_a', name: 'Placa', width: 300, height: 400,
    pieces: [
      createPiece('rect', { x: 0, y: -300, w: 280, h: 160, fill: '#ffffff' }),
      createPiece('rect', { x: 0, y: -110, w: 20, h: 220, fill: '#555555' }),
      createPiece('image', { x: 0, y: -300, w: 100, h: 100, assetId: 'asset_logo' }),
    ],
  });
  const cb = createCustomBackground(p, 'Praça');
  const nina = Object.values(p.characters)[0]!;
  cb.compositions.day = {
    sky: '#9fd3f0',
    pieces: [
      createPiece('rect', { name: 'Chão', x: 0, y: 400, w: 2208, h: 400, fill: '#69b05c' }),
      createPiece('object', { refId: 'obj_a', x: 300, y: 230 }),
      createPiece('character', { name: 'Figurante', character: freezeCharacter(nina, { expression: 'happy', poseId: 'wave-L', view: 'front-left' }), x: -400, y: 230, scale: 0.7 }),
    ],
  };
  cb.compositions.night = cloneComposition(cb.compositions.day);
  cb.compositions.night.sky = '#1d2747';
  return p;
}

const bgOf = (p: Project, time: 'day' | 'night'): Background => {
  const cb = Object.values(p.customBackgrounds)[0]!;
  return { ...sceneOf(p, p.sceneOrder[0]!).background, presetId: 'custom:' + cb.id, timeOfDay: time };
};

describe('peças e objetos', () => {
  it('projetos antigos ganham listas vazias, sem perder nada', () => {
    const old = JSON.parse(JSON.stringify(createDemoProject()));
    delete old.customObjects;
    const parsed = ProjectSchema.parse(old);
    expect(parsed.customObjects).toEqual({});
    expect(parsed.sceneOrder).toEqual(old.sceneOrder);
  });
  it('desenho determinístico: mesma entrada, mesma saída', () => {
    const p = projectWithCreations();
    const a = renderPieces(p.customObjects.obj_a!.pieces, { project: p, url, idPrefix: 'x' });
    const b = renderPieces(p.customObjects.obj_a!.pieces, { project: p, url, idPrefix: 'x' });
    expect(a).toBe(b);
    expect(a.match(/data-piece=/g)).toHaveLength(3);
  });
  it('objeto inserido na cena aparece no plano usado por prévia e exportação', () => {
    const p = projectWithCreations();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const node = createPropNode(OBJECT_PREFIX + 'obj_a', { name: 'Placa' });
    s.nodes[node.id] = node;
    s.layerOrder.push(node.id);
    const svg = planToSvgString(planFrame(p, s, 500, url), 320, 180);
    expect(svg).toContain('data-piece=');
    // 1 nó na cena + 2 peças (dia e noite) no cenário.
    expect(customObjectUsage(p, 'obj_a')).toBe(3);
  });
  it('objeto dentro de si mesmo não trava (profundidade limitada)', () => {
    const p = projectWithCreations();
    p.customObjects.obj_a!.pieces.push(createPiece('object', { refId: 'obj_a' }));
    expect(() => renderPieces(p.customObjects.obj_a!.pieces, { project: p, url, idPrefix: 'r' })).not.toThrow();
  });
});

describe('Criador de Cenários', () => {
  it('horários com composição contam como disponíveis e são independentes', () => {
    const p = projectWithCreations();
    const cb = Object.values(p.customBackgrounds)[0]!;
    expect(availableTimes(cb)).toEqual(['day', 'night']);
    expect(resolveCustomVariant(cb, 'sunset')).toEqual({ time: 'night', fallback: true });
    cb.compositions.night!.pieces[0]!.fill = '#123456';
    expect(cb.compositions.day!.pieces[0]!.fill).toBe('#69b05c');
  });
  it('personagem estático é cópia congelada: mudar o elenco não muda o cenário', () => {
    const p = projectWithCreations();
    const before = renderCustomBackground(p, bgOf(p, 'day'), url);
    Object.values(p.characters)[0]!.hair.color = '#00ff00';
    const after = renderCustomBackground(p, bgOf(p, 'day'), url);
    expect(after).toBe(before);
    expect(before).not.toContain('#00ff00');
  });
  it('cenário aplicado vira fundo; o figurante não vira nó da cena', () => {
    const p = projectWithCreations();
    const cb = Object.values(p.customBackgrounds)[0]!;
    const s = sceneOf(p, p.sceneOrder[0]!);
    const before = Object.values(s.nodes).filter((n) => n.kind === 'character').length;
    applyCustomBackground(s, cb, 'night');
    expect(Object.values(s.nodes).filter((n) => n.kind === 'character').length).toBe(before);
    const svg = planToSvgString(planFrame(p, s, 0, url), 320, 180);
    expect(svg).toContain('data-composition="1"');
    expect(svg).toContain('#1d2747');
  });
});

describe('.jrec leva objetos e cenários com mídia', () => {
  it('ida e volta preserva peças, horários e imagens das peças', async () => {
    const p = projectWithCreations();
    expect(pieceAssetIds(p)).toContain('asset_logo');
    expect(referencedAssetIds(p).has('asset_logo')).toBe(true);
    const { blob, manifest } = await buildJrec(p, { getBlob: async (id) => (id === 'asset_logo' ? new Blob([PNG]) : undefined), allowMissing: true });
    expect(manifest.assets.map((a) => a.id)).toContain('asset_logo');
    const parsed = await parseEntries(extractZip(new Uint8Array(await blob.arrayBuffer())));
    if (parsed.kind !== 'project') throw new Error('esperava projeto');
    const mem = new Map<string, Uint8Array>();
    const back = await commitParsedProject(parsed, async (id, b) => { mem.set(id, new Uint8Array(await b.arrayBuffer())); }, async (id) => mem.has(id));
    const obj = Object.values(back.customObjects)[0]!;
    expect(obj.pieces).toHaveLength(3);
    const imgId = obj.pieces[2]!.assetId!;
    expect(imgId.startsWith('media_')).toBe(true);
    expect(mem.has(imgId)).toBe(true);
    const cb = Object.values(back.customBackgrounds)[0]!;
    expect(Object.keys(cb.compositions).sort()).toEqual(['day', 'night']);
    expect(cb.compositions.day!.pieces[2]!.character!.expression).toBe('happy');
  });
});
