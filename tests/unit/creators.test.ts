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

describe('Criador de Cenários em quadros não 16:9', () => {
  const frames = { '16:9': { w: 1920, h: 1080 }, '9:16': { w: 607.5, h: 1080 }, '1:1': { w: 1080, h: 1080 }, '4:3': { w: 1440, h: 1080 } };
  it('rótulo do formato do projeto', async () => {
    const { aspectLabel } = await import('@/state/creatorActions');
    expect(aspectLabel({ width: 1920, height: 1080 })).toBe('16:9');
    expect(aspectLabel({ width: 1080, height: 1920 })).toBe('9:16');
    expect(aspectLabel({ width: 1080, height: 1080 })).toBe('1:1');
    expect(aspectLabel({ width: 1000, height: 777 })).toBe('1000×777');
  });
  it.each(Object.entries(frames))('modelos %s: todo objeto fica dentro do quadro', async (_name, fr) => {
    const { SCENERY_TEMPLATES } = await import('@/state/creatorActions');
    for (const t of SCENERY_TEMPLATES) for (const night of [false, true]) {
      const comp = t.make(night, fr);
      for (const p of comp.pieces.filter((x) => x.kind === 'prop')) {
        expect(Math.abs(p.x), `${t.id} ${p.name}`).toBeLessThanOrEqual(fr.w / 2);
        if (fr.w < 700) expect(p.scale, `${t.id} ${p.name}`).toBeLessThan(1);
      }
    }
  });
  it('em 16:9 nada muda de posição nem de escala', async () => {
    const { SCENERY_TEMPLATES } = await import('@/state/creatorActions');
    const park = SCENERY_TEMPLATES.find((t) => t.id === 'park')!.make(false, frames['16:9']);
    expect(park.pieces.find((p) => p.name === 'Banco')).toMatchObject({ x: 60, scale: 1 });
  });
});

describe('seleção e grupos de peças girados', () => {
  it('seleção acompanha a rotação: retângulo comprido girado 90° é acertado na vertical, não na horizontal', async () => {
    const { pieceHit, pieceCorners } = await import('@/engine/world/pieces');
    const p = createDemoProject();
    const bar = createPiece('rect', { x: 100, y: 100, w: 300, h: 40, rotation: 90 });
    expect(pieceHit(bar, p, 100, 230)).toBe(true);
    expect(pieceHit(bar, p, 230, 100)).toBe(false);
    const c = pieceCorners(bar, p);
    expect(Math.min(...c.map((q) => q[0]))).toBeCloseTo(80, 5);
    expect(Math.max(...c.map((q) => q[1]))).toBeCloseTo(250, 5);
  });
  it('espelho e escala entram no desenho e na seleção do mesmo jeito', async () => {
    const { pieceHit } = await import('@/engine/world/pieces');
    const p = createDemoProject();
    const tree = createPiece('prop', { refId: 'tree', x: 0, y: 0, scale: 2, flipY: true });
    // Árvore cresce para cima (y negativo) e o espelho vertical inverte: a área passa a ficar abaixo da base.
    expect(pieceHit(tree, p, 0, 200)).toBe(true);
    expect(pieceHit(tree, p, 0, -200)).toBe(false);
  });
  it('girar o grupo move as peças em torno do centro e soma o ângulo em cada uma', async () => {
    const { transformPieces, selectionBox } = await import('@/engine/world/pieces');
    const p = createDemoProject();
    const a = createPiece('rect', { x: -100, y: 0, w: 40, h: 40 });
    const b = createPiece('rect', { x: 100, y: 0, w: 40, h: 40 });
    transformPieces([a, b], p, { rotate: 90 });
    expect(a.x).toBeCloseTo(0, 1);
    expect(a.y).toBeCloseTo(-100, 1);
    expect(b.y).toBeCloseTo(100, 1);
    expect(a.rotation).toBe(90);
    // A caixa do grupo continua com o mesmo centro.
    const box = selectionBox([a, b], p)!;
    expect(box.x + box.w / 2).toBeCloseTo(0, 1);
  });
  it('escalar o grupo multiplica posições e tamanhos; girar 4× 90° volta ao início', async () => {
    const { transformPieces } = await import('@/engine/world/pieces');
    const p = createDemoProject();
    const a = createPiece('rect', { x: -100, y: 0, w: 40, h: 40 });
    const b = createPiece('prop', { refId: 'tree', x: 100, y: 0, scale: 1 });
    transformPieces([a, b], p, { scale: 2 });
    expect(a.x).toBeCloseTo(-200, 1);
    expect(a.w).toBe(80);
    expect(b.scale).toBe(2);
    for (let i = 0; i < 4; i++) transformPieces([a, b], p, { rotate: 90 });
    expect(a.rotation).toBe(0);
    expect(a.x).toBeCloseTo(-200, 0);
  });
});
