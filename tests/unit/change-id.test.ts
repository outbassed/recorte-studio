import { describe, expect, it } from 'vitest';
import { CharacterDefinitionSchema, CustomObjectSchema, type CustomObject } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';
import { checkNewId, identityOf, planIdChange, referenceCount } from '@/features/library/changeId';
import { builtinIds } from '@/features/packs/builtinIds';
import type { LibraryRecord } from '@/storage/db';

const obj = (id: string, name: string, extra: Partial<CustomObject> = {}) => CustomObjectSchema.parse({ id, name, pieces: [createPiece('rect', { id: 'a' })], ...extra });
const rec = (kind: LibraryRecord['kind'], libId: string, name: string, data: unknown): LibraryRecord => ({ id: libId, kind, name, favorite: 0, createdAt: 1, data });
const objRec = (libId: string, o: CustomObject, nested: CustomObject[] = []) => rec('object', libId, o.name, { bundle: 2, object: o, objects: nested, assets: [] });

describe('Alterar o ID de um item da biblioteca', () => {
  const roda = obj('obj_roda', 'Roda');
  const carro = obj('obj_carro', 'Carro', { pieces: [createPiece('object', { id: 'r1', refId: 'obj_roda' })] });
  const records = [objRec('lib_1', roda), objRec('lib_2', carro, [roda]), rec('character', 'lib_3', 'Rafael', CharacterDefinitionSchema.parse({ id: 'Rafael', name: 'Rafael' }))];
  const base = { records, packs: [], builtin: builtinIds() };

  it('identidade do item é o ID da entidade, não o do registro', () => {
    expect(identityOf(records[0]!)).toBe('obj_roda');
    expect(identityOf(records[2]!)).toBe('Rafael');
  });

  it('muda o ID, preserva o registro e atualiza as referências em outros itens da biblioteca', () => {
    const plan = planIdChange({ ...base, libId: 'lib_1', newId: 'Roda-Nova-01' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.oldId).toBe('obj_roda');
    const self = plan.put.find((r) => r.id === 'lib_1')!;
    expect((self.data as { object: { id: string } }).object.id).toBe('Roda-Nova-01');
    const carroNovo = plan.put.find((r) => r.id === 'lib_2')!;
    const d = carroNovo.data as { object: CustomObject; objects: CustomObject[] };
    expect(d.objects.map((o) => o.id)).toEqual(['Roda-Nova-01']);
    expect(d.object.pieces[0]!.refId).toBe('Roda-Nova-01');
    expect(plan.referencesUpdated).toBe(1);
    expect(plan.remove).toEqual([]);
    // o original não foi modificado
    expect(roda.id).toBe('obj_roda');
    expect((records[1]!.data as { objects: CustomObject[] }).objects[0]!.id).toBe('obj_roda');
  });

  it('recusa ID inválido, igual ao atual, em uso (inclusive por item padrão) e aceita maiúsculas diferentes', () => {
    expect(planIdChange({ ...base, libId: 'lib_1', newId: 'com espaço' }).ok).toBe(false);
    expect(planIdChange({ ...base, libId: 'lib_1', newId: 'a'.repeat(41) }).ok).toBe(false);
    expect(planIdChange({ ...base, libId: 'lib_1', newId: 'obj_roda' }).ok).toBe(false); // igual ao atual
    expect(planIdChange({ ...base, libId: 'lib_1', newId: 'Rafael' }).ok).toBe(false); // de outro item da biblioteca
    expect(planIdChange({ ...base, libId: 'lib_1', newId: 'nina' }).ok).toBe(false); // item padrão
    expect(checkNewId({ ...base, libId: 'lib_3', newId: 'rafael' }).ok).toBe(true); // Rafael ≠ rafael
    expect(checkNewId({ ...base, libId: 'lib_3', newId: 'Rafael' }).ok).toBe(true); // o próprio item não conta como "em uso"
  });

  it('pose: a identidade é o ID do registro, então o registro é regravado com a chave nova', () => {
    const pose = rec('pose', 'pose-a', 'Pose A', { rig: {}, handL: 'open', handR: 'open' });
    const plan = planIdChange({ records: [pose], packs: [], builtin: [], libId: 'pose-a', newId: 'pose-b' });
    expect(plan.ok && plan.put[0]!.id).toBe('pose-b');
    expect(plan.ok && plan.remove).toEqual(['pose-a']);
  });

  it('contagem de referências para avisar antes de confirmar', () => {
    expect(referenceCount({ ...base, libId: 'lib_1' })).toBe(1);
    expect(referenceCount({ ...base, libId: 'lib_3' })).toBe(0);
  });
});
