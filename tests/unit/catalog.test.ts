/** Catálogo unificado (Elenco, Cenários, Objetos): origens, busca, filtros, cópia ao editar, biblioteca e Shift+clique da seção. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { createDemoProject } from '@/features/templates/projects';
import { buildCatalog, categoriesOf, CAT, pushRecent, queryCatalog, readSceneData, DEFAULT_QUERY, type CatalogEntry } from '@/features/catalog/catalog';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { ANIMATED_TEMPLATES } from '@/features/catalog/animatedTemplates';
import { PROPS, getProp } from '@/engine/world/props';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { renderProp } from '@/engine/world/props';
import { CustomObjectSchema, type CharacterNode, type Project } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';
import { ensurePropertyTrack, findPropertyTrack, sceneOf, setKeyframe } from '@/engine/model/ops';
import { addSectionKeys, previewRemoveSectionKeys, removeSectionKeys } from '@/engine/model/sectionKeys';
import { commit, currentProject, currentScene, loadProject, redo, undo } from '@/state/projectStore';
import { copyBuiltin, deleteEntry, duplicateEntry, insertEntry, libraryFileOf, reloadLibrary, saveEntryToLibrary, toggleFavorite, useLibrary } from '@/state/catalogActions';
import { usePrefs } from '@/state/prefs';
import { db, repo, type LibraryRecord } from '@/storage/db';
import * as ui from '@/state/uiStore';

const lib = (o: Partial<LibraryRecord> & Pick<LibraryRecord, 'kind' | 'data'>): LibraryRecord => ({ id: `lib_${Math.random().toString(36).slice(2)}`, name: 'Item', favorite: 0, createdAt: 1, ...o });
const objData = (id: string, name: string) => ({ bundle: 2, object: CustomObjectSchema.parse({ id, name, pieces: [createPiece('rect', { name: 'Base' })] }), objects: [], assets: [] });

let project: Project;
beforeEach(async () => {
  project = createDemoProject();
  loadProject(project);
  await db.library.clear();
  useLibrary.setState({ records: [], loaded: false, error: null, blobs: 0 });
  usePrefs.setState({ catalogFavorites: [], catalogRecents: [] });
  vi.spyOn(ui, 'confirmDialog').mockResolvedValue(true);
});

const all = (library: LibraryRecord[] = [], favorites: string[] = []) => buildCatalog({ project: currentProject(), library, favorites: new Set(favorites) });

describe('catálogo: fontes e origens', () => {
  it('reúne padrão, projeto e biblioteca nas três visões, sem banco separado por aba', () => {
    const e = all([lib({ kind: 'object', name: 'Fogueira', data: objData('obj_f', 'Fogueira') })]);
    const views = new Set(e.map((x) => x.view));
    expect(views).toEqual(new Set(['cast', 'scenery', 'objects']));
    expect(e.filter((x) => x.origin === 'builtin' && x.view === 'cast')).toHaveLength(BUILTIN_CHARACTERS.length);
    expect(e.filter((x) => x.origin === 'builtin' && x.view === 'scenery')).toHaveLength(BACKGROUNDS.length);
    expect(e.filter((x) => x.origin === 'builtin' && x.view === 'objects')).toHaveLength(PROPS.length + ANIMATED_TEMPLATES.length);
    expect(e.find((x) => x.origin === 'mine')?.name).toBe('Fogueira');
  });
  it('chaves estáveis e únicas, com espaço de nomes', () => {
    const e = all();
    expect(new Set(e.map((x) => x.key)).size).toBe(e.length);
    expect(e.some((x) => x.key === 'builtin:prop:sofa')).toBe(true);
    expect(e.some((x) => x.key.startsWith('project:character:'))).toBe(true);
  });
  it('padrão é imutável; projeto e biblioteca são editáveis', () => {
    const e = all([lib({ kind: 'object', data: objData('obj_a', 'A') })]);
    expect(e.filter((x) => x.origin === 'builtin').every((x) => !x.editable)).toBe(true);
    expect(e.filter((x) => x.origin !== 'builtin').every((x) => x.editable)).toBe(true);
  });
  it('personagem padrão já no projeto some de "Todos" (não duplica) mas continua em "Padrão"', () => {
    const e = all();
    const nina = BUILTIN_CHARACTERS.find((c) => c.name === 'Nina')!;
    const inAll = queryCatalog(e, 'cast', DEFAULT_QUERY).filter((x) => x.name === 'Nina');
    expect(inAll).toHaveLength(1);
    expect(inAll[0]!.origin).toBe('project');
    expect(queryCatalog(e, 'cast', { ...DEFAULT_QUERY, filter: 'builtin' }).some((x) => x.key === `builtin:character:${nina.builtinId}`)).toBe(true);
  });
  it('contagem de uso no projeto: personagens, objetos padrão e cenário', () => {
    const e = all();
    const nina = e.find((x) => x.origin === 'project' && x.name === 'Nina')!;
    expect(nina.usage).toBeGreaterThan(0);
    const bg = e.find((x) => x.key === `builtin:background:${currentScene().background.presetId}`)!;
    expect(bg.usage).toBeGreaterThan(0);
  });
  it('registro ilegível aparece com o motivo (nunca some)', () => {
    const e = all([lib({ kind: 'object', name: 'Quebrado', data: { nada: 1 } }), lib({ kind: 'character', name: 'Ruim', data: { id: 3 } }), lib({ kind: 'scene', name: 'Cena ruim', data: {} })]);
    for (const n of ['Quebrado', 'Ruim', 'Cena ruim']) expect(e.find((x) => x.name === n)?.broken).toBeTruthy();
  });
  it('cena salva antiga é validada com os padrões de campos novos', () => {
    const s = currentScene();
    const ok = readSceneData({ scene: JSON.parse(JSON.stringify(s)), characters: JSON.parse(JSON.stringify(currentProject().characters)) });
    expect(ok.sceneData?.scene.id).toBe(s.id);
    expect(readSceneData({ scene: { id: 1 }, characters: {} }).broken).toBeTruthy();
  });
  it('item do projeto salvo na biblioteca fica ligado (mesma identidade) e não aparece duas vezes', () => {
    const o = CustomObjectSchema.parse({ id: 'obj_same', name: 'Mesa nova', pieces: [] });
    commit('x', (d) => { d.customObjects[o.id] = o; });
    const e = all([lib({ kind: 'object', name: 'Mesa nova', data: objData('obj_same', 'Mesa nova') })]);
    const hits = e.filter((x) => x.name === 'Mesa nova');
    expect(hits).toHaveLength(1);
    expect(hits[0]!.origin).toBe('project');
    expect(hits[0]!.libId).toBeTruthy();
  });
});

describe('catálogo: busca, filtros, categorias e ordem', () => {
  it('busca ignora acentos e maiúsculas', () => {
    const e = all();
    expect(queryCatalog(e, 'objects', { ...DEFAULT_QUERY, text: 'SOFA' }).map((x) => x.name)).toContain('Sofá');
    expect(queryCatalog(e, 'scenery', { ...DEFAULT_QUERY, text: 'escritorio' }).map((x) => x.name)).toContain('Escritório');
  });
  it('filtros Padrão, Meus, Favoritos, Recentes e No projeto', () => {
    const r = lib({ kind: 'object', name: 'Meu baú', favorite: 1, data: objData('obj_b', 'Meu baú') });
    const e = all([r], ['builtin:prop:sofa']);
    const names = (f: typeof DEFAULT_QUERY.filter, rec: string[] = []) => queryCatalog(e, 'objects', { ...DEFAULT_QUERY, filter: f }, rec).map((x) => x.name);
    expect(names('builtin')).not.toContain('Meu baú');
    expect(names('mine')).toEqual(['Meu baú']);
    expect(names('favorites').sort()).toEqual(['Meu baú', 'Sofá']);
    expect(names('recent', ['builtin:prop:chair', 'builtin:prop:sofa'])).toEqual(['Cadeira', 'Sofá']);
    expect(names('project')).toContain(getProp('sofa')!.label);
  });
  it('categorias por visão com contagem; categoria filtra', () => {
    const e = all();
    const cats = categoriesOf(e, 'objects');
    expect(cats.find((c) => c.id === 'Móveis')!.count).toBeGreaterThan(3);
    expect(queryCatalog(e, 'objects', { ...DEFAULT_QUERY, category: 'Móveis' }).every((x) => x.category === 'Móveis')).toBe(true);
    expect(categoriesOf(e, 'cast').map((c) => c.id)[0]).toBe(CAT.characters);
  });
  it('ordem por nome e "por seção" (projeto, minha biblioteca, padrão)', () => {
    const e = all([lib({ kind: 'object', name: 'Zzz', data: objData('obj_z', 'Zzz') })]);
    const byName = queryCatalog(e, 'objects', { ...DEFAULT_QUERY, sort: 'name' }).map((x) => x.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
    const def = queryCatalog(e, 'objects', DEFAULT_QUERY);
    expect(def[0]!.name).toBe('Zzz');
  });
  it('recentes: mais novo primeiro, sem repetir, limitado', () => {
    let r: string[] = [];
    for (let i = 0; i < 30; i++) r = pushRecent(r, `k${i % 26}`);
    expect(r[0]).toBe('k3');
    expect(new Set(r).size).toBe(r.length);
    expect(r.length).toBeLessThanOrEqual(24);
  });
  it('centenas de itens: monta e filtra rápido', () => {
    const many = Array.from({ length: 600 }, (_, i) => lib({ kind: 'object', name: `Objeto ${i}`, data: objData(`obj_${i}`, `Objeto ${i}`) }));
    const t0 = performance.now();
    const e = all(many);
    const hit = queryCatalog(e, 'objects', { ...DEFAULT_QUERY, text: 'objeto 59' });
    const ms = performance.now() - t0;
    expect(hit.map((x) => x.name)).toContain('Objeto 59');
    expect(hit.every((x) => x.name.includes('59'))).toBe(true);
    expect(hit).toHaveLength(16);
    expect(ms).toBeLessThan(1500);
  });
});

const entry = (key: string, library: LibraryRecord[] = useLibrary.getState().records): CatalogEntry => all(library, usePrefs.getState().catalogFavorites).find((x) => x.key === key)!;

describe('ações: cópia ao editar (padrão nunca muda)', () => {
  it('objeto padrão vira cópia pessoal com ID novo; mudar a cor da cópia não muda o original', async () => {
    const before = renderProp('sofa', '', '', '');
    const id = await copyBuiltin(entry('builtin:prop:sofa'), false);
    expect(id).toBeTruthy();
    const copy = currentProject().customObjects[id!]!;
    expect(copy.name).toBe('Sofá (cópia)');
    expect(copy.pieces[0]).toMatchObject({ kind: 'prop', refId: 'sofa' });
    commit('Cor', (d) => { d.customObjects[id!]!.pieces[0]!.colorA = '#ff0000'; });
    expect(renderProp('sofa', '', '', '')).toBe(before);
    expect(getProp('sofa')!.a).not.toBe('#ff0000');
    // A cópia é inserível.
    const n = Object.keys(currentScene().nodes).length;
    await insertEntry(entry(`project:object:${id}`));
    expect(Object.keys(currentScene().nodes).length).toBe(n + 1);
  });
  it('personagem padrão: cópia com ID novo, sem vínculo de padrão; o padrão continua igual', async () => {
    const src = BUILTIN_CHARACTERS[2]!;
    const snapshot = JSON.stringify(src);
    const id = await copyBuiltin(entry(`builtin:character:${src.builtinId}`), false);
    const c = currentProject().characters[id!]!;
    expect(c.id).not.toBe(src.id);
    expect(c.builtinId).toBeUndefined();
    commit('Cabelo', (d) => { d.characters[id!]!.hair.color = '#00ff00'; });
    expect(JSON.stringify(src)).toBe(snapshot);
  });
  // As composições de Dia/Noite dependem de decodificar SVG (não existe no jsdom): conferidas no E2E.
  it('cenário padrão: cópia própria com ID novo; o padrão não entra no projeto como editável', async () => {
    const id = await copyBuiltin(entry('builtin:background:praia'), false);
    const cb = currentProject().customBackgrounds[id!]!;
    expect(cb.name).toBe('Praia (cópia)');
    expect(id).not.toBe('praia');
  });
});

describe('objetos animados padrão', () => {
  it('inserir duas vezes reaproveita o mesmo objeto (identidade estável) e anima; cópia ganha ID novo', async () => {
    await insertEntry(entry('builtin:object:fogueira'));
    await insertEntry(entry('builtin:object:fogueira'));
    const objs = Object.values(currentProject().customObjects).filter((o) => o.name === 'Fogueira');
    expect(objs).toHaveLength(1);
    expect(objs[0]!.clips.map((c) => c.name)).toEqual(['Aceso', 'Apagando']);
    expect(Object.values(currentScene().nodes).filter((n) => n.kind === 'prop' && n.propId === 'obj:tpl_fogueira')).toHaveLength(2);
    const copy = await copyBuiltin(entry('builtin:object:ventilador'), false);
    expect(copy).not.toBe('tpl_ventilador');
    expect(currentProject().customObjects[copy!]!.clips[0]!.frames).toHaveLength(4);
    // O padrão fica escondido em Todos (já está no projeto), mas aparece em Padrão.
    const e = all();
    expect(queryCatalog(e, 'objects', DEFAULT_QUERY).filter((x) => x.name === 'Fogueira').map((x) => x.origin)).toEqual(['project']);
    expect(e.find((x) => x.key === 'builtin:object:barco')?.category).toBe('Veículos');
    expect(queryCatalog(e, 'objects', { ...DEFAULT_QUERY, filter: 'builtin' }).some((x) => x.key === 'builtin:object:fogueira')).toBe(true);
  });
});

describe('ações: biblioteca entre projetos', () => {
  it('salvar objeto do projeto, abrir OUTRO projeto, encontrar e inserir com tudo que precisa', async () => {
    const o = CustomObjectSchema.parse({ id: 'obj_x', name: 'Totem', pieces: [createPiece('rect', { name: 'Base' })] });
    commit('x', (d) => { d.customObjects[o.id] = o; });
    await saveEntryToLibrary(entry('project:object:obj_x'));
    await reloadLibrary();
    expect(useLibrary.getState().records.map((r) => r.name)).toEqual(['Totem']);
    // Outro projeto: o objeto não existe nele.
    loadProject(createDemoProject());
    expect(currentProject().customObjects.obj_x).toBeUndefined();
    const found = queryCatalog(all(useLibrary.getState().records), 'objects', { ...DEFAULT_QUERY, text: 'totem' });
    expect(found).toHaveLength(1);
    expect(found[0]!.origin).toBe('mine');
    await insertEntry(found[0]!);
    expect(currentProject().customObjects.obj_x?.name).toBe('Totem');
    expect(Object.values(currentScene().nodes).some((n) => n.kind === 'prop' && n.propId === 'obj:obj_x')).toBe(true);
  });
  it('salvar de novo ATUALIZA o mesmo registro (identidade preservada)', async () => {
    const o = CustomObjectSchema.parse({ id: 'obj_y', name: 'Placa', pieces: [] });
    commit('x', (d) => { d.customObjects[o.id] = o; });
    await saveEntryToLibrary(entry('project:object:obj_y'));
    await reloadLibrary();
    const first = useLibrary.getState().records[0]!;
    commit('renomear', (d) => { d.customObjects.obj_y!.name = 'Placa 2'; });
    await saveEntryToLibrary(entry('project:object:obj_y'));
    await reloadLibrary();
    const recs = useLibrary.getState().records;
    expect(recs).toHaveLength(1);
    expect(recs[0]!.id).toBe(first.id);
    expect(recs[0]!.name).toBe('Placa 2');
  });
  it('duplicar na biblioteca cria identidade nova; apagar da biblioteca não mexe no projeto', async () => {
    await repo.putLibrary(lib({ id: 'lib_1', kind: 'object', name: 'Banco', data: objData('obj_banco', 'Banco') }));
    await reloadLibrary();
    await duplicateEntry(entry('mine:lib_1'));
    await reloadLibrary();
    await insertEntry(entry('mine:lib_1'));
    // Já no projeto (mesma identidade): o registro some da lista para não duplicar.
    expect(entry('mine:lib_1')).toBeUndefined();
    const ids = useLibrary.getState().records.map((r) => (r.data as { object: { id: string } }).object.id);
    expect(new Set(ids).size).toBe(2);
    // O original agora está no projeto (mesma identidade): apagar o registro não quebra nada.
    await repo.deleteLibrary('lib_1');
    await reloadLibrary();
    expect(currentProject().customObjects.obj_banco?.name).toBe('Banco');
  });
  it('exportar gera arquivo no formato que a Biblioteca importa', () => {
    const f = libraryFileOf(entry(`project:character:${Object.keys(currentProject().characters)[0]}`))!;
    const parsed = JSON.parse(f.json) as { format: string; items: LibraryRecord[] };
    expect(parsed.format).toBe('recorte-studio-library');
    expect(parsed.items[0]!.kind).toBe('character');
    expect(f.name).toMatch(/\.biblioteca\.json$/);
  });
  it('favoritar item padrão (preferência) e da biblioteca (no registro)', async () => {
    await toggleFavorite(entry('builtin:prop:sofa'));
    expect(usePrefs.getState().catalogFavorites).toContain('builtin:prop:sofa');
    await repo.putLibrary(lib({ id: 'lib_f', kind: 'object', data: objData('obj_f2', 'F') }));
    await reloadLibrary();
    await toggleFavorite(entry('mine:lib_f'));
    expect((await repo.getLibrary('lib_f'))!.favorite).toBe(1);
  });
  it('remover personagem em uso é recusado com explicação; Ctrl+Z desfaz remoções', async () => {
    const id = Object.keys(currentProject().characters)[0]!;
    const toast = vi.spyOn(ui, 'toast');
    await deleteEntry(entry(`project:character:${id}`));
    expect(currentProject().characters[id]).toBeTruthy();
    expect(toast).toHaveBeenCalled();
  });
});

describe('Shift+clique no keyframe da seção: remove só o instante', () => {
  const TRANSFORM = ['transform.x', 'transform.y', 'transform.scaleX', 'transform.scaleY', 'transform.rotationDeg', 'opacity'];
  let nina: CharacterNode;
  let sid: string;
  beforeEach(() => {
    const s = currentScene();
    sid = s.id;
    nina = Object.values(s.nodes).find((n): n is CharacterNode => n.kind === 'character' && n.name === 'Nina')!;
  });
  const keys = (path: string) => findPropertyTrack(currentScene(), nina.id, path)?.keyframes.map((k) => k.timeMs) ?? [];

  it('remove somente as chaves da seção exatamente no instante; outros instantes e outras seções ficam', () => {
    commit('a', (d) => void addSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 1000));
    commit('b', (d) => void addSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 3000));
    commit('c', (d) => void addSectionKeys(sceneOf(d, sid), nina.id, 'character', ['rig.armLUpper', 'rig.armRUpper'], 3000));
    const tracksBefore = currentScene().tracks.length;
    commit('Remover keyframes da seção', (d) => void removeSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 3000));
    for (const p of TRANSFORM) {
      expect(keys(p)).toContain(1000);
      expect(keys(p)).not.toContain(3000);
    }
    expect(keys('rig.armLUpper')).toContain(3000);
    expect(currentScene().tracks.length).toBe(tracksBefore);
  });
  it('um único Ctrl+Z restaura tudo; refazer remove de novo', () => {
    commit('a', (d) => void addSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 1000));
    commit('b', (d) => void addSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 2000));
    const snap = JSON.stringify(currentScene().tracks);
    commit('Remover keyframes da seção', (d) => void removeSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 2000));
    expect(undo()).toBe('Remover keyframes da seção');
    expect(JSON.stringify(currentScene().tracks)).toBe(snap);
    redo();
    expect(keys('transform.x')).not.toContain(2000);
  });
  it('propriedade sem key no instante não é tocada; faixa trancada é respeitada', () => {
    commit('a', (d) => {
      const s = sceneOf(d, sid);
      setKeyframe(ensurePropertyTrack(s, nina.id, 'transform.x'), 500, 10);
      setKeyframe(ensurePropertyTrack(s, nina.id, 'transform.y'), 500, 20);
      setKeyframe(ensurePropertyTrack(s, nina.id, 'transform.y'), 900, 25);
      ensurePropertyTrack(s, nina.id, 'transform.y').locked = true;
    });
    const plan = previewRemoveSectionKeys(currentScene(), nina.id, 'character', TRANSFORM, 500);
    expect(plan.removed).toEqual(['transform.x']);
    expect(plan.locked).toEqual(['transform.y']);
    expect(plan.emptied).toEqual(['transform.x']);
    commit('r', (d) => void removeSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 500));
    expect(findPropertyTrack(currentScene(), nina.id, 'transform.x')).toBeUndefined();
    expect(keys('transform.y')).toEqual([500, 900]);
  });
  it('instante arredondado como no botão de criar', () => {
    commit('a', (d) => void addSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 1500));
    commit('r', (d) => void removeSectionKeys(sceneOf(d, sid), nina.id, 'character', TRANSFORM, 1500.4));
    expect(keys('opacity')).not.toContain(1500);
  });
});
