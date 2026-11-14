import { describe, expect, it } from 'vitest';
import { CharacterDefinitionSchema, CustomBackgroundSchema, CustomObjectSchema, type CustomObject } from '@/engine/model/schema';
import { createPiece, freezeCharacter } from '@/engine/world/pieces';
import { deepClone } from '@/engine/model/ids';
import { isUuidV4 } from '@/features/library/itemIds';
import { applyIdMap, analyzeImport, canonicalJson, canSkipItem, dependentsOf, planImport, separatePackId, type AnalyzeInput } from '@/features/packs/conflicts';
import { builtinIds } from '@/features/packs/builtinIds';
import { buildPack, innerIdOf, itemIntegrityProblem, readPack, type BuildItem, type ParsedPack } from '@/features/packs/format';
import type { LibraryRecord, PackRecord } from '@/storage/db';

const obj = (id: string, name: string, fill = '#aa0000', extra: Partial<CustomObject> = {}): CustomObject =>
  CustomObjectSchema.parse({ id, name, pieces: [createPiece('rect', { id: 'p1', fill })], ...extra });
const objItem = (id: string, name: string, o: CustomObject, nested: CustomObject[] = []): BuildItem => ({ id, kind: 'object', name, data: { bundle: 2, object: o, objects: nested, assets: [] } });
const charItem = (id: string, name: string, over: Record<string, unknown> = {}): BuildItem => ({ id, kind: 'character', name, data: CharacterDefinitionSchema.parse({ id, name, ...over }) });
const bgItem = (id: string, name: string): BuildItem => ({ id, kind: 'background', name, data: { bundle: 2, background: CustomBackgroundSchema.parse({ id, name, compositions: { day: { pieces: [createPiece('rect', { id: 'c' })] } } }), objects: [], assets: [] } });

async function pack(id: string, version: string, items: BuildItem[], name = `Pacote ${id}`): Promise<{ parsed: ParsedPack; bytes: Uint8Array }> {
  const bytes = await buildPack({ id, name, version, description: '', author: 'Teste', license: 'CC0', category: 'Teste', dependencies: [] }, items, [], { deterministic: true });
  const r = await readPack(bytes);
  if (!r.ok) throw new Error(r.reason);
  return { parsed: r.pack, bytes };
}
const record = (p: ParsedPack, source: 'official' | 'imported' = 'imported', extra: Partial<PackRecord> = {}): PackRecord => ({
  id: p.manifest.id, name: p.manifest.name, version: p.manifest.version, enabled: 1, installedAt: 1, size: p.size, manifest: p.manifest, items: p.items, assets: [], source, ...extra,
});
const lib = (kind: LibraryRecord['kind'], name: string, data: unknown, id = `lib_${name}`): LibraryRecord => ({ id, kind, name, favorite: 0, createdAt: 1, data });
const input = (over: Partial<AnalyzeInput> = {}): AnalyzeInput => ({ packs: [], library: [], builtin: [], incomingSource: 'imported', ...over });

