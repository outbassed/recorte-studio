/** 1.1: salvamento, importação defensiva, .jrec, mídia por conteúdo, áudio e balões. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { createDemoProject } from '@/features/templates/projects';
import { addNode, addScene, addAudioTrack, addAudioClip, sceneOf } from '@/engine/model/ops';
import { createImageNode, createScene } from '@/engine/model/factory';
import { ProjectSchema, type Project } from '@/engine/model/schema';
import { ArchiveError, checkBudget, detectKind, extractArchive, extractTar, extractZip, LIMITS, safePath, type LibarchiveReader } from '@/features/projects/archive';
import { buildJrec, commitParsedProject, MissingMediaError, parseEntries, referencedAssetIds } from '@/features/projects/jrec';
import { mediaIdFor, sniffMedia } from '@/features/library/media';
import { BufferCache } from '@/features/audio/engine';
import { wrapText, bubbleLayout } from '@/engine/render/bubbles';
import { db, repo, StorageQuotaError } from '@/storage/db';
import { commit, loadProject, useProjectStore } from '@/state/projectStore';
import { flushSaves, openProjectObject, retryDelay, saveInternals, saveNow, useSession } from '@/features/projects/session';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PNG2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9, 9]);
const WAV = new Uint8Array([...strToU8('RIFF'), 0, 0, 0, 0, ...strToU8('WAVE'), 1, 2, 3]);

/** Projeto com uma imagem e um áudio referenciados. */
function projectWithMedia(imgId = 'asset_img', audioId = 'asset_snd'): Project {
  const p = createDemoProject();
  const s = sceneOf(p, p.sceneOrder[0]!);
  p.assets[imgId] = { id: imgId, kind: 'image', name: 'foto.png', mime: 'image/png', size: PNG.length, createdAt: 0 };
  p.assets[audioId] = { id: audioId, kind: 'audio', name: 'voz.wav', mime: 'audio/wav', size: WAV.length, durationMs: 1000, createdAt: 0 };
  addNode(s, createImageNode(imgId, 'foto', 100, 100));
  const tr = addAudioTrack(s, 'voice');
  addAudioClip(s, tr.id, audioId, 0, 1000);
  return p;
}

const blobs = (map: Record<string, Uint8Array>) => async (id: string) => (map[id] ? new Blob([map[id] as Uint8Array<ArrayBuffer>]) : undefined);
/** Armazenamento em memória (o Blob do fake-indexeddb no jsdom não lê bytes). */
const mem = new Map<string, Uint8Array>();
const putMem = async (id: string, b: Blob) => { mem.set(id, new Uint8Array(await b.arrayBuffer())); };
const hasMem = async (id: string) => mem.has(id);

describe('detecção e caminhos', () => {
  it('reconhece formatos pelos bytes, não pela extensão', () => {
    expect(detectKind(zipSync({ a: strToU8('x') }))).toBe('zip');
    expect(detectKind(new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4]))).toBe('7z');
    expect(detectKind(strToU8('Rar!\x1a\x07\x01\x00'))).toBe('rar');
    expect(detectKind(new Uint8Array([0x1f, 0x8b, 8]))).toBe('gzip');
    expect(detectKind(new Uint8Array([0xfd, ...strToU8('7zXZ'), 0]))).toBe('xz');
    expect(detectKind(strToU8('BZh91AY'))).toBe('bzip2');
    expect(detectKind(strToU8('  \n{"a":1}'))).toBe('json');
    expect(detectKind(strToU8('olá'))).toBe('unknown');
  });
  it('recusa path traversal, absolutos e lixo de sistema', () => {
    expect(safePath('../../etc/passwd')).toBeNull();
    expect(safePath('assets/../../x')).toBeNull();
    expect(safePath('/abs/x')).toBeNull();
    expect(safePath('C:\\Windows\\x')).toBeNull();
    expect(safePath('__MACOSX/a')).toBeNull();
    expect(safePath('pasta\\assets\\a.png')).toBe('pasta/assets/a.png');
    expect(safePath('./a//b')).toBe('a/b');
  });
  it('tipo de mídia pelo conteúdo', () => {
    expect(sniffMedia(PNG)?.mime).toBe('image/png');
    expect(sniffMedia(WAV)?.kind).toBe('audio');
    expect(sniffMedia(strToU8('<?xml version="1.0"?><svg xmlns="x"></svg>'))?.kind).toBe('svg');
    expect(sniffMedia(strToU8('<html><script>'))).toBeNull();
  });
});

