import { describe, expect, it } from 'vitest';
import { newItemId } from '@/engine/model/ids';
import { createProject, newCharacterDefinition } from '@/engine/model/factory';
import { createCustomBackground } from '@/engine/world/customBackgrounds';
import { ITEM_ID_MAX, isLegacyItemId, isUuidV4, isValidItemId, uniqueItemId, validateItemId } from '@/features/library/itemIds';

describe('IDs únicos dos itens da Biblioteca', () => {
  it('gera UUID v4 válido, com 36 caracteres (cabe no limite de 40) e que também passa na regra de formato', () => {
    const id = newItemId();
    expect(isUuidV4(id)).toBe(true);
    expect(id).toHaveLength(36);
    expect(id.length).toBeLessThanOrEqual(ITEM_ID_MAX);
    expect(isValidItemId(id)).toBe(true);
  });

  it('não repete IDs em 20 mil gerações', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) seen.add(newItemId());
    expect(seen.size).toBe(20_000);
  });

  it('usa o caminho de getRandomValues (sem randomUUID) e ainda produz UUID v4 válido', () => {
    const c = globalThis.crypto;
    const original = c.randomUUID;
    Object.defineProperty(c, 'randomUUID', { value: undefined, configurable: true });
    try {
      for (let i = 0; i < 200; i++) expect(isUuidV4(newItemId())).toBe(true);
    } finally {
      Object.defineProperty(c, 'randomUUID', { value: original, configurable: true });
    }
  });

  it('aceita IDs personalizados válidos (1 a 40 caracteres de A-Z, a-z, 0-9 e hífen)', () => {
    for (const id of ['1', 's8D-88', 'Rafael', 'rafael', 'VilaTorta-01', 'PERSONAGEM-123', 'a'.repeat(40), '550e8400-e29b-41d4-a716-446655440000']) {
      expect(validateItemId(id)).toEqual({ ok: true, id });
    }
  });

  it('recusa IDs inválidos com o motivo certo', () => {
    expect(validateItemId('')).toMatchObject({ ok: false, problem: 'empty' });
    expect(validateItemId('a'.repeat(41))).toMatchObject({ ok: false, problem: 'too-long' });
    expect(validateItemId('a'.repeat(40)).ok).toBe(true); // limite exato
    for (const bad of ['com espaço', 'acentuação', 'João', 'sub_linha', 'ponto.final', 'barra/x', ' x', 'x ', 'ç', 'a@b', '​']) {
      const r = validateItemId(bad);
      expect(r, bad).toMatchObject({ ok: false, problem: 'invalid-chars' });
    }
  });

  it('diferencia maiúsculas de minúsculas: Rafael e rafael são IDs distintos e coexistem', () => {
    const used = new Set(['Rafael']);
    const taken = (id: string) => used.has(id);
    expect(validateItemId('Rafael', taken)).toMatchObject({ ok: false, problem: 'taken' });
    expect(validateItemId('rafael', taken)).toEqual({ ok: true, id: 'rafael' });
    expect(validateItemId('RAFAEL', taken).ok).toBe(true);
  });

  it('informa quem já usa o ID quando o verificador devolve o nome', () => {
    const r = validateItemId('x', () => 'Cadeira azul');
    expect(r).toMatchObject({ ok: false, problem: 'taken' });
    expect((r as { message: string }).message).toContain('Cadeira azul');
  });

  it('IDs legados continuam reconhecidos como legado, sem serem reescritos', () => {
    for (const id of ['obj_x7k2m', 'char_nanob6ccx9', 'lib_7g43l9g50o', 'pk_panela']) {
      expect(isLegacyItemId(id), id).toBe(true);
      expect(isValidItemId(id), id).toBe(false);
    }
    expect(isLegacyItemId('vt-rafa')).toBe(false); // já segue o formato novo
    expect(isLegacyItemId(newItemId())).toBe(false);
  });

  it('uniqueItemId escapa de um ID já usado', () => {
    let calls = 0;
    const id = uniqueItemId(() => calls++ < 3);
    expect(isUuidV4(id)).toBe(true);
    expect(calls).toBe(4);
  });

  it('itens novos nascem com UUID v4: personagem e cenário; vários personagens com o mesmo nome têm IDs diferentes', () => {
    const a = newCharacterDefinition('Rafael');
    const b = newCharacterDefinition('Rafael');
    const c = newCharacterDefinition('Rafael');
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    for (const x of [a, b, c]) { expect(isUuidV4(x.id)).toBe(true); expect(x.name).toBe('Rafael'); }
    const cb = createCustomBackground(createProject('p'), 'Sala');
    expect(isUuidV4(cb.id)).toBe(true);
  });
});
