/** Texto como peça dos criadores: estruturado, escapado, com caixa de seleção e portátil (biblioteca, pacote, .jrec). */
import { describe, expect, it } from 'vitest';
import { CustomObjectSchema, PieceSchema, ProjectSchema } from '@/engine/model/schema';
import { createPiece, OBJECT_PREFIX, pieceLocalBox, renderPieces, renderCustomObject } from '@/engine/world/pieces';
import { createDemoProject } from '@/features/templates/projects';
import { buildPack, readPack } from '@/features/packs/format';
import { buildCatalog, DEFAULT_QUERY, queryCatalog } from '@/features/catalog/catalog';
import { createPropNode } from '@/engine/model/factory';
import { planFrame, planToSvgString } from '@/engine/render/plan';

const env = { project: createDemoProject(), url: () => undefined, idPrefix: 't' };

describe('peça de texto', () => {
  it('peças antigas continuam válidas (campos de texto com padrão)', () => {
    const p = PieceSchema.parse({ id: 'a', kind: 'rect' });
    expect([p.text, p.fontFamily, p.fontSize, p.align, p.italic]).toEqual(['', 'sans', 64, 'middle', false]);
  });
  it('renderiza texto estruturado com fonte, tamanho, cor, contorno e várias linhas', () => {
    const t = createPiece('text', { text: 'TRAQUINA\n10', fontFamily: 'serif', fontSize: 80, fontWeight: '900', italic: true, fill: '#ff0000', stroke: '#ffffff', strokeWidth: 6, letterSpacing: 4, align: 'start' });
    const svg = renderPieces([t], env);
    expect(svg).toContain('>TRAQUINA</tspan>');
    expect(svg).toContain('>10</tspan>');
    expect(svg).toMatch(/font-family="Georgia,'Times New Roman',serif"/);
    expect(svg).toContain('font-size="80"');
    expect(svg).toContain('font-weight="900"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('stroke-width="6"');
    expect(svg).toContain('text-anchor="start"');
  });
  it('conteúdo nunca vira HTML: <script>, aspas e & são escapados', () => {
    const svg = renderPieces([createPiece('text', { text: '<script>alert("x")</script> & "aspas"' })], env);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
  });
  it('limite de tamanho do conteúdo', () => {
    expect(PieceSchema.safeParse({ id: 'x', kind: 'text', text: 'a'.repeat(501) }).success).toBe(false);
  });
  it('caixa de seleção acompanha alinhamento, linhas e tamanho; a escala vale para o texto', () => {
    const p = createPiece('text', { text: 'ABCD\nAB', fontSize: 50, align: 'middle' });
    const b = pieceLocalBox(p, env.project);
    expect(b.h).toBeCloseTo(120, 5);
    expect(b.x).toBeCloseTo(-b.w / 2, 5);
    expect(pieceLocalBox({ ...p, align: 'start' }, env.project).x).toBe(0);
    const scaled = renderPieces([{ ...p, scale: 2 }], env);
    expect(scaled).toContain('scale(2 2)');
  });
});

describe('texto em objetos, catálogo, pacotes e cenas', () => {
  const shirt = () => CustomObjectSchema.parse({ id: 'obj_camisa', name: 'Camisa do time', pieces: [createPiece('rect', { name: 'Corpo', fill: '#2f86c0' }), createPiece('text', { name: 'Número', text: '10', fontSize: 90, fill: '#ffffff' }), createPiece('text', { name: 'Nome', text: 'TRAQUINA', fontSize: 40 })] });
  it('aparece na cena e na exportação (mesmo renderizador) e o conteúdo entra na busca do catálogo', () => {
    const p = createDemoProject();
    p.customObjects.obj_camisa = shirt();
    const s = p.scenes[p.currentSceneId!]!;
    const node = createPropNode(OBJECT_PREFIX + 'obj_camisa');
    s.nodes[node.id] = node;
    s.layerOrder.push(node.id);
    expect(planToSvgString(planFrame(p, s, 500, () => undefined), 640, 360)).toContain('>TRAQUINA</tspan>');
    const e = buildCatalog({ project: p, library: [], favorites: new Set() });
    expect(queryCatalog(e, 'objects', { ...DEFAULT_QUERY, text: 'traquina' }).map((x) => x.name)).toEqual(['Camisa do time']);
    expect(renderCustomObject(p, OBJECT_PREFIX + 'obj_camisa', () => undefined)).toContain('>10</tspan>');
  });
  it('continua texto editável depois de passar por pacote e por .jrec (JSON)', async () => {
    const bytes = await buildPack({ id: 'teste.texto', name: 'Texto', version: '1.0.0', description: '', author: '', license: 'CC0', category: 'X', dependencies: [] }, [{ id: 'camisa', kind: 'object', name: 'Camisa', data: { bundle: 2, object: shirt(), objects: [], assets: [] } }], []);
    const r = await readPack(bytes);
    expect(r.ok).toBe(true);
    const obj = r.ok && r.pack.items[0]!.kind === 'object' ? r.pack.items[0]!.data.object : null;
    expect(obj!.pieces.find((x) => x.kind === 'text' && x.name === 'Nome')!.text).toBe('TRAQUINA');
    const p = createDemoProject();
    p.customObjects.obj_camisa = shirt();
    const back = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(back.customObjects.obj_camisa!.pieces[1]).toMatchObject({ kind: 'text', text: '10', fontSize: 90 });
  });
});