describe('Conflitos de ID ao importar .rspack: detecção', () => {
  it('importa sem conflitos quando nenhum ID existe', async () => {
    const { parsed } = await pack('novo-pacote', '1.0.0', [objItem('mesa', 'Mesa', obj('mesa', 'Mesa')), charItem('ana', 'Ana')]);
    const a = analyzeImport(parsed, input());
    expect(a.status).toBe('new');
    expect(a.conflicts).toEqual([]);
    expect(a.duplicates).toEqual([]);
    expect(a.clean).toEqual(['mesa', 'ana']);
  });

  it('mesmo NOME com IDs diferentes: importa normalmente (só informa)', async () => {
    const { parsed } = await pack('novo-pacote', '1.0.0', [charItem('rafael-2', 'Rafael')]);
    const lb = [lib('character', 'Rafael', CharacterDefinitionSchema.parse({ id: 'rafael-1', name: 'Rafael' }))];
    const a = analyzeImport(parsed, input({ library: lb }));
    expect(a.conflicts).toEqual([]);
    expect(a.clean).toEqual(['rafael-2']);
    expect(a.sameNameOtherId).toHaveLength(1);
    expect(a.sameNameOtherId[0]!.existing.id).toBe('rafael-1');
  });

  it('mesmo ID e mesmo conteúdo: duplicata reconhecida, não é conflito', async () => {
    const o = obj('mesa', 'Mesa');
    const { parsed } = await pack('novo-pacote', '1.0.0', [objItem('mesa', 'Mesa', o)]);
    const a = analyzeImport(parsed, input({ library: [lib('object', 'Mesa', { bundle: 2, object: { ...o, createdAt: 999, updatedAt: 999 }, objects: [], assets: [] })] }));
    expect(a.conflicts).toEqual([]);
    expect(a.duplicates).toHaveLength(1);
    expect(a.duplicates[0]).toMatchObject({ itemId: 'mesa', innerId: 'mesa' });
  });

  it('personagem idêntico é duplicata mesmo com favorito diferente e vindo de outro lugar (biblioteca × pacote)', async () => {
    const c = charItem('vt-rafa', 'Rafael', { notes: 'ficha' });
    const { parsed } = await pack('novo-pacote', '1.0.0', [c]);
    const mine = lib('character', 'Rafael', { ...(c.data as object), favorite: true });
    const a = analyzeImport(parsed, input({ library: [mine] }));
    expect(a.duplicates).toHaveLength(1);
    expect(a.conflicts).toHaveLength(0);
  });

  it('mesmo ID com conteúdo diferente: conflito, com item existente, item importado, ID, origens e pacotes', async () => {
    const other = await pack('outro-pacote', '2.1.0', [objItem('cadeira', 'Cadeira velha', obj('cadeira', 'Cadeira velha', '#00aa00'))], 'Móveis Velhos');
    const { parsed } = await pack('novo-pacote', '1.0.0', [objItem('cadeira', 'Cadeira nova', obj('cadeira', 'Cadeira nova', '#0000aa'))]);
    const a = analyzeImport(parsed, input({ packs: [record(other.parsed, 'official')] }));
    expect(a.conflicts).toHaveLength(1);
    const c = a.conflicts[0]!;
    expect(c).toMatchObject({ innerId: 'cadeira', name: 'Cadeira nova', reason: 'different-content' });
    expect(c.existing).toMatchObject({ id: 'cadeira', name: 'Cadeira velha', origin: 'pack', packId: 'outro-pacote', packName: 'Móveis Velhos', packVersion: '2.1.0', official: true });
  });

  it('conflito também com a minha biblioteca', async () => {
    const { parsed } = await pack('novo-pacote', '1.0.0', [objItem('mesa', 'Mesa do pacote', obj('mesa', 'Mesa do pacote', '#111111'))]);
    const a = analyzeImport(parsed, input({ library: [lib('object', 'Minha mesa', { bundle: 2, object: obj('mesa', 'Minha mesa', '#222222'), objects: [], assets: [] })] }));
    expect(a.conflicts[0]!.existing).toMatchObject({ origin: 'mine', name: 'Minha mesa' });
  });

  it('ID de item padrão do app é sempre conflito (nunca idêntico)', async () => {
    const std = builtinIds();
    expect(std.length).toBeGreaterThan(20);
    const nina = std.find((b) => b.id === 'nina')!;
    expect(nina).toBeTruthy();
    const { parsed } = await pack('novo-pacote', '1.0.0', [charItem('nina', 'Nina do pacote')]);
    const a = analyzeImport(parsed, input({ builtin: std }));
    expect(a.conflicts).toHaveLength(1);
    expect(a.conflicts[0]).toMatchObject({ reason: 'builtin', existing: { origin: 'builtin' } });
    expect(a.duplicates).toHaveLength(0);
  });

  it('Rafael e rafael são IDs diferentes: não há conflito entre eles', async () => {
    const { parsed } = await pack('novo-pacote', '1.0.0', [charItem('rafael', 'Rafael minúsculo')]);
    const a = analyzeImport(parsed, input({ library: [lib('character', 'Rafael', CharacterDefinitionSchema.parse({ id: 'Rafael', name: 'Rafael' }))] }));
    expect(a.conflicts).toEqual([]);
  });
});

