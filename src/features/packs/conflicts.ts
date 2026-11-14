/**
 * Conflitos de ID ao importar um .rspack. Tudo puro (sem React nem IndexedDB).
 *
 * Regras (ver docs/BIBLIOTECA-IDS.md):
 *  - A identidade de um item é o ID da entidade dentro dele (personagem, objeto, cenário) ou o ID do item (pose).
 *  - Mesmo nome com IDs diferentes: importa normalmente (não é conflito).
 *  - Mesmo ID e mesmo conteúdo: duplicata reconhecida (não é importada de novo, nada é sobrescrito).
 *  - Mesmo ID e conteúdo diferente, ou ID de item padrão: conflito. O usuário escolhe: novo ID automático, ID manual
 *    ou não importar. Nunca sobrescreve em silêncio.
 *  - As trocas valem só para a CÓPIA importada; o arquivo .rspack original nunca é tocado.
 *  - A troca de ID atualiza as referências internas do pacote (objetos aninhados, personagens embutidos).
 */
import { deepClone } from '@/engine/model/ids';
import type { CustomObject, Piece } from '@/engine/model/schema';
import { CharacterDefinitionSchema } from '@/engine/model/schema';
import { readBackgroundBundle, readObjectBundle } from '@/features/library/bundles';
import { newItemId, uniqueItemId, validateItemId } from '@/features/library/itemIds';
import type { LibraryRecord, PackRecord } from '@/storage/db';
import { compareVersions, innerIdOf, itemIntegrityProblem, PoseDataSchema, type PackItemData, type PackItemKind, type PackManifest, type ParsedPack } from './format';

export type PackSource = 'official' | 'imported';
export type HolderOrigin = 'builtin' | 'mine' | 'pack';

/** Quem já usa um ID no catálogo. */
export interface IdHolder {
  id: string;
  kind: string;
  name: string;
  origin: HolderOrigin;
  packId?: string;
  packName?: string;
  packVersion?: string;
  official?: boolean;
  /** Conteúdo canônico (sem datas nem favorito). Itens padrão não têm: nunca são "idênticos" a um pacote. */
  canon?: string;
}

export const ORIGIN_TEXT: Record<HolderOrigin, string> = { builtin: 'Item padrão do app', mine: 'Minha biblioteca', pack: 'Pacote instalado' };
export const describeHolder = (h: IdHolder): string => `${ORIGIN_TEXT[h.origin]}${h.packName ? ` · ${h.packName}${h.packVersion ? ` ${h.packVersion}` : ''}` : ''}`;

/* ------------------------------ conteúdo canônico ------------------------------ */
/** JSON com chaves em ordem e sem `undefined`: duas leituras do mesmo conteúdo dão o mesmo texto. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => canonicalJson(x === undefined ? null : x)).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

const noTimes = <T extends object>(o: T): Omit<T, 'createdAt' | 'updatedAt'> => {
  const { createdAt: _c, updatedAt: _u, ...rest } = o as T & { createdAt?: number; updatedAt?: number };
  return rest;
};

/** Texto canônico do conteúdo de um item (ignora datas, favorito e metadados do arquivo). */
export function canonOf(kind: PackItemKind, data: unknown): string {
  const d = data as Record<string, unknown>;
  switch (kind) {
    case 'object': {
      const b = d as { object: CustomObject; objects: CustomObject[]; assets: Array<{ id: string }> };
      return canonicalJson({ object: noTimes(b.object), objects: [...b.objects].sort((x, y) => x.id.localeCompare(y.id)).map(noTimes), assets: b.assets.map((a) => a.id).sort() });
    }
    case 'background': {
      const b = d as { background: Record<string, unknown>; objects: CustomObject[]; assets: Array<{ id: string }> };
      return canonicalJson({ background: noTimes(b.background), objects: [...b.objects].sort((x, y) => x.id.localeCompare(y.id)).map(noTimes), assets: b.assets.map((a) => a.id).sort() });
    }
    case 'character': {
      const { favorite: _f, ...rest } = d;
      return canonicalJson(rest);
    }
    case 'pose': return canonicalJson({ rig: d.rig, handL: d.handL, handR: d.handR });
  }
}
export const itemCanon = (it: PackItemData): string => canonOf(it.kind, it.data);

/* ------------------------------ quem usa cada ID ------------------------------ */
export interface BuiltinId { id: string; kind: string; name: string }

