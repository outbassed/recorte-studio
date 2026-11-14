import { describe, expect, it } from 'vitest';
import { createProject } from '@/engine/model/factory';
import { CharacterDefinitionSchema, CustomObjectSchema } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';
import { buildCatalog, DEFAULT_QUERY, entryMatches, isAnimated, queryCatalog, subcategoriesOf, themesOf, type CatalogEntry, type CatalogQuery } from '@/features/catalog/catalog';
import { buildPack, readPack, type BuildItem } from '@/features/packs/format';
import type { LibraryRecord, PackRecord } from '@/storage/db';

async function installed(id: string, name: string, items: BuildItem[], extra: { collection?: string; tags?: string[]; source?: 'official' | 'imported'; enabled?: number } = {}): Promise<PackRecord> {
  const bytes = await buildPack({ id, name, version: '1.0.0', description: '', author: 'Teste', license: 'CC0', category: 'Geral', collection: extra.collection, tags: extra.tags, dependencies: [] }, items, [], { deterministic: true });
  const r = await readPack(bytes);
  if (!r.ok) throw new Error(r.reason);
  return { id, name, version: '1.0.0', enabled: extra.enabled ?? 1, installedAt: 1, size: bytes.length, manifest: r.pack.manifest, items: r.pack.items, assets: [], source: extra.source ?? 'imported' };
}
const obj = (id: string, name: string, clip = false) => CustomObjectSchema.parse({
  id, name, pieces: [createPiece('rect', { id: 'a' })],
  clips: clip ? [{ id: 'pisca', name: 'Piscando', frames: [{ id: 'f1', durationMs: 100, pieces: [createPiece('rect', { id: 'a' })] }, { id: 'f2', durationMs: 100, pieces: [createPiece('rect', { id: 'a' })] }] }] : [],
});
const objItem = (id: string, name: string, clip = false, meta: BuildItem['meta'] = {}): BuildItem => ({ id, kind: 'object', name, data: { bundle: 2, object: obj(id, name, clip), objects: [], assets: [] }, meta });
const charItem = (id: string, name: string, meta: BuildItem['meta'] = {}): BuildItem => ({ id, kind: 'character', name, data: CharacterDefinitionSchema.parse({ id, name }), meta });

const project = createProject('t');
const run = (packs: PackRecord[], q: Partial<CatalogQuery>, library: LibraryRecord[] = [], recents: string[] = []) =>
  queryCatalog(buildCatalog({ project, library, favorites: new Set(), packs }), 'all', { ...DEFAULT_QUERY, ...q }, recents);

