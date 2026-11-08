/** Pacotes opcionais: formato validado, segurança, instalação transacional, ativar/desativar, remover e projetos intactos. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { buildPack, compareVersions, readPack } from '@/features/packs/format';
import { buildDemoPack, DEMO_PACK_ID } from '@/features/packs/demo';
import { installDemoPack, installPackBytes, exportPackBytes, removePack, reloadPacks, setPackEnabled, usePacks } from '@/state/packActions';
import { buildCatalog, queryCatalog, DEFAULT_QUERY } from '@/features/catalog/catalog';
import { copyBuiltin, insertEntry, useLibrary } from '@/state/catalogActions';
import { createDemoProject } from '@/features/templates/projects';
import { currentProject, loadProject } from '@/state/projectStore';
import { db, repo } from '@/storage/db';
import * as ui from '@/state/uiStore';

const rezip = (bytes: Uint8Array, change: (files: Record<string, Uint8Array>) => void) => {
  const files = unzipSync(bytes);
  change(files);
  return zipSync(files);
};
const manifestOf = (files: Record<string, Uint8Array>) => JSON.parse(strFromU8(files['manifest.json']!)) as Record<string, unknown> & { items: Array<{ file: string }>; media: Array<{ file: string }> };

beforeEach(async () => {
  await db.packs.clear();
  await db.library.clear();
  useLibrary.setState({ records: [], loaded: true, error: null, blobs: 0 });
  usePacks.setState({ packs: [], loaded: false });
  loadProject(createDemoProject());
  vi.spyOn(ui, 'confirmDialog').mockResolvedValue(true);
  // O IndexedDB falso do jsdom não devolve Blob de verdade: blobs em memória (o resto usa o banco real).
  const blobs = new Map<string, Blob>();
  vi.spyOn(repo, 'putBlob').mockImplementation(async (id, blob) => { blobs.set(id, blob); });
  vi.spyOn(repo, 'getBlob').mockImplementation(async (id) => blobs.get(id));
  vi.spyOn(repo, 'hasBlob').mockImplementation(async (id) => blobs.has(id));
  vi.spyOn(repo, 'collectOrphanBlobs').mockResolvedValue(0);
});

describe('formato .rspack', () => {
  it('pacote de demonstração é válido: itens, mídia SVG limpa e hashes', async () => {
    const r = await readPack(await buildDemoPack());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.pack.manifest.id).toBe(DEMO_PACK_ID);
    expect(r.pack.items.map((i) => i.kind)).toEqual(['object', 'object', 'object', 'background']);
    expect(r.pack.media).toHaveLength(1);
    expect(r.pack.items.find((i) => i.id === 'chaleira')!.kind === 'object' && (r.pack.items.find((i) => i.id === 'chaleira')!.data as { object: { clips: unknown[] } }).object.clips).toHaveLength(1);
  });
  it('recusa caminho fora de items/ e media/ (path traversal)', async () => {
    const bad = rezip(await buildDemoPack(), (f) => { f['../../evil.json'] = strToU8('{}'); });
    const r = await readPack(bad);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/Caminho não permitido/);
  });
  it('recusa arquivo alterado (sha256 não confere)', async () => {
    const bad = rezip(await buildDemoPack(), (f) => {
      const m = manifestOf(f);
      f[m.items[0]!.file] = strToU8('{"bundle":2,"object":{"id":"x","name":"Mexido"},"objects":[],"assets":[]}');
    });
    const r = await readPack(bad);
    expect(!r.ok && r.reason).toMatch(/sha256 não confere/);
  });
  it('recusa SVG com script mesmo com hash certo', async () => {
    const evil = strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10"/></svg>');
    const bytes = await buildPack({ id: 'teste.mal', name: 'Mal', version: '1.0.0', description: '', author: '', license: 'CC0', category: 'X', dependencies: [] }, [{ id: 'o', kind: 'object', name: 'O', data: { bundle: 2, object: { id: 'o1', name: 'O', pieces: [] }, objects: [], assets: [] } }], [{ bytes: evil, mime: 'image/svg+xml', ext: 'svg' }]);
    const r = await readPack(bytes);
    expect(!r.ok && r.reason).toMatch(/SVG com conteúdo não permitido/);
  });
  it('recusa manifesto inválido, sem licença, item usando imagem de fora e ZIP ilegível', async () => {
    const noLicense = rezip(await buildDemoPack(), (f) => { const m = manifestOf(f); m.license = ''; f['manifest.json'] = strToU8(JSON.stringify(m)); });
    expect((await readPack(noLicense)).ok).toBe(false);
    const foreign = await buildPack({ id: 'teste.fora', name: 'Fora', version: '1.0.0', description: '', author: '', license: 'CC0', category: 'X', dependencies: [] }, [{ id: 'o', kind: 'object', name: 'O', data: { bundle: 2, object: { id: 'o1', name: 'O', pieces: [] }, objects: [], assets: [{ id: 'media_abc', kind: 'image', name: 'x.png', mime: 'image/png', size: 1, createdAt: 0 }] } }], []);
    const r = await readPack(foreign);
    expect(!r.ok && r.reason).toMatch(/não está no pacote/);
    expect((await readPack(strToU8('não é zip'))).ok).toBe(false);
  });
  it('versões comparam por número', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
  });
});

describe('ciclo de vida', () => {
  it('instalar, aparecer no catálogo, desativar (some, projeto intacto), reativar, atualizar, remover', async () => {
    const r = await installDemoPack();
    expect(r.ok).toBe(true);
    const cat = () => buildCatalog({ project: currentProject(), library: [], favorites: new Set(), packs: usePacks.getState().packs });
    const packs = () => queryCatalog(cat(), 'objects', { ...DEFAULT_QUERY, filter: 'packs' });
    expect(packs().map((e) => e.name).sort()).toEqual(['Chaleira', 'Painel de azulejos', 'Panela']);
    expect(queryCatalog(cat(), 'scenery', { ...DEFAULT_QUERY, filter: 'packs' }).map((e) => e.name)).toEqual(['Parede de azulejos']);
    // Usar no projeto A: cópia com imagem.
    const azulejo = packs().find((e) => e.name === 'Painel de azulejos')!;
    await insertEntry(azulejo);
    const objA = currentProject().customObjects.pk_azulejo!;
    expect(objA).toBeTruthy();
    const media = objA.pieces[0]!.assetId!;
    expect(currentProject().assets[media]).toBeTruthy();
    // Já no projeto: em Todos aparece só a cópia do projeto (mesma identidade); em Pacotes, o item do pacote.
    expect(queryCatalog(cat(), 'objects', DEFAULT_QUERY).filter((e) => e.name === 'Painel de azulejos').map((e) => e.origin)).toEqual(['project']);
    expect(packs().map((e) => e.name)).toContain('Painel de azulejos');
    // Desativar: some do catálogo, projeto continua com o objeto.
    await setPackEnabled(DEMO_PACK_ID, false);
    expect(packs()).toHaveLength(0);
    expect(currentProject().customObjects.pk_azulejo).toBeTruthy();
    await setPackEnabled(DEMO_PACK_ID, true);
    expect(packs().length).toBeGreaterThan(0);
    // Mesma versão de novo: recusa; versão nova: atualiza (mantém ativo).
    expect((await installDemoPack()).ok).toBe(false);
    const up = await installDemoPack('1.1.0');
    expect(up.ok && up.updated).toBe(true);
    expect(usePacks.getState().packs[0]!.version).toBe('1.1.0');
    // Projeto B usa a chaleira.
    loadProject(createDemoProject());
    await insertEntry(packs().find((e) => e.name === 'Chaleira')!);
    expect(currentProject().customObjects.pk_chaleira!.clips[0]!.frames).toHaveLength(3);
    // Remover: projeto B intacto; imagem continua (o projeto A, salvo, a usa).
    await repo.saveProject(currentProject());
    expect(await removePack(DEMO_PACK_ID)).toBe(true);
    expect(usePacks.getState().packs).toHaveLength(0);
    expect(currentProject().customObjects.pk_chaleira).toBeTruthy();
  });
  it('item de pacote é protegido: editar cria cópia com ID novo', async () => {
    await installDemoPack();
    const e = queryCatalog(buildCatalog({ project: currentProject(), library: [], favorites: new Set(), packs: usePacks.getState().packs }), 'objects', { ...DEFAULT_QUERY, filter: 'packs' }).find((x) => x.name === 'Panela')!;
    expect(e.editable).toBe(false);
    const id = await copyBuiltin(e, false);
    expect(id).not.toBe('pk_panela');
    expect(currentProject().customObjects[id!]!.name).toBe('Panela (cópia)');
    expect(usePacks.getState().packs[0]!.items.find((i) => i.id === 'panela')!.data).toMatchObject({ object: { name: 'Panela' } });
  });
  it('dependência ausente impede instalar; pacote do qual outro depende não é removido', async () => {
    const meta = { id: 'teste.extra', name: 'Extra', version: '1.0.0', description: '', author: '', license: 'CC0', category: 'X', dependencies: [{ id: DEMO_PACK_ID, version: '1.0.0' }] };
    const extra = await buildPack(meta, [{ id: 'o', kind: 'object', name: 'Extra', data: { bundle: 2, object: { id: 'ex1', name: 'Extra', pieces: [] }, objects: [], assets: [] } }], []);
    const r = await installPackBytes(extra);
    expect(!r.ok && r.reason).toMatch(/precisa do pacote/);
    await installDemoPack();
    expect((await installPackBytes(extra)).ok).toBe(true);
    expect(await removePack(DEMO_PACK_ID)).toBe(false);
    expect((await repo.listPacks()).length).toBe(2);
  });
  it('exportar e reimportar em outro navegador (banco limpo) dá o mesmo conteúdo', async () => {
    await installDemoPack();
    const out = (await exportPackBytes(DEMO_PACK_ID))!;
    await db.packs.clear();
    await reloadPacks();
    const r = await installPackBytes(out.bytes);
    expect(r.ok).toBe(true);
    expect(usePacks.getState().packs[0]!.items).toHaveLength(4);
  });
});