/** Registro da biblioteca lido como item de catálogo (ID de identidade, tipo e dados válidos), ou null se ilegível/sem identidade própria. */
export function readLibraryRecord(r: LibraryRecord): { id: string; kind: PackItemKind; data: unknown } | null {
  switch (r.kind) {
    case 'character': { const p = CharacterDefinitionSchema.safeParse(r.data); return p.success ? { id: p.data.id, kind: 'character', data: p.data } : null; }
    case 'object': { const p = readObjectBundle(r.data); return p.ok ? { id: p.bundle.object.id, kind: 'object', data: p.bundle } : null; }
    case 'background': { const p = readBackgroundBundle(r.data); return p.ok ? { id: p.bundle.background.id, kind: 'background', data: p.bundle } : null; }
    case 'pose': { const p = PoseDataSchema.safeParse(r.data); return p.success ? { id: r.id, kind: 'pose', data: p.data } : null; }
    default: return null;
  }
}

export interface HolderInput {
  packs: PackRecord[];
  library: LibraryRecord[];
  /** Como ler um registro da biblioteca como item (padrão: `readLibraryRecord`). */
  readRecord?: (r: LibraryRecord) => { id: string; kind: PackItemKind; data: unknown } | null;
  builtin: BuiltinId[];
  /** Itens deste pacote serão substituídos (atualização): não contam como "já existem". */
  ignorePackId?: string;
}

/** ID → quem o usa. Pode haver mais de um dono (bibliotecas antigas já tinham repetições). */
export function collectHolders({ packs, library, readRecord = readLibraryRecord, builtin, ignorePackId }: HolderInput): Map<string, IdHolder[]> {
  const out = new Map<string, IdHolder[]>();
  const add = (h: IdHolder) => { out.set(h.id, [...(out.get(h.id) ?? []), h]); };
  for (const b of builtin) add({ id: b.id, kind: b.kind, name: b.name, origin: 'builtin' });
  for (const r of library) {
    const read = readRecord(r);
    if (read) add({ id: read.id, kind: read.kind, name: r.name, origin: 'mine', canon: canonOf(read.kind, read.data) });
    else add({ id: r.id, kind: r.kind, name: r.name, origin: 'mine' });
  }
  for (const pk of packs) {
    if (pk.id === ignorePackId) continue;
    for (const it of pk.items) add({ id: innerIdOf(it), kind: it.kind, name: it.name, origin: 'pack', packId: pk.id, packName: pk.name, packVersion: pk.version, official: pk.source === 'official', canon: itemCanon(it) });
  }
  return out;
}

/* ------------------------------ análise ------------------------------ */
export interface ItemConflict {
  /** ID do item no manifesto (chave estável da importação). */
  itemId: string;
  /** ID da entidade que colide. */
  innerId: string;
  name: string;
  kind: PackItemKind;
  reason: 'different-content' | 'builtin' | 'different-kind';
  existing: IdHolder;
  holders: IdHolder[];
}
export interface ItemDuplicate { itemId: string; innerId: string; name: string; existing: IdHolder }
export interface PackConflict {
  kind: 'origin-mismatch' | 'same-version-different-content';
  existing: { name: string; version: string; source: PackSource };
  incoming: { name: string; version: string; source: PackSource };
}
export type PackStatus = 'new' | 'update' | 'identical' | 'older';

export interface ImportAnalysis {
  packId: string;
  status: PackStatus;
  existingPack?: PackRecord;
  packConflict?: PackConflict;
  conflicts: ItemConflict[];
  /** Mesmo ID e mesmo conteúdo já na biblioteca: reconhecidos como duplicata e não importados de novo. */
  duplicates: ItemDuplicate[];
  /** Itens sem nenhum problema. */
  clean: string[];
  /** Informativo: mesmo nome de um item existente, ID diferente (importa normalmente). */
  sameNameOtherId: Array<{ itemId: string; name: string; existing: IdHolder }>;
  /** Todo ID já em uso no catálogo (para validar IDs manuais e gerar IDs livres). */
  holders: Map<string, IdHolder[]>;
}

export interface AnalyzeInput extends Omit<HolderInput, 'ignorePackId'> {
  incomingSource: PackSource;
  incomingSha256?: string;
  /** O usuário escolheu instalar como pacote separado (outro ID de pacote): os itens do pacote já instalado contam como existentes. */
  asSeparatePack?: boolean;
}

