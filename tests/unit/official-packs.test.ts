import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '@/engine/model/factory';
import { buildCatalog, DEFAULT_QUERY, queryCatalog } from '@/features/catalog/catalog';
import { analyzeImport, canonOf } from '@/features/packs/conflicts';
import { builtinIds } from '@/features/packs/builtinIds';
import { buildPack, innerIdOf, readPack } from '@/features/packs/format';
import { fetchOfficialIndex, fetchOfficialPack, groupByCollection, installOrder, officialStatus, OfficialIndexSchema, type OfficialEntry } from '@/features/packs/official';
import { db, repo } from '@/storage/db';
import { exportPackBytes, installCollection, installOfficial, installOfficialItem, installPackBytes, loadOfficialIndex, reloadPacks, removePack, useOfficial, usePacks } from '@/state/packActions';
import { buildOfficial } from '../../tools/packs/lib';
import { itemSvg } from '../../tools/packs/preview';
import { SOURCES } from '../../tools/packs/sources';

const DIR = resolve('public/packs');
const file = (n: string) => new Uint8Array(readFileSync(resolve(DIR, n)));
const index = OfficialIndexSchema.parse(JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8')));
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const VT = (n: string) => JSON.parse(readFileSync(resolve('tools/packs/sources/vila-torta/data', n), 'utf8')) as unknown[];

describe('catálogo oficial: arquivos e índice', () => {
  it('há pacotes e nenhum está vazio', () => {
    expect(index.packs.length).toBeGreaterThanOrEqual(7);
    for (const p of index.packs) expect(p.itemCount, p.id).toBeGreaterThan(0);
  });

  it('cada pacote: arquivo existe, tamanho e sha256 conferem, lê pelo leitor real e bate com o índice', async () => {
    for (const e of index.packs) {
      const bytes = file(e.file);
      expect(bytes.length, e.id).toBe(e.size);
      expect(sha(bytes), e.id).toBe(e.sha256);
      const r = await readPack(bytes);
      expect(r.ok, `${e.id}: ${r.ok ? '' : r.reason}`).toBe(true);
      if (!r.ok) continue;
      const m = r.pack.manifest;
      expect([m.id, m.version, m.name, m.collection, m.volume, m.license]).toEqual([e.id, e.version, e.name, e.collection, e.volume, e.license]);
      expect(r.pack.items.length).toBe(e.itemCount);
      expect(r.pack.items.map((i) => i.id)).toEqual(e.items.map((i) => i.id));
      const counts: Record<string, number> = {};
      for (const i of r.pack.items) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
      expect(counts, e.id).toEqual(e.counts);
      expect(e.coverSvg, `${e.id} sem capa`).toBeTruthy();
      for (const it of r.pack.items) {
        expect(it.name.trim(), e.id).not.toBe('');
        expect(it.meta?.category, `${e.id}/${it.id} sem categoria`).toBeTruthy();
      }
    }
  });

  it('IDs de item são únicos em TODOS os pacotes oficiais juntos e não colidem com itens padrão', async () => {
    const std = new Set(builtinIds().map((b) => b.id));
    const seen = new Map<string, string>();
    for (const e of index.packs) {
      const r = await readPack(file(e.file));
      if (!r.ok) throw new Error(r.reason);
      for (const it of r.pack.items) {
        const id = innerIdOf(it);
        expect(seen.get(id), `ID ${id} repetido em ${e.id} e ${seen.get(id)}`).toBeUndefined();
        expect(std.has(id), `ID ${id} (${e.id}) colide com item padrão`).toBe(false);
        seen.set(id, e.id);
      }
    }
  });

  it('os arquivos publicados são exatamente o que as fontes geram (nada desatualizado)', async () => {
    for (const load of SOURCES) {
      const built = await buildOfficial(await load());
      const published = index.packs.find((p) => p.id === built.entry.id);
      expect(published, `pacote ${built.entry.id} fora do índice`).toBeTruthy();
      expect(built.entry.sha256, `${built.entry.id} está desatualizado: rode npm run packs:build`).toBe(published!.sha256);
    }
    expect(index.packs.length).toBe(SOURCES.length);
  });

  it('nenhum item é duplicata disfarçada de outro (mesmo desenho com ID ou nome diferente)', async () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const e of index.packs) {
      const r = await readPack(file(e.file));
      if (!r.ok) throw new Error(r.reason);
      for (const it of r.pack.items) {
        // Desenho sem a identidade: ID, nome e IDs internos das peças não contam.
        const raw = JSON.stringify(it.data, (k, v) => (k === 'id' || k === 'name' || k === 'createdAt' || k === 'updatedAt' ? undefined : v));
        const key = `${it.kind}|${raw}`;
        const other = seen.get(key);
        if (other) dups.push(`"${it.name}" (${e.id}) = ${other}`);
        else seen.set(key, `"${it.name}" (${e.id})`);
      }
    }
    expect(dups).toEqual([]);
  });

  it('todo item é desenhável pelo renderizador do app, sem erro e sem NaN; objetos têm peças; animados têm quadros', async () => {
    let drawn = 0;
    for (const e of index.packs) {
      const r = await readPack(file(e.file));
      if (!r.ok) throw new Error(r.reason);
      for (const it of r.pack.items) {
        const svg = itemSvg({ id: it.id, kind: it.kind, name: it.name, data: it.data }, { size: 100 });
        expect(svg.length, `${e.id}/${it.id} desenho vazio`).toBeGreaterThan(200);
        expect(svg, `${e.id}/${it.id} tem NaN`).not.toMatch(/NaN|undefined|Infinity/);
        if (it.kind === 'object') {
          expect(it.data.object.pieces.length, `${e.id}/${it.id} sem peças`).toBeGreaterThan(0);
          for (const c of it.data.object.clips) expect(c.frames.length, `${e.id}/${it.id} animação sem quadros`).toBeGreaterThan(1);
        }
        drawn++;
      }
    }
    expect(drawn).toBe(index.packs.reduce((s, p) => s + p.itemCount, 0));
  });

  it('dependências do índice existem no próprio índice', () => {
    const ids = new Set(index.packs.map((p) => p.id));
    for (const p of index.packs) for (const d of p.dependencies) expect(ids.has(d.id), `${p.id} → ${d.id}`).toBe(true);
  });
});