describe('Conflitos de ID: situação do pacote (mesmo ID de pacote)', () => {
  it('versão mais nova, mesma origem: atualização legítima, sem conflito de pacote', async () => {
    const v1 = await pack('natal-1', '1.0.0', [objItem('arvore', 'Árvore', obj('arvore', 'Árvore'))]);
    const v2 = await pack('natal-1', '1.1.0', [objItem('arvore', 'Árvore', obj('arvore', 'Árvore', '#00ff00'))]);
    const a = analyzeImport(v2.parsed, input({ packs: [record(v1.parsed, 'official')], incomingSource: 'official' }));
    expect(a.status).toBe('update');
    expect(a.packConflict).toBeUndefined();
    // os itens da versão antiga serão substituídos: não contam como "já existem"
    expect(a.conflicts).toEqual([]);
    expect(a.duplicates).toEqual([]);
  });

  it('mesmo ID de pacote, origem incompatível (arquivo importado × pacote oficial): conflito de pacote', async () => {
    const v1 = await pack('natal-1', '1.0.0', [objItem('arvore', 'Árvore', obj('arvore', 'Árvore'))]);
    const fake = await pack('natal-1', '2.0.0', [objItem('arvore', 'Árvore falsa', obj('arvore', 'Árvore falsa', '#000000'))]);
    const a = analyzeImport(fake.parsed, input({ packs: [record(v1.parsed, 'official')], incomingSource: 'imported' }));
    expect(a.packConflict).toMatchObject({ kind: 'origin-mismatch', existing: { source: 'official' }, incoming: { source: 'imported' } });
  });

  it('registro antigo sem "source" vale como importado', async () => {
    const v1 = await pack('kit-x', '1.0.0', [objItem('a', 'A', obj('a', 'A'))]);
    const old = record(v1.parsed);
    delete old.source;
    const v2 = await pack('kit-x', '1.1.0', [objItem('a', 'A', obj('a', 'A'))]);
    expect(analyzeImport(v2.parsed, input({ packs: [old], incomingSource: 'imported' })).packConflict).toBeUndefined();
    expect(analyzeImport(v2.parsed, input({ packs: [old], incomingSource: 'official' })).packConflict?.kind).toBe('origin-mismatch');
  });

  it('mesma versão e mesmo arquivo: já instalado; mesma versão com conteúdo diferente: conflito', async () => {
    const v1 = await pack('kit-x', '1.0.0', [objItem('a', 'A', obj('a', 'A'))]);
    const same = analyzeImport(v1.parsed, input({ packs: [record(v1.parsed, 'imported', { fileSha256: 'abc' })], incomingSha256: 'abc' }));
    expect(same.status).toBe('identical');
    expect(same.packConflict).toBeUndefined();
    const changed = await pack('kit-x', '1.0.0', [objItem('a', 'A', obj('a', 'A', '#123456'))]);
    const diff = analyzeImport(changed.parsed, input({ packs: [record(v1.parsed, 'imported', { fileSha256: 'abc' })], incomingSha256: 'zzz' }));
    expect(diff.packConflict?.kind).toBe('same-version-different-content');
  });

  it('versão mais velha que a instalada é reconhecida como "older"', async () => {
    const v2 = await pack('kit-x', '2.0.0', [objItem('a', 'A', obj('a', 'A'))]);
    const v1 = await pack('kit-x', '1.0.0', [objItem('a', 'A', obj('a', 'A'))]);
    expect(analyzeImport(v1.parsed, input({ packs: [record(v2.parsed)] })).status).toBe('older');
  });

  it('como pacote separado, os itens do pacote já instalado passam a contar como existentes', async () => {
    const v1 = await pack('natal-1', '1.0.0', [objItem('arvore', 'Árvore', obj('arvore', 'Árvore'))]);
    const fake = await pack('natal-1', '2.0.0', [objItem('arvore', 'Árvore falsa', obj('arvore', 'Árvore falsa', '#000000'))]);
    const a = analyzeImport(fake.parsed, input({ packs: [record(v1.parsed, 'official')], asSeparatePack: true }));
    expect(a.existingPack).toBeUndefined();
    expect(a.conflicts).toHaveLength(1);
    expect(a.conflicts[0]!.existing.packId).toBe('natal-1');
    const sep = separatePackId('natal-1');
    expect(sep).toMatch(/^natal-1-i[0-9a-f]{8}$/);
  });
});