export function analyzeImport(pack: ParsedPack, input: AnalyzeInput): ImportAnalysis {
  const { manifest } = pack;
  const existing = input.asSeparatePack ? undefined : input.packs.find((p) => p.id === manifest.id);
  let status: PackStatus = 'new';
  let packConflict: PackConflict | undefined;
  if (existing) {
    const cmp = compareVersions(manifest.version, existing.version);
    const existingSource: PackSource = existing.source ?? 'imported';
    const same = { name: existing.name, version: existing.version, source: existingSource };
    const incoming = { name: manifest.name, version: manifest.version, source: input.incomingSource };
    if (cmp < 0) status = 'older';
    else if (existingSource !== input.incomingSource) { status = cmp === 0 ? 'identical' : 'update'; packConflict = { kind: 'origin-mismatch', existing: same, incoming }; }
    else if (cmp > 0) status = 'update';
    else {
      // Mesmo arquivo (sha256) OU mesmo conteúdo reempacotado (outro ZIP, itens iguais).
      const sameFile = !!existing.fileSha256 && !!input.incomingSha256 && existing.fileSha256 === input.incomingSha256;
      const sameItems = existing.items.length === pack.items.length && pack.items.every((it) => existing.items.some((x) => x.id === it.id && x.kind === it.kind && itemCanon(x) === itemCanon(it)));
      const identical = sameFile || sameItems;
      if (identical) status = 'identical';
      else { status = 'identical'; packConflict = { kind: 'same-version-different-content', existing: same, incoming }; }
    }
  }
  const holders = collectHolders({ ...input, ignorePackId: existing?.id });
  const conflicts: ItemConflict[] = [];
  const duplicates: ItemDuplicate[] = [];
  const clean: string[] = [];
  const sameNameOtherId: ImportAnalysis['sameNameOtherId'] = [];
  const names = new Map<string, IdHolder>();
  for (const list of holders.values()) for (const h of list) if (!names.has(h.name.toLocaleLowerCase('pt-BR'))) names.set(h.name.toLocaleLowerCase('pt-BR'), h);
  for (const it of pack.items) {
    const innerId = innerIdOf(it);
    const list = holders.get(innerId) ?? [];
    if (list.length === 0) {
      clean.push(it.id);
      const same = names.get(it.name.toLocaleLowerCase('pt-BR'));
      if (same) sameNameOtherId.push({ itemId: it.id, name: it.name, existing: same });
      continue;
    }
    const canon = itemCanon(it);
    const identical = list.find((h) => h.kind === it.kind && h.canon !== undefined && h.canon === canon);
    if (identical) { duplicates.push({ itemId: it.id, innerId, name: it.name, existing: identical }); continue; }
    const first = list[0]!;
    const reason: ItemConflict['reason'] = list.some((h) => h.origin === 'builtin') ? 'builtin' : list.some((h) => h.kind !== it.kind) ? 'different-kind' : 'different-content';
    conflicts.push({ itemId: it.id, innerId, name: it.name, kind: it.kind, reason, existing: list.find((h) => h.origin === 'builtin') ?? first, holders: list });
  }
  return { packId: manifest.id, status, existingPack: existing, packConflict, conflicts, duplicates, clean, sameNameOtherId, holders };
}

/* ------------------------------ troca de IDs e referências internas ------------------------------ */
const mapPieces = (pieces: Piece[], objMap: ReadonlyMap<string, string>, charMap: ReadonlyMap<string, string>): Piece[] => pieces.map((p) => {
  let q = p;
  if (p.kind === 'object' && p.refId && objMap.has(p.refId)) q = { ...q, refId: objMap.get(p.refId)! };
  const c = q.character;
  if (c && ((c.sourceId && charMap.has(c.sourceId)) || charMap.has(c.def.id))) {
    q = { ...q, character: { ...c, sourceId: c.sourceId && charMap.has(c.sourceId) ? charMap.get(c.sourceId)! : c.sourceId, def: charMap.has(c.def.id) ? { ...c.def, id: charMap.get(c.def.id)! } : c.def } };
  }
  return q;
});

const remapObject = (o: CustomObject, objMap: ReadonlyMap<string, string>, charMap: ReadonlyMap<string, string>, selfNew?: string): CustomObject => ({
  ...o,
  id: selfNew ?? o.id,
  pieces: mapPieces(o.pieces, objMap, charMap),
  clips: o.clips.map((c) => ({ ...c, frames: c.frames.map((f) => ({ ...f, pieces: mapPieces(f.pieces, objMap, charMap) })) })),
});

