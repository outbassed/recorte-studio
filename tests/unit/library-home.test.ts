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
  it('importar o mesmo arquivo duas vezes reconhece a duplicata (não duplica nem sobrescreve)', async () => {
    const file = JSON.stringify({ format: 'recorte-studio-library', version: 1, items: [
      { id: 'x1', kind: 'object', name: 'Banco', favorite: 0, createdAt: 1, data: { bundle: 2, object: { id: 'obj_banco', name: 'Banco', pieces: [] }, objects: [], assets: [] } },
      { id: 'x2', kind: 'character', name: 'Ana', favorite: 0, createdAt: 1, data: { id: 'char_ana', name: 'Ana' } },
      { nada: true },
    ] });
    expect(await importLibraryJson(file)).toEqual({ created: 2, duplicates: 0, renamed: 0, notImported: 0, skipped: 1, cancelled: false });
    expect(await importLibraryJson(file)).toEqual({ created: 0, duplicates: 2, renamed: 0, notImported: 0, skipped: 1, cancelled: false });
    expect(await repo.listLibrary()).toHaveLength(2);
    await expect(importLibraryJson('{"format":"outro"}')).rejects.toThrow(/não é um arquivo de biblioteca/);
  });
  it('mesmo ID com conteúdo diferente é conflito: nunca sobrescreve; novo ID, ID manual e pular funcionam', async () => {
    const mk = (name: string, color: string, extra: unknown[] = []) => JSON.stringify({ format: 'recorte-studio-library', version: 1, items: [
      { id: 'a', kind: 'object', name, favorite: 0, createdAt: 1, data: { bundle: 2, object: { id: 'meu-banco', name, pieces: [{ id: 'p', kind: 'rect', fill: color }] }, objects: [], assets: [] } }, ...extra,
    ] });
    await importLibraryJson(mk('Banco vermelho', '#ff0000'));
    const antes = JSON.stringify(await repo.listLibrary());
    // sem resolução e sem diálogo: o ID em conflito exige uma escolha (não grava nada)
    await expect(importLibraryJson(mk('Banco azul', '#0000ff'), 'b.json', { resolutions: {} })).rejects.toThrow(/Falta escolher/);
    expect(JSON.stringify(await repo.listLibrary())).toBe(antes);
    // novo ID automático
    const auto = await importLibraryJson(mk('Banco azul', '#0000ff'), 'b.json', { resolveAll: true });
    expect([auto.created, auto.renamed]).toEqual([1, 1]);
    // ID manual
    const man = await importLibraryJson(mk('Banco verde', '#00ff00'), 'c.json', { resolutions: { 'meu-banco': { action: 'manual-id', id: 'Banco-Verde-1' } } });
    expect([man.created, man.renamed]).toEqual([1, 1]);
    // pular
    const skip = await importLibraryJson(mk('Banco amarelo', '#ffff00'), 'd.json', { resolutions: { 'meu-banco': { action: 'skip' } } });
    expect([skip.created, skip.notImported]).toEqual([0, 1]);
    const recs = await repo.listLibrary();
    const ids = recs.map((r) => (r.data as { object: { id: string } }).object.id).sort();
    expect(ids).toHaveLength(3);
    expect(ids).toContain('meu-banco'); // o original continua com o ID dele
    expect(ids).toContain('Banco-Verde-1');
    expect((recs.find((r) => (r.data as { object: { id: string } }).object.id === 'meu-banco')!.data as { object: { name: string } }).object.name).toBe('Banco vermelho');
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
