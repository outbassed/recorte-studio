/**
 * Alterar o ID de um item da minha biblioteca (puro, sem IndexedDB).
 *
 * O ID novo é validado (1–40, A-Z a-z 0-9 -, maiúsculas distintas) e precisa estar livre no catálogo inteiro
 * (itens padrão, minha biblioteca e pacotes). As referências em OUTROS itens da biblioteca (objetos aninhados,
 * personagens embutidos) são atualizadas. Projetos .jrec guardam a própria cópia e não são tocados: continuam
 * abrindo exatamente como estavam.
 */
import { applyIdMap, canonicalJson, collectHolders, readLibraryRecord, type BuiltinId } from '@/features/packs/conflicts';
import type { PackItemData } from '@/features/packs/format';
import { newItemId, validateItemId, type IdValidation } from './itemIds';
import type { LibraryRecord, PackRecord } from '@/storage/db';

export interface IdChangeInput { records: LibraryRecord[]; packs: PackRecord[]; builtin: BuiltinId[]; libId: string; newId: string }
export type IdChangePlan =
  | { ok: true; oldId: string; newId: string; /** Registros a gravar (o próprio item e os que referenciavam o ID antigo). */ put: LibraryRecord[]; /** Registros a apagar (só quando o ID é o do próprio registro). */ remove: string[]; referencesUpdated: number }
  | { ok: false; message: string };

const asItem = (r: LibraryRecord): PackItemData | null => {
  const read = readLibraryRecord(r);
  return read ? ({ id: read.id, kind: read.kind, name: r.name, data: read.data } as PackItemData) : null;
};

/** ID de identidade de um registro: o da entidade (personagem, objeto, cenário) ou o do próprio registro. */
export function identityOf(r: LibraryRecord): string {
  return readLibraryRecord(r)?.id ?? r.id;
}

/** Valida o ID novo contra o catálogo inteiro (o próprio item não conta como "em uso por outro"). */
export function checkNewId(input: IdChangeInput): IdValidation {
  const self = input.records.find((r) => r.id === input.libId);
  if (!self) return { ok: false, problem: 'empty', message: 'Item não encontrado.' };
  const holders = collectHolders({ packs: input.packs, library: input.records.filter((r) => r.id !== input.libId), builtin: input.builtin });
  const also = new Set(input.records.filter((r) => r.id !== input.libId).map((r) => r.id)); // IDs de registro (poses, cenas) também ocupam o espaço
  return validateItemId(input.newId, (id) => holders.get(id)?.[0]?.name ?? (also.has(id) ? 'outro item da biblioteca' : undefined));
}

export function planIdChange(input: IdChangeInput): IdChangePlan {
  const self = input.records.find((r) => r.id === input.libId);
  if (!self) return { ok: false, message: 'Item não encontrado na biblioteca.' };
  const oldId = identityOf(self);
  if (input.newId === oldId) return { ok: false, message: 'O ID novo é igual ao atual.' };
  const v = checkNewId(input);
  if (!v.ok) return { ok: false, message: v.message };
  const idMap = new Map([[oldId, input.newId]]);
  const put: LibraryRecord[] = [];
  const remove: string[] = [];
  const now = Date.now();
  const mine = asItem(self);
  if (mine) {
    // O item e quem o referencia passam pelo mesmo mecanismo da importação (referências internas consistentes).
    const others = input.records.filter((r) => r.id !== self.id).map((r) => ({ r, item: asItem(r) })).filter((x): x is { r: LibraryRecord; item: PackItemData } => !!x.item);
    const out = applyIdMap([mine, ...others.map((o) => o.item)], idMap);
    const [renamed, ...rest] = out;
    put.push({ ...self, updatedAt: now, data: renamed!.data });
    let referencesUpdated = 0;
    rest.forEach((it, i) => {
      const o = others[i]!;
      if (canonicalJson(it.data) === canonicalJson(o.item.data)) return;
      referencesUpdated++;
      put.push({ ...o.r, updatedAt: now, data: it.data });
    });
    if (self.kind === 'pose') { remove.push(self.id); put[0] = { ...put[0]!, id: input.newId }; }
    return { ok: true, oldId, newId: input.newId, put, remove, referencesUpdated };
  }
  // Cena e sequência: a identidade é o ID do registro.
  if (self.kind === 'scene' || self.kind === 'animation') {
    return { ok: true, oldId, newId: input.newId, put: [{ ...self, id: input.newId, updatedAt: now }], remove: [self.id], referencesUpdated: 0 };
  }
  return { ok: false, message: 'Este item está ilegível e não pode mudar de ID.' };
}

/** Quantos outros itens da biblioteca referenciam o ID atual (para avisar antes de confirmar). */
export function referenceCount(input: Omit<IdChangeInput, 'newId'>): number {
  const plan = planIdChange({ ...input, newId: newItemId() });
  return plan.ok ? plan.referencesUpdated : 0;
}