/**
 * Aplica as trocas de ID (ID da ENTIDADE → ID novo) nos itens da importação e atualiza as referências internas:
 *  - o próprio item (e o ID do item, quando era igual ao da entidade);
 *  - objetos aninhados de OUTROS itens que são exatamente o objeto renomeado (mesmo ID e mesmo conteúdo), com as
 *    peças que apontam para eles. Um aninhado com o mesmo ID mas conteúdo diferente é outra coisa e não é tocado;
 *  - personagens embutidos (peça "personagem estático") cuja origem é o personagem renomeado.
 * Devolve cópias: os itens lidos do arquivo não são alterados.
 */
export function applyIdMap(items: PackItemData[], idMap: ReadonlyMap<string, string>): PackItemData[] {
  const charMap = new Map<string, string>();
  const objCanon = new Map<string, string>(); // ID antigo → conteúdo do objeto que ganhou ID novo
  for (const it of items) {
    const own = innerIdOf(it);
    const to = idMap.get(own);
    if (!to) continue;
    if (it.kind === 'character') charMap.set(own, to);
    if (it.kind === 'object') objCanon.set(own, canonicalJson(noTimes({ ...it.data.object, id: '' })));
  }
  const sameAsRenamed = (o: CustomObject) => objCanon.get(o.id) === canonicalJson(noTimes({ ...o, id: '' }));
  return items.map((src) => {
    const it = deepClone(src);
    const own = innerIdOf(it);
    const newOwn = idMap.get(own);
    if (it.kind === 'object' || it.kind === 'background') {
      const objMap = new Map<string, string>();
      for (const o of it.data.objects) if (idMap.has(o.id) && sameAsRenamed(o)) objMap.set(o.id, idMap.get(o.id)!);
      if (it.kind === 'object') {
        it.data.object = remapObject(it.data.object, objMap, charMap, newOwn);
      } else {
        for (const comp of Object.values(it.data.background.compositions)) if (comp) comp.pieces = mapPieces(comp.pieces, objMap, charMap);
        if (newOwn) it.data.background.id = newOwn;
      }
      it.data.objects = it.data.objects.map((o) => remapObject(o, objMap, charMap, objMap.get(o.id)));
    } else if (it.kind === 'character' && newOwn) {
      it.data.id = newOwn;
    }
    if (newOwn && (it.id === own || it.kind === 'pose')) it.id = newOwn;
    return it;
  });
}

/** Itens importados que usam o ID `innerId` como objeto aninhado ou personagem embutido (informativo). */
export function dependentsOf(items: PackItemData[], innerId: string): string[] {
  const hit = (pieces: Piece[]) => pieces.some((p) => (p.kind === 'object' && p.refId === innerId) || p.character?.sourceId === innerId || p.character?.def.id === innerId);
  return items.filter((it) => {
    if (innerIdOf(it) === innerId) return false;
    if (it.kind === 'object') return [it.data.object, ...it.data.objects].some((o) => hit(o.pieces) || o.clips.some((c) => c.frames.some((f) => hit(f.pieces))));
    if (it.kind === 'background') return Object.values(it.data.background.compositions).some((c) => c && hit(c.pieces)) || it.data.objects.some((o) => hit(o.pieces));
    return false;
  }).map((it) => it.name);
}

/**
 * Pode deixar de importar este item sem quebrar nada? Cada item do pacote traz as próprias dependências
 * (objetos aninhados e imagens), então só é recusado se outro item mantido ficaria com referência solta.
 */
export function canSkipItem(items: PackItemData[], itemId: string): { ok: true } | { ok: false; reason: string } {
  const target = items.find((i) => i.id === itemId);
  if (!target) return { ok: false, reason: 'Item desconhecido.' };
  const rest = items.filter((i) => i.id !== itemId);
  const inner = innerIdOf(target);
  for (const it of rest) {
    const problem = itemIntegrityProblem(it);
    if (problem) return { ok: false, reason: problem };
    // Referência a este item que não veio embutida no próprio item dependente.
    if (it.kind === 'object' || it.kind === 'background') {
      const own = new Set((it.kind === 'object' ? [it.data.object, ...it.data.objects] : it.data.objects).map((o) => o.id));
      const pieces = it.kind === 'object' ? [it.data.object, ...it.data.objects].flatMap((o) => [o.pieces, ...o.clips.flatMap((c) => c.frames.map((f) => f.pieces))].flat()) : [...Object.values(it.data.background.compositions).flatMap((c) => c?.pieces ?? []), ...it.data.objects.flatMap((o) => o.pieces)];
      if (pieces.some((p) => p.kind === 'object' && p.refId === inner && !own.has(inner))) return { ok: false, reason: `"${it.name}" depende deste item e não traz uma cópia dele.` };
    }
  }
  return { ok: true };
}