describe('Busca e filtros da Biblioteca', () => {
  it('busca por ID: exata e com diferença de maiúsculas', async () => {
    const pk = await installed('pessoas-1', 'Pessoas', [charItem('Rafael', 'Rafael Um'), charItem('rafael', 'Rafael Dois'), charItem('s8D-88', 'Fulano')]);
    expect(run([pk], { text: 'id:Rafael' }).map((e) => e.name)).toEqual(['Rafael Um']);
    expect(run([pk], { text: 'id:rafael' }).map((e) => e.name)).toEqual(['Rafael Dois']);
    expect(run([pk], { text: '#s8D-88' }).map((e) => e.name)).toEqual(['Fulano']);
    expect(run([pk], { text: 'id:S8D-88' })).toEqual([]); // maiúscula errada: não acha
    expect(run([pk], { text: 'id:Rafa' })).toEqual([]); // exato, não parcial
  });

  it('ID digitado inteiro vem primeiro; trecho de ID respeita maiúsculas', async () => {
    const pk = await installed('pessoas-1', 'Pessoas', [charItem('s8D-88', 'Zeta'), charItem('Abc-123', 'Alfa')]);
    const r = run([pk], { text: 's8D-88', sort: 'name' });
    expect(r[0]!.id).toBe('s8D-88');
    expect(run([pk], { text: 'D-88' }).map((e) => e.id)).toEqual(['s8D-88']); // trecho do ID
    expect(run([pk], { text: 'd-88' })).toEqual([]); // outra caixa: não é ID nem texto
  });

  it('texto ignora acentos e maiúsculas em nome, categoria, subcategoria, tags e descrição', async () => {
    const pk = await installed('natal-1', 'Natal Brasileiro', [objItem('zimbro', 'Zimbro Natalício', false, { category: 'Decoração festiva', subcategory: 'Luzes e enfeites', tags: ['pisca-pisca', 'festa'], description: 'Enfeite clássico com estrela' })]);
    for (const t of ['zimbro', 'ZIMBRO', 'natalicio', 'decoracao festiva', 'luzes', 'PISCA', 'estrela classico', 'natal brasileiro']) expect(run([pk], { text: t }).map((e) => e.name), t).toEqual(['Zimbro Natalício']);
    expect(run([pk], { text: 'inexistente' })).toEqual([]);
  });

  it('busca por pacote, coleção, origem e tipo', async () => {
    const pk = await installed('natal-1', 'Natal Brasileiro', [objItem('arvore', 'Árvore')], { collection: 'Natal', source: 'official' });
    expect(run([pk], { text: 'brasileiro' })).toHaveLength(1);
    expect(run([pk], { text: 'natal' })).toHaveLength(1);
    expect(run([pk], { text: 'pacote' }).some((e) => e.origin === 'pack')).toBe(true);
    expect(run([pk], { text: 'objetos montados' }).some((e) => e.id === 'arvore')).toBe(true);
  });

  it('filtros: Oficiais, Pacotes, coleção, pacote específico, animados, temas', async () => {
    const off = await installed('natal-1', 'Natal', [objItem('arvore', 'Árvore', false, { category: 'Decoração' }), objItem('pisca', 'Pisca-pisca', true)], { collection: 'Natal', tags: ['feriado'], source: 'official' });
    const vt = await installed('vila-torta-assets-1', 'Vila Torta Assets', [objItem('urna', 'Urna', false)], { collection: 'Vila Torta', source: 'official' });
    const imp = await installed('meu-kit', 'Meu kit', [objItem('caneca', 'Caneca')], { tags: ['evento'] });
    const all = [off, vt, imp];
    const names = (q: Partial<CatalogQuery>) => run(all, q).filter((e) => e.origin === 'pack').map((e) => e.name).sort();
    expect(names({ filter: 'official' })).toEqual(['Urna', 'Árvore', 'Pisca-pisca'].sort());
    expect(names({ filter: 'packs' })).toHaveLength(4);
    expect(names({ collection: 'Natal' })).toEqual(['Pisca-pisca', 'Árvore']);
    expect(names({ packId: 'meu-kit' })).toEqual(['Caneca']);
    expect(names({ animated: true })).toEqual(['Pisca-pisca']);
    expect(names({ theme: 'holiday' })).toEqual(['Pisca-pisca', 'Árvore']);
    expect(names({ theme: 'series' })).toEqual(['Urna']);
    expect(names({ theme: 'event' })).toEqual(['Caneca']);
  });

  it('pacote desativado não aparece; item do pacote some de "Todos" se o mesmo item já está na minha biblioteca', async () => {
    const off = await installed('natal-1', 'Natal', [objItem('zimbro', 'Zimbro Raro')], { enabled: 0 });
    expect(run([off], { text: 'zimbro' })).toEqual([]);
    const on = await installed('natal-1', 'Natal', [objItem('zimbro', 'Zimbro Raro')]);
    const mine: LibraryRecord = { id: 'lib_a', kind: 'object', name: 'Zimbro Raro', favorite: 0, createdAt: 1, data: { bundle: 2, object: obj('zimbro', 'Zimbro Raro'), objects: [], assets: [] } };
    expect(run([on], { text: 'zimbro' }, [mine]).map((e) => e.origin)).toEqual(['mine']); // aparece uma vez só em Todos
    expect(run([on], { text: 'zimbro', filter: 'packs' }).map((e) => e.origin)).toEqual(['pack']); // em Pacotes, o item do pacote
  });

  it('personagem e pose de pacote entram na visão de elenco com o ID certo', async () => {
    const pk = await installed('misto-1', 'Misto', [charItem('ana-1', 'Ana'), { id: 'pose-a', kind: 'pose', name: 'Braços cruzados', data: { rig: {}, handL: 'fist', handR: 'fist' } }]);
    const e = buildCatalog({ project, library: [], favorites: new Set(), packs: [pk] }).filter((x) => x.origin === 'pack');
    expect(e.map((x) => [x.kind, x.view, x.id]).sort()).toEqual([['character', 'cast', 'ana-1'], ['pose', 'cast', 'pose-a']]);
    expect(e.find((x) => x.kind === 'pose')!.pose).toMatchObject({ handL: 'fist' });
  });

  it('subcategorias: filtro e contagem por categoria', async () => {
    const pk = await installed('misc-1', 'Misc', [objItem('zz-a', 'Zz Alfa', false, { category: 'Zcat', subcategory: 'Sub um' }), objItem('zz-b', 'Zz Beta', false, { category: 'Zcat', subcategory: 'Sub dois' }), objItem('zz-c', 'Zz Gama', false, { category: 'Zcat', subcategory: 'Sub um' })]);
    const all = buildCatalog({ project, library: [], favorites: new Set(), packs: [pk] });
    expect(subcategoriesOf(all, 'Zcat')).toEqual([{ id: 'Sub dois', count: 1 }, { id: 'Sub um', count: 2 }]);
    expect(queryCatalog(all, 'all', { ...DEFAULT_QUERY, category: 'Zcat', subcategory: 'Sub um' }).map((e) => e.name).sort()).toEqual(['Zz Alfa', 'Zz Gama']);
    expect(subcategoriesOf(all, 'Inexistente')).toEqual([]);
  });

  it('entryMatches e funções auxiliares', async () => {
    const pk = await installed('natal-1', 'Natal', [objItem('luz', 'Luz', true)], { collection: 'Vila Torta', tags: ['feriado', 'evento'] });
    const [e] = buildCatalog({ project, library: [], favorites: new Set(), packs: [pk] }).filter((x) => x.origin === 'pack') as CatalogEntry[];
    expect(entryMatches('', e!)).toBe(true);
    expect(isAnimated(e!)).toBe(true);
    expect(themesOf(e!).sort()).toEqual(['event', 'holiday', 'series']);
  });

  it('desempenho: 5.000 itens, busca e filtros em poucas dezenas de milissegundos', async () => {
    const items: BuildItem[] = Array.from({ length: 480 }, (_, i) => objItem(`item-${i}`, `Objeto ${i}`, false, { category: i % 2 ? 'Móveis' : 'Utensílios', tags: ['teste'] }));
    const pk = await installed('grande-1', 'Grande', items, { collection: 'Teste' });
    const packs = Array.from({ length: 11 }, (_, i) => ({ ...pk, id: `grande-${i}`, name: `Grande ${i}`, items: pk.items.map((it) => ({ ...it, id: `${it.id}-${i}`, data: { ...(it.data as object), object: { ...(it.data as { object: object }).object, id: `item-${i}-${(it.data as { object: { id: string } }).object.id}` } } as never })) }));
    const t0 = performance.now();
    const catalog = buildCatalog({ project, library: [], favorites: new Set(), packs });
    const build = performance.now() - t0;
    expect(catalog.filter((e) => e.origin === 'pack').length).toBeGreaterThanOrEqual(5000);
    const t1 = performance.now();
    const hit = queryCatalog(catalog, 'all', { ...DEFAULT_QUERY, text: 'objeto 4 moveis' });
    const search = performance.now() - t1;
    expect(hit.length).toBeGreaterThan(0);
    expect(build).toBeLessThan(2000);
    expect(search).toBeLessThan(500);
  });
});