describe('arquivos de assets avulsos para a Biblioteca loja', () => {
  it('cada item tem um .rspack exclusivo com SHA-256, miniatura e exatamente um item', async () => {
    const files = new Set<string>();
    for (const p of index.packs) for (const it of p.items) {
      expect(it.single, p.id + '/' + it.id).toBeDefined();
      expect(it.thumbSvg, p.id + '/' + it.id + ' sem miniatura').toMatch(/^<svg/);
      if (!it.single) continue;
      expect(files.has(it.single.file)).toBe(false);
      files.add(it.single.file);
      const bytes = file(it.single.file);
      expect(bytes.length).toBe(it.single.size);
      expect(sha(bytes)).toBe(it.single.sha256);
      const read = await readPack(bytes);
      expect(read.ok, it.id).toBe(true);
      if (!read.ok) continue;
      expect(read.pack.items).toHaveLength(1);
      expect(read.pack.items[0]?.id).toBe(it.id);
      expect(read.pack.manifest.license).toBe(p.license);
    }
    expect(files.size).toBe(875);
  });
});

describe('Vila Torta: fidelidade e limites do que é oficial', () => {
  const all = async () => {
    const out: Array<{ pack: string; item: Awaited<ReturnType<typeof readPack>> extends infer R ? (R extends { ok: true; pack: infer P } ? P extends { items: Array<infer I> } ? I : never : never) : never }> = [];
    for (const e of index.packs.filter((p) => p.collection === 'Vila Torta')) {
      const r = await readPack(file(e.file));
      if (!r.ok) throw new Error(r.reason);
      for (const item of r.pack.items) out.push({ pack: e.id, item });
    }
    return out;
  };

  it('os sete pacotes existem, com os nomes de volume pedidos', () => {
    expect(index.packs.filter((p) => p.collection === 'Vila Torta').map((p) => p.id).sort()).toEqual([
      'vila-torta-assets-1', 'vila-torta-assets-2', 'vila-torta-cenarios-1', 'vila-torta-personagens-1', 'vila-torta-personagens-2', 'vila-torta-personagens-3', 'vila-torta-veiculos-1',
    ]);
  });

  it('personagens, objetos e cenários são IDÊNTICOS aos extraídos dos episódios (IDs, desenho e notas)', async () => {
    const items = await all();
    const byId = new Map(items.map((x) => [innerIdOf(x.item), x.item]));
    for (const c of VT('characters.json') as Array<{ id: string }>) expect(canonOf('character', byId.get(c.id)!.data), c.id).toBe(canonOf('character', c));
    for (const o of VT('objects.json') as Array<{ object: { id: string } }>) expect(canonOf('object', byId.get(o.object.id)!.data), o.object.id).toBe(canonOf('object', o));
    for (const b of VT('backgrounds.json') as Array<{ background: { id: string } }>) expect(canonOf('background', byId.get(b.background.id)!.data), b.background.id).toBe(canonOf('background', b));
    expect(items.length).toBe(36 + 53 + 6);
  });

  it('os sete personagens principais e o cantor Lon Ruan estão, com os IDs originais dos episódios', async () => {
    const chars = (await all()).filter((x) => x.item.kind === 'character');
    const names = new Map(chars.map((x) => [x.item.name, innerIdOf(x.item)]));
    for (const n of ['Rafael', 'Beatriz', 'Caíque', 'Samuca', 'Larissa', 'Senhor Gaivota', 'Doutor Pinote', 'Lon Ruan']) expect(names.has(n), n).toBe(true);
    expect(names.get('Rafael')).toBe('vt-rafa');
    expect(names.get('Caíque')).toBe('vt-caique');
    expect(names.get('Samuca')).toBe('vt-samuca');
    expect(names.get('Beatriz')).toBe('char_nanob6ccx9');
    // nenhum personagem aparece duas vezes (o mesmo desenho com IDs diferentes entre episódios virou um só)
    expect(names.size).toBe(chars.length);
  });

  it('NÃO há personagens ainda sem aprovação (Ramires, Valentina, Rodrigues) nem "Narigaço", nem pais inventados', async () => {
    const text = JSON.stringify((await all()).map((x) => [x.item.name, 'notes' in x.item.data ? (x.item.data as { notes: string }).notes : '']));
    for (const t of ['Ramires', 'Valentina', 'Rodrigues', 'Narigaço', 'Narigatti', 'Fernández']) expect(text, t).not.toContain(t);
  });

  it('personagens preservam as notas canônicas originais (ex.: Samuca nunca fala palavrões)', async () => {
    const samuca = (await all()).find((x) => x.item.name === 'Samuca')!.item;
    expect((samuca.data as { notes: string }).notes).toContain('REGRA ABSOLUTA');
  });
});