/* ------------------------------ resolução ------------------------------ */
export type Resolution = { action: 'new-id' } | { action: 'manual-id'; id: string } | { action: 'skip' };
export type Resolutions = Record<string, Resolution>;

export type PlanResult =
  | { ok: true; items: PackItemData[]; idMap: Record<string, string>; skipped: string[]; duplicates: string[]; autoIds: number }
  | { ok: false; errors: string[] };

/**
 * Transforma as escolhas do usuário no que será gravado: itens (com IDs novos e referências atualizadas),
 * itens pulados e duplicatas reconhecidas. Se alguma escolha for inválida, nada é gravado e voltam os motivos.
 * `resolveAll` aplica "novo ID automático" a todos os conflitos sem escolha (opção D).
 */
export function planImport(pack: ParsedPack, analysis: ImportAnalysis, resolutions: Resolutions, opts: { resolveAll?: boolean } = {}): PlanResult {
  const errors: string[] = [];
  const known = analysis.holders;
  const dupIds = new Set(analysis.duplicates.map((d) => d.itemId));
  // IDs que ficarão no pacote: todos os itens mantidos (inclui os sem conflito) mais as escolhas já feitas.
  const finalIds = new Set<string>();
  const skipped: string[] = [];
  const idMap = new Map<string, string>();
  let autoIds = 0;
  const everyKnown = (id: string) => known.has(id) || finalIds.has(id);

  // 1) Pulados e duplicatas saem; o resto reserva o próprio ID.
  const decided = new Map<string, Resolution>();
  for (const c of analysis.conflicts) {
    const r = resolutions[c.itemId] ?? (opts.resolveAll ? ({ action: 'new-id' } as Resolution) : undefined);
    if (!r) { errors.push(`Falta escolher o que fazer com "${c.name}" (ID ${c.innerId}).`); continue; }
    decided.set(c.itemId, r);
  }
  if (errors.length) return { ok: false, errors };
  for (const it of pack.items) {
    if (dupIds.has(it.id)) continue;
    const r = decided.get(it.id);
    if (r?.action === 'skip') {
      const can = canSkipItem(pack.items.filter((x) => !dupIds.has(x.id)), it.id);
      if (!can.ok) { errors.push(`Não dá para pular "${it.name}": ${can.reason}`); continue; }
      skipped.push(it.id);
      continue;
    }
    if (!r) finalIds.add(innerIdOf(it));
  }
  if (errors.length) return { ok: false, errors };

  // 2) IDs manuais primeiro (o usuário escolheu esses), depois os automáticos.
  for (const c of analysis.conflicts) {
    const r = decided.get(c.itemId)!;
    if (r.action !== 'manual-id') continue;
    const v = validateItemId(r.id, (id) => (everyKnown(id) ? true : undefined));
    if (!v.ok) { errors.push(`"${c.name}": ${v.message}`); continue; }
    idMap.set(c.innerId, v.id);
    finalIds.add(v.id);
  }
  for (const c of analysis.conflicts) {
    const r = decided.get(c.itemId)!;
    if (r.action !== 'new-id') continue;
    const id = uniqueItemId((x) => everyKnown(x));
    idMap.set(c.innerId, id);
    finalIds.add(id);
    autoIds++;
  }
  if (errors.length) return { ok: false, errors };

  const keep = pack.items.filter((i) => !dupIds.has(i.id) && !skipped.includes(i.id));
  const items = applyIdMap(keep, idMap);
  for (const it of items) {
    const problem = itemIntegrityProblem(it);
    if (problem) errors.push(problem);
  }
  if (errors.length) return { ok: false, errors };
  // Garantia final: nenhum ID repetido dentro do que será gravado.
  const seen = new Set<string>();
  for (const it of items) {
    const id = innerIdOf(it);
    if (seen.has(id)) errors.push(`ID repetido dentro do pacote: ${id}.`);
    seen.add(id);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, items, idMap: Object.fromEntries(idMap), skipped, duplicates: [...dupIds], autoIds };
}

/** ID novo para instalar um pacote como "separado" quando o ID dele já pertence a outro pacote de origem diferente. */
export function separatePackId(base: string): string {
  return `${base.slice(0, 48)}-i${newItemId().replace(/-/g, '').slice(0, 8)}`;
}
export const withPackId = (m: PackManifest, id: string): PackManifest => ({ ...m, id });