describe('limites anti zip-bomb', () => {
  const tight = { ...LIMITS, entries: 3, entryBytes: 1000, totalBytes: 2500, ratio: 50 };
  it('recusa muitas entradas', () => {
    const z = zipSync({ a: strToU8('1'), b: strToU8('2'), c: strToU8('3'), d: strToU8('4') });
    expect(() => extractZip(z, tight)).toThrow(/limite é 3/);
  });
  it('recusa arquivo grande demais e soma excessiva', () => {
    expect(() => extractZip(zipSync({ a: new Uint8Array(2000) }, { level: 0 }), tight)).toThrow(ArchiveError);
    expect(() => checkBudget([{ name: 'a', size: 900 }, { name: 'b', size: 900 }, { name: 'c', size: 900 }], tight)).toThrow(/soma/);
  });
  it('recusa taxa de compressão de bomba', () => {
    const big = new Uint8Array(20 * 1048576);
    const z = zipSync({ bomba: big }, { level: 9 });
    try {
      extractZip(z, { ...LIMITS, ratio: 200 });
      throw new Error('deveria recusar');
    } catch (e) {
      expect((e as ArchiveError).code).toBe('bomb');
    }
  });
  it('recusa ZIP com senha', () => {
    const z = zipSync({ a: strToU8('x') });
    // Liga o bit de criptografia no cabeçalho central.
    const dv = new DataView(z.buffer);
    for (let i = 0; i < z.length - 4; i++) if (dv.getUint32(i, true) === 0x02014b50) dv.setUint16(i + 8, 1, true);
    expect(() => extractZip(z)).toThrow(/senha/);
  });
  it('ignora entradas com caminho malicioso', () => {
    const z = zipSync({ '../fora.txt': strToU8('mal'), 'ok.txt': strToU8('bem') });
    expect(extractZip(z).map((e) => e.path)).toEqual(['ok.txt']);
  });
  it('ZIP corrompido gera erro claro', () => {
    expect(() => extractZip(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).toThrow(/corrompido/);
  });
  it('TAR: lê arquivos e respeita limites', () => {
    const header = (name: string, size: number) => {
      const h = new Uint8Array(512);
      h.set(strToU8(name), 0);
      h.set(strToU8(size.toString(8).padStart(11, '0')), 124);
      h[156] = 0x30;
      h.set(strToU8('ustar'), 257);
      return h;
    };
    const data = strToU8('conteudo');
    const tar = new Uint8Array(512 * 4);
    tar.set(header('pasta/a.txt', data.length), 0);
    tar.set(data, 512);
    expect(detectKind(tar)).toBe('tar');
    const out = extractTar(tar);
    expect(out.map((e) => e.path)).toEqual(['pasta/a.txt']);
    expect(Array.from(out[0]!.data)).toEqual(Array.from(data));
    expect(() => extractTar(tar, { ...LIMITS, entryBytes: 2 })).toThrow(/grande/);
  });
  it('7z/RAR passam pelo leitor WASM, com senha e limites verificados', async () => {
    const fake = (encrypted: boolean, size = 10): LibarchiveReader => ({
      open: async () => ({
        hasEncryptedData: async () => encrypted,
        getFilesArray: async () => [{ path: '', file: { name: 'project.json', size, extract: async () => new Blob(['{}']) } }],
      }),
    });
    const seven = new Blob([new Uint8Array([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4])]);
    await expect(extractArchive(seven, { reader: async () => fake(true) })).rejects.toThrow(/senha/);
    await expect(extractArchive(seven, { reader: async () => fake(false, LIMITS.entryBytes + 1) })).rejects.toThrow(/limite/);
    const ok = await extractArchive(seven, { reader: async () => fake(false) });
    expect(ok.kind).toBe('7z');
    expect(ok.entries[0]!.path).toBe('project.json');
  });
});

describe('.jrec', () => {
  beforeEach(() => mem.clear());

  it('exporta com manifesto, mídia nativa e verifica antes de declarar sucesso', async () => {
    const p = projectWithMedia();
    const { blob, manifest } = await buildJrec(p, { getBlob: blobs({ asset_img: PNG, asset_snd: WAV }) });
    expect(manifest.format).toBe('recorte-studio-project');
    expect(manifest.assets.map((a) => a.path).sort()).toEqual(['assets/asset_img.png', 'assets/asset_snd.wav']);
    expect(manifest.missing).toEqual([]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(detectKind(bytes)).toBe('zip');
    const entries = extractZip(bytes);
    expect(entries.find((e) => e.path === 'assets/asset_img.png')!.data).toEqual(PNG);
  });

  it('mídia ausente impede o backup e lista o que falta', async () => {
    const p = projectWithMedia();
    await expect(buildJrec(p, { getBlob: blobs({ asset_img: PNG }) })).rejects.toBeInstanceOf(MissingMediaError);
    try {
      await buildJrec(p, { getBlob: blobs({ asset_img: PNG }) });
    } catch (e) {
      expect((e as MissingMediaError).missing).toEqual([{ id: 'asset_snd', name: 'voz.wav' }]);
    }
    const partial = await buildJrec(p, { getBlob: blobs({ asset_img: PNG }), allowMissing: true });
    expect(partial.manifest.missing).toHaveLength(1);
  });

  it('referência a mídia que nem existe no projeto também é detectada', async () => {
    const p = projectWithMedia();
    delete p.assets.asset_snd;
    expect(referencedAssetIds(p).has('asset_snd')).toBe(true);
    await expect(buildJrec(p, { getBlob: blobs({ asset_img: PNG }) })).rejects.toBeInstanceOf(MissingMediaError);
  });

  it('ida e volta em banco limpo: tudo volta, com IDs de conteúdo', async () => {
    const p = projectWithMedia();
    const { blob } = await buildJrec(p, { getBlob: blobs({ asset_img: PNG, asset_snd: WAV }) });
    const parsed = await parseEntries(extractZip(new Uint8Array(await blob.arrayBuffer())));
    if (parsed.kind !== 'project') throw new Error('esperava projeto');
    const imported = await commitParsedProject(parsed, putMem, hasMem);
    expect(() => ProjectSchema.parse(imported)).not.toThrow();
    expect(imported.id).not.toBe(p.id);
    const ids = Object.keys(imported.assets);
    expect(ids.every((id) => id.startsWith('media_'))).toBe(true);
    for (const id of referencedAssetIds(imported)) expect(mem.has(id)).toBe(true);
    expect(Object.keys(imported.scenes)).toEqual(Object.keys(p.scenes));
    expect(imported.sceneOrder).toEqual(p.sceneOrder);
  });

  it('importar duas vezes o mesmo pacote não duplica nem sobrescreve', async () => {
    const p = projectWithMedia();
    const { blob } = await buildJrec(p, { getBlob: blobs({ asset_img: PNG, asset_snd: WAV }) });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const one = await parseEntries(extractZip(bytes));
    const two = await parseEntries(extractZip(bytes));
    if (one.kind !== 'project' || two.kind !== 'project') throw new Error();
    const a = await commitParsedProject(one, putMem, hasMem);
    const b = await commitParsedProject(two, putMem, hasMem);
    expect(a.id).not.toBe(b.id);
    expect(Object.keys(a.assets).sort()).toEqual(Object.keys(b.assets).sort());
    expect(mem.size).toBe(2);
  });

  it('projetos diferentes com a MESMA chave de mídia não se sobrescrevem', async () => {
    const p1 = projectWithMedia('asset_x', 'asset_y');
    const p2 = projectWithMedia('asset_x', 'asset_y');
    const j1 = await buildJrec(p1, { getBlob: blobs({ asset_x: PNG, asset_y: WAV }) });
    const j2 = await buildJrec(p2, { getBlob: blobs({ asset_x: PNG2, asset_y: WAV }) });
    const i1 = await parseEntries(extractZip(new Uint8Array(await j1.blob.arrayBuffer())));
    const i2 = await parseEntries(extractZip(new Uint8Array(await j2.blob.arrayBuffer())));
    if (i1.kind !== 'project' || i2.kind !== 'project') throw new Error();
    const a = await commitParsedProject(i1, putMem, hasMem);
    const b = await commitParsedProject(i2, putMem, hasMem);
    const img = (p: Project) => Object.values(p.assets).find((x) => x.kind === 'image')!.id;
    expect(img(a)).not.toBe(img(b));
    expect(Array.from(mem.get(img(a))!)).toEqual(Array.from(PNG));
    expect(Array.from(mem.get(img(b))!)).toEqual(Array.from(PNG2));
  });

  it('mídia ausente no pacote nunca se liga por acaso ao blob de outro projeto', async () => {
    mem.set('asset_snd', strToU8('outro projeto'));
    const p = projectWithMedia();
    const { blob } = await buildJrec(p, { getBlob: blobs({ asset_img: PNG }), allowMissing: true });
    const parsed = await parseEntries(extractZip(new Uint8Array(await blob.arrayBuffer())));
    if (parsed.kind !== 'project') throw new Error();
    const imported = await commitParsedProject(parsed, putMem, hasMem);
    expect(Object.keys(imported.assets)).not.toContain('asset_snd');
    expect(parsed.missing).toEqual(['voz.wav']);
  });

  it('arquivo adulterado (hash ou tamanho) é recusado como corrompido', async () => {
    const p = projectWithMedia();
    const { blob } = await buildJrec(p, { getBlob: blobs({ asset_img: PNG, asset_snd: WAV }) });
    const entries = extractZip(new Uint8Array(await blob.arrayBuffer()));
    const img = entries.find((e) => e.path.endsWith('.png'))!;
    img.data = PNG2;
    await expect(parseEntries(entries)).rejects.toThrow(/corrompido/);
  });

  it('SVG dentro do pacote é sanitizado', async () => {
    const evil = strToU8('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="5" height="5"/></svg>');
    const p = createDemoProject();
    p.assets.asset_s = { id: 'asset_s', kind: 'svg', name: 'mal.svg', mime: 'image/svg+xml', size: evil.length, createdAt: 0 };
    const zip = zipSync({ 'project.json': strToU8(JSON.stringify(p)), 'assets/asset_s': evil });
    const parsed = await parseEntries(extractZip(zip));
    if (parsed.kind !== 'project') throw new Error();
    const svg = new TextDecoder().decode(parsed.media[0]!.data);
    expect(svg).not.toMatch(/onload|script/);
    expect(parsed.warnings.join(' ')).toMatch(/sanitizado/);
  });

  it('pacote legado .recorte.zip e pasta zipada inteira continuam abrindo', async () => {
    const p = projectWithMedia();
    const legacy = zipSync({ 'meu projeto/project.json': strToU8(JSON.stringify(p)), 'meu projeto/assets/asset_img': PNG, 'meu projeto/assets/asset_snd': WAV });
    const parsed = await parseEntries(extractZip(legacy));
    expect(parsed.kind).toBe('project');
    if (parsed.kind === 'project') expect(parsed.media).toHaveLength(2);
  });

  it('compactado só com mídias vira importação de mídias, nunca projeto', async () => {
    const parsed = await parseEntries([{ path: 'a.png', data: PNG }, { path: 'leia.txt', data: strToU8('oi') }]);
    expect(parsed.kind).toBe('media');
    if (parsed.kind === 'media') expect(parsed.files.map((f) => f.name)).toEqual(['a.png']);
    await expect(parseEntries([{ path: 'x.txt', data: strToU8('nada') }])).rejects.toThrow(/Nenhum projeto/);
  });

  it('ID de conteúdo: mesmos bytes, mesmo ID; bytes diferentes, IDs diferentes', async () => {
    expect((await mediaIdFor(PNG)).id).toBe((await mediaIdFor(new Uint8Array(PNG))).id);
    expect((await mediaIdFor(PNG)).id).not.toBe((await mediaIdFor(PNG2)).id);
  });
});

describe('limpeza de mídias órfãs', () => {
  it('mantém blobs usados por outro projeto ou pela biblioteca', async () => {
    await db.blobs.clear();
    await db.projects.clear();
    await db.library.clear();
    const p = projectWithMedia('media_aaa', 'media_bbb');
    await repo.saveProject(p);
    await db.library.put({ id: 'lib1', kind: 'audio', name: 'x', favorite: 0, createdAt: 0, data: { assetId: 'media_ccc' } });
    for (const id of ['media_aaa', 'media_bbb', 'media_ccc', 'media_zzz']) await repo.putBlob(id, new Blob(['x']), id);
    expect(await repo.collectOrphanBlobs()).toBe(1);
    expect(await repo.hasBlob('media_ccc')).toBe(true);
    expect(await repo.hasBlob('media_zzz')).toBe(false);
  });
});

describe('salvamento automático', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('grava, marca salvo e não grava de novo sem mudança', async () => {
    const p = createDemoProject();
    await openProjectObject(p, 'none');
    const spy = vi.spyOn(repo, 'saveProject');
    commit('x', (d) => { d.title = 'Outro'; });
    await saveNow();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useSession.getState().status).toBe('saved');
    await saveNow();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('chamadas concorrentes não gravam em paralelo e a última versão vence', async () => {
    const p = createDemoProject();
    await openProjectObject(p, 'none');
    let running = 0;
    let maxRunning = 0;
    const real = repo.saveProject.bind(repo);
    vi.spyOn(repo, 'saveProject').mockImplementation(async (proj, thumb) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 20));
      await real(proj, thumb);
      running--;
    });
    commit('a', (d) => { d.title = 'A'; });
    const s1 = saveNow();
    commit('b', (d) => { d.title = 'B'; });
    const s2 = saveNow();
    await Promise.all([s1, s2]);
    await flushSaves();
    expect(maxRunning).toBe(1);
    expect((await repo.loadProject(p.id))!.title).toBe('B');
  });

  it('trocar de projeto durante a gravação não mistura projetos', async () => {
    const a = createDemoProject();
    const b = createDemoProject();
    await repo.saveProject(b);
    await openProjectObject(a, 'none');
    commit('a', (d) => { d.title = 'Só do A'; });
    void saveNow();
    await openProjectObject(b, 'none');
    expect((await repo.loadProject(a.id))!.title).toBe('Só do A');
    expect((await repo.loadProject(b.id))!.title).not.toBe('Só do A');
    expect(saveInternals().saved.projectId).toBe(b.id);
    expect(useProjectStore.getState().project!.id).toBe(b.id);
  });

  it('erro persistente: espera crescente, um aviso, e nada de laço rápido', async () => {
    const p = createDemoProject();
    await openProjectObject(p, 'none');
    const spy = vi.spyOn(repo, 'saveProject').mockRejectedValue(new StorageQuotaError('cheio'));
    vi.useFakeTimers();
    commit('a', (d) => { d.title = 'X'; });
    await vi.advanceTimersByTimeAsync(800);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useSession.getState().status).toBe('error');
    await vi.advanceTimersByTimeAsync(1500);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(2);
    // Editar durante o erro não antecipa a próxima tentativa.
    commit('b', (d) => { d.title = 'Y'; });
    await vi.advanceTimersByTimeAsync(1000);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(retryDelay(1)).toBe(2000);
    expect(retryDelay(10)).toBe(60000);
    spy.mockRestore();
    await vi.advanceTimersByTimeAsync(5000);
    expect(useSession.getState().status).toBe('saved');
  });

  it('recarregar mantém o que foi salvo', async () => {
    const p = createDemoProject();
    await openProjectObject(p, 'none');
    commit('a', (d) => { addScene(d as Project, createScene('Nova')); });
    await saveNow();
    loadProject(createDemoProject());
    const back = await repo.loadProject(p.id);
    expect(back!.sceneOrder).toHaveLength(2);
  });
});