describe('Conflitos de ID: resolução', () => {
  const setup = async () => {
    const roda = obj('roda', 'Roda', '#111111');
    const carro = obj('carro', 'Carro', '#cc0000', { pieces: [createPiece('rect', { id: 'corpo' }), createPiece('object', { id: 'r1', refId: 'roda', x: -50 }), createPiece('object', { id: 'r2', refId: 'roda', x: 50 })] });
    const { parsed } = await pack('veiculos-1', '1.0.0', [objItem('carro', 'Carro', carro, [roda]), objItem('roda', 'Roda', roda)]);
    // "roda" já existe na biblioteca com conteúdo DIFERENTE
    const existing = [lib('object', 'Roda antiga', { bundle: 2, object: obj('roda', 'Roda antiga', '#999999'), objects: [], assets: [] })];
    const analysis = analyzeImport(parsed, input({ library: existing }));
    return { parsed, analysis, existing };
  };

  it('Opção A: novo UUID v4 automático, referências internas atualizadas e o pacote original intocado', async () => {
    const { parsed, analysis } = await setup();
    expect(analysis.conflicts.map((c) => c.itemId)).toEqual(['roda']);
    const before = canonicalJson(parsed.items);
    const plan = planImport(parsed, analysis, { roda: { action: 'new-id' } });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const novo = plan.idMap.roda!;
    expect(isUuidV4(novo)).toBe(true);
    const roda = plan.items.find((i) => i.name === 'Roda')!;
    expect(innerIdOf(roda)).toBe(novo);
    expect(roda.id).toBe(novo); // ID do item acompanha quando era igual ao da entidade
    const carro = plan.items.find((i) => i.name === 'Carro')!;
    expect(carro.kind === 'object' && carro.data.objects.map((o) => o.id)).toEqual([novo]); // aninhado renomeado
    const refs = carro.kind === 'object' ? carro.data.object.pieces.filter((p) => p.kind === 'object').map((p) => p.refId) : [];
    expect(refs).toEqual([novo, novo]); // peças apontam para o ID novo
    for (const it of plan.items) expect(itemIntegrityProblem(it)).toBeNull();
    expect(canonicalJson(parsed.items)).toBe(before); // cópia importada muda; o que foi lido do arquivo não
  });

  it('Opção B: ID manual válido, inválido, ocupado e repetido dentro do pacote', async () => {
    const { parsed, analysis } = await setup();
    const ok = planImport(parsed, analysis, { roda: { action: 'manual-id', id: 'Roda-nova-01' } });
    expect(ok.ok && ok.idMap.roda).toBe('Roda-nova-01');
    for (const bad of ['', 'com espaço', 'roda_x', 'a'.repeat(41)]) {
      const r = planImport(parsed, analysis, { roda: { action: 'manual-id', id: bad } });
      expect(r.ok, bad).toBe(false);
    }
    // 'roda' (o próprio ID em conflito) continua ocupado pelo item existente
    expect(planImport(parsed, analysis, { roda: { action: 'manual-id', id: 'roda' } }).ok).toBe(false);
    // 'carro' é de outro item deste mesmo pacote
    expect(planImport(parsed, analysis, { roda: { action: 'manual-id', id: 'carro' } }).ok).toBe(false);
    // maiúsculas diferentes são outro ID e passam
    expect(planImport(parsed, analysis, { roda: { action: 'manual-id', id: 'RODA' } }).ok).toBe(true);
  });

  it('Opção C: não importar o item (os demais continuam funcionando com a própria cópia)', async () => {
    const { parsed, analysis } = await setup();
    const plan = planImport(parsed, analysis, { roda: { action: 'skip' } });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.skipped).toEqual(['roda']);
    expect(plan.items.map((i) => i.id)).toEqual(['carro']);
    expect(itemIntegrityProblem(plan.items[0]!)).toBeNull();
    expect(dependentsOf(parsed.items, 'roda')).toEqual(['Carro']);
  });

  it('Opção D: resolver todos automaticamente, sem escolhas individuais', async () => {
    const a = obj('a', 'A', '#010101');
    const b = obj('b', 'B', '#020202');
    const { parsed } = await pack('lote-1', '1.0.0', [objItem('a', 'A', a), objItem('b', 'B', b)]);
    const existing = [lib('object', 'A velho', { bundle: 2, object: obj('a', 'A velho', '#aaaaaa'), objects: [], assets: [] }), lib('object', 'B velho', { bundle: 2, object: obj('b', 'B velho', '#bbbbbb'), objects: [], assets: [] })];
    const analysis = analyzeImport(parsed, input({ library: existing }));
    expect(analysis.conflicts).toHaveLength(2);
    expect(planImport(parsed, analysis, {}).ok).toBe(false); // sem escolha: recusa e nada é planejado
    const plan = planImport(parsed, analysis, {}, { resolveAll: true });
    expect(plan.ok && plan.autoIds).toBe(2);
    expect(plan.ok && new Set(Object.values(plan.idMap)).size).toBe(2);
  });

  it('duplicatas idênticas ficam de fora e o resto entra', async () => {
    const same = obj('same', 'Igual');
    const { parsed } = await pack('lote-2', '1.0.0', [objItem('same', 'Igual', same), objItem('nova', 'Nova', obj('nova', 'Nova'))]);
    const analysis = analyzeImport(parsed, input({ library: [lib('object', 'Igual', { bundle: 2, object: same, objects: [], assets: [] })] }));
    const plan = planImport(parsed, analysis, {});
    expect(plan.ok && plan.duplicates).toEqual(['same']);
    expect(plan.ok && plan.items.map((i) => i.id)).toEqual(['nova']);
  });

  it('personagem com ID novo: personagens estáticos embutidos em outros itens são atualizados', async () => {
    const hero = CharacterDefinitionSchema.parse({ id: 'heroi', name: 'Herói' });
    const cena = obj('cena', 'Cena com herói', '#ffffff', { pieces: [createPiece('character', { id: 'h', character: freezeCharacter(hero) })] });
    const { parsed } = await pack('hero-1', '1.0.0', [{ id: 'heroi', kind: 'character', name: 'Herói', data: hero }, objItem('cena', 'Cena com herói', cena)]);
    const analysis = analyzeImport(parsed, input({ library: [lib('character', 'Outro herói', CharacterDefinitionSchema.parse({ id: 'heroi', name: 'Outro herói', skin: '#000000' }))] }));
    const plan = planImport(parsed, analysis, { heroi: { action: 'new-id' } });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const novo = plan.idMap.heroi!;
    const c = plan.items.find((i) => i.kind === 'character')!;
    expect(innerIdOf(c)).toBe(novo);
    const o = plan.items.find((i) => i.kind === 'object')!;
    const emb = o.kind === 'object' ? o.data.object.pieces[0]!.character! : null;
    expect(emb?.sourceId).toBe(novo);
    expect(emb?.def.id).toBe(novo);
  });

  it('aninhado com o mesmo ID mas conteúdo DIFERENTE não é renomeado junto', async () => {
    const rodaA = obj('roda', 'Roda do carro', '#111111');
    const rodaB = obj('roda', 'Roda de outro tipo', '#ff00ff'); // mesmo ID, outra coisa
    const carro = obj('carro', 'Carro', '#cc0000', { pieces: [createPiece('object', { id: 'r', refId: 'roda' })] });
    const items = [{ id: 'carro', kind: 'object' as const, name: 'Carro', data: { bundle: 2 as const, object: carro, objects: [rodaB], assets: [] } }, { id: 'roda', kind: 'object' as const, name: 'Roda', data: { bundle: 2 as const, object: rodaA, objects: [], assets: [] } }];
    const out = applyIdMap(items as never, new Map([['roda', 'nova-roda']]));
    const c = out.find((i) => i.id === 'carro')!;
    expect(c.kind === 'object' && c.data.objects[0]!.id).toBe('roda'); // intocado
    expect(c.kind === 'object' && c.data.object.pieces[0]!.refId).toBe('roda');
    expect(innerIdOf(out.find((i) => i.name === 'Roda')!)).toBe('nova-roda');
  });

  it('canSkipItem recusa quando outro item mantido ficaria com referência solta', async () => {
    const a = obj('a', 'A', '#010101');
    const b = obj('b', 'B', '#020202', { pieces: [createPiece('object', { id: 'x', refId: 'a' })] });
    const { parsed } = await pack('dep-1', '1.0.0', [objItem('a', 'A', a), objItem('b', 'B', { ...b, pieces: [createPiece('rect', { id: 'ok' })] })]);
    expect(canSkipItem(parsed.items, 'a')).toEqual({ ok: true });
    // item que referencia "a" SEM trazer cópia dela: montado à mão (um pacote assim nem passa na leitura)
    const broken = [...parsed.items.filter((i) => i.id === 'a'), { id: 'b', kind: 'object' as const, name: 'B', data: { bundle: 2 as const, object: b, objects: [], assets: [] } }];
    const r = canSkipItem(broken, 'a');
    expect(r.ok).toBe(false);
    expect(canSkipItem(parsed.items, 'inexistente').ok).toBe(false);
  });

  it('poses e cenários também passam pela mesma detecção', async () => {
    const pose = { id: 'pose-a', kind: 'pose' as const, name: 'Pose A', data: { rig: {}, handL: 'open', handR: 'fist' } };
    const { parsed } = await pack('misto-1', '1.0.0', [pose, bgItem('sala', 'Sala')]);
    const a = analyzeImport(parsed, input({ library: [lib('background', 'Sala minha', { bundle: 2, background: CustomBackgroundSchema.parse({ id: 'sala', name: 'Sala minha', compositions: { day: { pieces: [] } } }), objects: [], assets: [] })] }));
    expect(a.conflicts.map((c) => c.itemId)).toEqual(['sala']);
    expect(a.clean).toEqual(['pose-a']);
    const plan = planImport(parsed, a, { sala: { action: 'new-id' } });
    expect(plan.ok).toBe(true);
    expect(deepClone(parsed.items).length).toBe(2);
  });
});
