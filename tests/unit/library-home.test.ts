/** Biblioteca principal: itens individuais sem projeto aberto, importação sem duplicar, visão "todos os tipos" e pacotes com referências completas. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '@/engine/model/factory';
import { buildCatalog, DEFAULT_QUERY, queryCatalog, categoriesOf } from '@/features/catalog/catalog';
import { buildPack, readPack } from '@/features/packs/format';
import { buildDemoPack } from '@/features/packs/demo';
import { copyToMyLibrary, deleteRecord, duplicateRecord, importLibraryJson, storageError } from '@/state/libraryHomeActions';
import { reloadLibrary, useLibrary } from '@/state/catalogActions';
import { useProjectStore } from '@/state/projectStore';
import { db, repo, StorageQuotaError } from '@/storage/db';
import * as ui from '@/state/uiStore';
import { createPiece } from '@/engine/world/pieces';

const empty = createProject('Biblioteca');
const cat = () => buildCatalog({ project: empty, library: useLibrary.getState().records, favorites: new Set() });

beforeEach(async () => {
  await db.library.clear();
  useProjectStore.setState({ project: null });
  useLibrary.setState({ records: [], loaded: true, error: null, blobs: 0 });
  vi.spyOn(ui, 'confirmDialog').mockResolvedValue(true);
});

describe('visão de todos os tipos', () => {
  it('reúne personagens, objetos e cenários; filtra por tipo e categoria', () => {
    const e = cat();
    const all = queryCatalog(e, 'all', DEFAULT_QUERY);
    expect(new Set(all.map((x) => x.view))).toEqual(new Set(['cast', 'scenery', 'objects']));
    expect(queryCatalog(e, 'all', { ...DEFAULT_QUERY, kind: 'character' }).every((x) => x.kind === 'character')).toBe(true);
    expect(queryCatalog(e, 'all', { ...DEFAULT_QUERY, text: 'fogueira' }).map((x) => x.name)).toContain('Fogueira');
    // palavra-chave e categoria também entram na busca
    expect(queryCatalog(e, 'all', { ...DEFAULT_QUERY, text: 'acampamento' }).map((x) => x.name)).toContain('Fogueira');
    expect(categoriesOf(e, 'all').length).toBeGreaterThan(5);
  });
});

describe('itens individuais sem projeto aberto', () => {
  it('copiar um objeto padrão para a minha biblioteca cria um item próprio com identidade nova', async () => {
    const sofa = cat().find((x) => x.key === 'builtin:prop:sofa')!;
    const id = await copyToMyLibrary(sofa);
    expect(id).toBeTruthy();
    const mine = queryCatalog(cat(), 'all', { ...DEFAULT_QUERY, filter: 'mine' });
    expect(mine.map((x) => x.name)).toEqual(['Sofá (cópia)']);
    expect(mine[0]!.editable).toBe(true);
  });
  it('duplicar e apagar funcionam direto na biblioteca', async () => {
    await copyToMyLibrary(cat().find((x) => x.key === 'builtin:object:fogueira')!);
    const libId = useLibrary.getState().records[0]!.id;
    await duplicateRecord(libId);
    expect(useLibrary.getState().records).toHaveLength(2);
    const ids = useLibrary.getState().records.map((r) => (r.data as { object: { id: string } }).object.id);
    expect(new Set(ids).size).toBe(2);
    expect(await deleteRecord(libId)).toBe(true);
    expect(useLibrary.getState().records).toHaveLength(1);
  });
  it('importar o mesmo arquivo duas vezes atualiza em vez de duplicar', async () => {
    const file = JSON.stringify({ format: 'recorte-studio-library', version: 1, items: [
      { id: 'x1', kind: 'object', name: 'Banco', favorite: 0, createdAt: 1, data: { bundle: 2, object: { id: 'obj_banco', name: 'Banco', pieces: [] }, objects: [], assets: [] } },
      { id: 'x2', kind: 'character', name: 'Ana', favorite: 0, createdAt: 1, data: { id: 'char_ana', name: 'Ana' } },
      { nada: true },
    ] });
    expect(await importLibraryJson(file)).toEqual({ created: 2, updated: 0, skipped: 1 });
    expect(await importLibraryJson(file)).toEqual({ created: 0, updated: 2, skipped: 1 });
    expect(await repo.listLibrary()).toHaveLength(2);
    await expect(importLibraryJson('{"format":"outro"}')).rejects.toThrow(/não é um arquivo de biblioteca/);
  });
  it('falha de armazenamento vira mensagem clara (sem exceção solta)', async () => {
    expect(storageError(new StorageQuotaError('cheio'), 'Não foi possível salvar')).toMatch(/armazenamento do navegador está cheio/);
    const put = vi.spyOn(repo, 'putLibrary').mockRejectedValueOnce(new StorageQuotaError('cheio'));
    const toast = vi.spyOn(ui, 'toast');
    expect(await copyToMyLibrary(cat().find((x) => x.key === 'builtin:prop:sofa')!)).toBeNull();
    expect(toast.mock.calls.some((c) => /cheio/.test(String(c[0])))).toBe(true);
    put.mockRestore();
    await reloadLibrary();
    expect(useLibrary.getState().records).toHaveLength(0);
  });
});

describe('pacotes: referências internas e progresso', () => {
  const meta = { id: 'teste.refs', name: 'Refs', version: '1.0.0', description: '', author: '', license: 'CC0', category: 'X', dependencies: [] };
  it('recusa item que usa objeto aninhado que não veio junto', async () => {
    const bytes = await buildPack(meta, [{ id: 'o', kind: 'object', name: 'Fora', data: { bundle: 2, object: { id: 'o1', name: 'Fora', pieces: [createPiece('object', { refId: 'obj_sumido' })] }, objects: [], assets: [] } }], []);
    const r = await readPack(bytes);
    expect(!r.ok && r.reason).toMatch(/objeto que não veio junto/);
  });
  it('recusa item cuja peça usa imagem não listada no próprio item', async () => {
    const bytes = await buildPack(meta, [{ id: 'o', kind: 'object', name: 'Img', data: { bundle: 2, object: { id: 'o1', name: 'Img', pieces: [createPiece('image', { assetId: 'media_naoexiste' })] }, objects: [], assets: [] } }], []);
    const r = await readPack(bytes);
    expect(!r.ok && r.reason).toMatch(/imagem que não veio junto/);
  });
  it('informa o progresso ao verificar', async () => {
    const steps: Array<[number, number]> = [];
    const r = await readPack(await buildDemoPack(), (d, t) => steps.push([d, t]));
    expect(r.ok).toBe(true);
    expect(steps.at(-1)).toEqual([5, 5]);
  });
});