describe('instalação oficial: ciclo completo com arquivos reais', () => {
  const served = new Map<string, Uint8Array>();
  const serve = (name: string, bytes: Uint8Array) => served.set(name, bytes);
  beforeEach(async () => {
    served.clear();
    serve('index.json', new TextEncoder().encode(readFileSync(resolve(DIR, 'index.json'), 'utf8')));
    for (const p of index.packs) serve(p.file, file(p.file));
    for (const p of index.packs) for (const item of p.items) if (item.single) serve(item.single.file, file(item.single.file));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const name = String(url).split('/packs/')[1]!;
      const b = served.get(name);
      if (!b) return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) };
      return { ok: true, status: 200, json: async () => JSON.parse(new TextDecoder().decode(b)), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
    }));
    await db.packs.clear();
    await db.library.clear();
    usePacks.setState({ packs: [], loaded: false });
    useOfficial.setState({ index: null, loading: false, error: null });
    await loadOfficialIndex();
  });
  afterEach(() => vi.unstubAllGlobals());
  const entry = (id: string) => useOfficial.getState().index!.packs.find((p) => p.id === id)!;

  it('baixa um único asset sem instalar o kit, preservando ID e permitindo instalar volume depois', async () => {
    const origin = entry('acessorios-1');
    const first = origin.items[0]!;
    const one = await installOfficialItem(origin, first.id);
    expect(one.ok).toBe(true);
    let installed = await repo.listPacks();
    expect(installed).toHaveLength(1);
    expect(installed[0]?.id.startsWith('rs-item-')).toBe(true);
    expect(installed[0]?.items.map((i) => i.id)).toEqual([first.id]);
    const full = await installOfficial(origin);
    expect(full.ok).toBe(true);
    installed = await repo.listPacks();
    expect(installed).toHaveLength(2);
    expect(installed.find((p) => p.id === origin.id)?.items).toHaveLength(origin.items.length - 1);
    expect(installed.flatMap((p) => p.items)).toHaveLength(origin.items.length);
  });

  it('carrega o índice pela rede (validado) e rejeita índice inválido', async () => {
    expect(useOfficial.getState().index?.packs.length).toBe(index.packs.length);
    expect(useOfficial.getState().error).toBeNull();
    serve('index.json', new TextEncoder().encode('{"format":"x"}'));
    await expect(fetchOfficialIndex()).rejects.toThrow(/inválido/);
  });

  it('instala um volume pelo catálogo: itens reais aparecem misturados no catálogo, com origem oficial', async () => {
    const r = await installOfficial(entry('vila-torta-personagens-1'));
    expect(r.ok && r.summary.items).toBe(7);
    const rec = (await repo.getPack('vila-torta-personagens-1'))!;
    expect(rec.source).toBe('official');
    expect(rec.fileSha256).toBe(entry('vila-torta-personagens-1').sha256);
    const cat = buildCatalog({ project: createProject('t'), library: [], favorites: new Set(), packs: usePacks.getState().packs });
    const chars = queryCatalog(cat, 'cast', { ...DEFAULT_QUERY, filter: 'official' });
    expect(chars.map((e) => e.name).sort()).toEqual(['Beatriz', 'Caíque', 'Doutor Pinote', 'Larissa', 'Rafael', 'Samuca', 'Senhor Gaivota']);
    expect(chars.every((e) => e.collection === 'Vila Torta' && e.category === 'Personagens')).toBe(true);
    expect(queryCatalog(cat, 'all', { ...DEFAULT_QUERY, text: 'id:vt-rafa' }).map((e) => e.name)).toEqual(['Rafael']);
    expect(queryCatalog(cat, 'all', { ...DEFAULT_QUERY, theme: 'series' }).length).toBe(7);
  });

  it('arquivo adulterado (sha256 diferente do índice) é recusado antes de ser lido', async () => {
    const bad = new Uint8Array(file('vila-torta-veiculos-1.rspack'));
    bad[bad.length - 30] ^= 0xff;
    serve('vila-torta-veiculos-1.rspack', bad);
    await expect(fetchOfficialPack(entry('vila-torta-veiculos-1'))).rejects.toThrow(/sha256|tamanho/);
    const r = await installOfficial(entry('vila-torta-veiculos-1'));
    expect(r.ok).toBe(false);
    expect(await repo.getPack('vila-torta-veiculos-1')).toBeUndefined();
  });

  it('instalar a coleção inteira instala todos os volumes e uma segunda vez não repete nada', async () => {
    const col = groupByCollection(index.packs).find((g) => g.name === 'Vila Torta')!;
    expect(col.packs.length).toBe(7);
    const r = await installCollection(col.packs);
    expect(r).toMatchObject({ installed: 7, failed: [], cancelled: false });
    expect(usePacks.getState().packs.length).toBe(7);
    expect(usePacks.getState().packs.reduce((s, p) => s + p.items.length, 0)).toBe(95);
    expect((await installCollection(col.packs)).installed).toBe(0);
    for (const p of col.packs) expect(officialStatus(p, usePacks.getState().packs)).toBe('installed');
  });

  it('remoção segura: itens somem do catálogo; um pacote que outro exige não é removido; reinstalar devolve tudo', async () => {
    await installOfficial(entry('vila-torta-personagens-1'));
    const catalog = () => buildCatalog({ project: createProject('t'), library: [], favorites: new Set(), packs: usePacks.getState().packs }).filter((e) => e.origin === 'pack');
    expect(catalog().length).toBe(7);
    vi.spyOn(await import('@/state/uiStore'), 'confirmDialog').mockResolvedValue(true);
    expect(await removePack('vila-torta-personagens-1')).toBe(true);
    expect(catalog().length).toBe(0);
    expect((await installOfficial(entry('vila-torta-personagens-1'))).ok).toBe(true);
    expect(catalog().length).toBe(7);
  });

  it('atualização legítima: versão mais nova do MESMO pacote oficial atualiza sem conflito e mantém ativo/inativo', async () => {
    await installOfficial(entry('vila-torta-veiculos-1'));
    const first = (await readPack(file('vila-torta-veiculos-1.rspack')));
    if (!first.ok) throw new Error(first.reason);
    const bytes2 = await buildPack({ ...first.pack.manifest, version: '1.1.0', description: 'v2' }, first.pack.items.map((i) => ({ id: i.id, kind: i.kind, name: i.name, data: i.data, meta: i.meta })), [], { deterministic: true });
    serve('vila-torta-veiculos-1.rspack', bytes2);
    const e2: OfficialEntry = { ...entry('vila-torta-veiculos-1'), version: '1.1.0', sha256: sha(bytes2), size: bytes2.length };
    expect(officialStatus(e2, usePacks.getState().packs)).toBe('update');
    await (await import('@/state/packActions')).setPackEnabled('vila-torta-veiculos-1', false);
    const r = await installOfficial(e2);
    expect(r.ok && r.updated).toBe(true);
    const rec = (await repo.getPack('vila-torta-veiculos-1'))!;
    expect([rec.version, rec.enabled, rec.items.length]).toEqual(['1.1.0', 0, 6]);
  });

  it('arquivo importado com o ID de um pacote oficial instalado é conflito de origem (não substitui o oficial)', async () => {
    await installOfficial(entry('vila-torta-veiculos-1'));
    const first = (await readPack(file('vila-torta-veiculos-1.rspack')));
    if (!first.ok) throw new Error(first.reason);
    const forged = await buildPack({ ...first.pack.manifest, version: '9.0.0' }, first.pack.items.map((i) => ({ id: i.id, kind: i.kind, name: `${i.name} falso`, data: i.data })), [], { deterministic: true });
    const r = await installPackBytes(forged);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.analysis?.packConflict?.kind).toBe('origin-mismatch');
    expect((await repo.getPack('vila-torta-veiculos-1'))!.version).toBe('1.0.0');
  });

  it('personagem já na minha biblioteca com o MESMO desenho é duplicata (não duplica nem sobrescreve); com desenho diferente é conflito', async () => {
    const rafael = (VT('characters.json') as Array<{ id: string; name: string }>).find((c) => c.id === 'vt-rafa')!;
    const lib = (data: unknown) => ({ id: 'lib_x', kind: 'character' as const, name: 'Rafael', favorite: 1, createdAt: 1, data });
    const parsed = await readPack(file('vila-torta-personagens-1.rspack'));
    if (!parsed.ok) throw new Error(parsed.reason);
    const same = analyzeImport(parsed.pack, { packs: [], library: [lib({ ...rafael, favorite: true })], builtin: builtinIds(), incomingSource: 'official' });
    expect(same.duplicates.map((d) => d.innerId)).toEqual(['vt-rafa']);
    expect(same.conflicts).toEqual([]);
    const other = analyzeImport(parsed.pack, { packs: [], library: [lib({ ...rafael, skin: '#000000' })], builtin: builtinIds(), incomingSource: 'official' });
    expect(other.conflicts.map((c) => c.innerId)).toEqual(['vt-rafa']);
    // a biblioteca do usuário continua intacta
    await db.library.put(lib({ ...rafael, skin: '#000000' }));
    const r = await installPackBytes(file('vila-torta-personagens-1.rspack'), { source: 'official' });
    expect(r.ok).toBe(false); // sem escolha, nada é gravado
    expect((await db.library.get('lib_x'))!.favorite).toBe(1);
    expect(await repo.getPack('vila-torta-personagens-1')).toBeUndefined();
    const auto = await installPackBytes(file('vila-torta-personagens-1.rspack'), { source: 'official', resolveAll: true });
    expect(auto.ok && auto.summary.autoIds).toBe(1);
    const ids = (await repo.getPack('vila-torta-personagens-1'))!.items.map(innerIdOf);
    expect(ids).toHaveLength(7);
    expect(ids.filter((i) => i === 'vt-rafa')).toHaveLength(0); // o Rafael do pacote ganhou outro ID; o da biblioteca continua com vt-rafa
    expect(((await db.library.get('lib_x'))!.data as { id: string }).id).toBe('vt-rafa');
  });

  it('exportar um pacote oficial instalado e reimportar (banco limpo) devolve o mesmo conteúdo', async () => {
    await installOfficial(entry('vila-torta-assets-2'));
    const before = (await repo.getPack('vila-torta-assets-2'))!.items.map((i) => canonOf(i.kind, i.data));
    const out = (await exportPackBytes('vila-torta-assets-2'))!;
    await db.packs.clear();
    await reloadPacks();
    expect((await installPackBytes(out.bytes)).ok).toBe(true);
    expect((await repo.getPack('vila-torta-assets-2'))!.items.map((i) => canonOf(i.kind, i.data))).toEqual(before);
  });

  it('ordem de instalação respeita dependências', () => {
    const a = { ...entry('vila-torta-assets-1'), dependencies: [{ id: 'vila-torta-veiculos-1', version: '1.0.0' }] };
    const all = index.packs.map((p) => (p.id === a.id ? a : p));
    expect(installOrder([a], all).map((p) => p.id)).toEqual(['vila-torta-veiculos-1', 'vila-torta-assets-1']);
  });
});