describe('áudio e texto', () => {
  it('cache de áudio respeita o limite de memória (LRU)', async () => {
    const cache = new BufferCache<{ n: number }>(100, (v) => v.n);
    await cache.get('a', async () => ({ n: 60 }));
    await cache.get('b', async () => ({ n: 30 }));
    await cache.get('a', async () => ({ n: 60 }));
    await cache.get('c', async () => ({ n: 40 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(cache.usedBytes).toBeLessThanOrEqual(100);
    const loads: string[] = [];
    await cache.get('a', async () => { loads.push('a'); return { n: 60 }; });
    expect(loads).toEqual([]);
  });

  it('palavra enorme quebra em pedaços e nenhuma linha estoura', () => {
    const lines = wrapText('Ah! Supercalifragilisticexpialidocious-e-mais-um-pouco ok', 12);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
    expect(lines.join('').replace(/-/g, '')).toContain('Supercalif');
  });

  it('balão com texto longo encolhe a fonte e fica dentro do quadro', () => {
    const text = 'palavra '.repeat(120);
    const b = bubbleLayout({ text, style: 'speech', scale: 1, offsetX: 0, offsetY: 0, frameW: 1920, frameH: 1080, headX: 0, headY: -100, headR: 100 });
    expect(b.y).toBeGreaterThanOrEqual(-540);
    expect(b.y + b.h).toBeLessThanOrEqual(540);
    expect(b.fontSize).toBeLessThan(38);
  });
});
