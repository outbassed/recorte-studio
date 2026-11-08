/**
 * Pacotes da biblioteca do usuário (objetos e cenários) com TODAS as dependências:
 * imagens, objetos aninhados e personagens estáticos.
 *
 * Formato atual: `{ bundle: 2, ... }`. A leitura também aceita os formatos antigos:
 *  - 1.1: `{ background, assets: { [id]: Asset } }` (só imagens de horários)
 *  - 1.2 inicial: `{ background | object, assets: Asset[] }` (sem objetos aninhados)
 * Registro ilegível vira um erro claro, nunca uma exceção.
 */
import { AssetSchema, CustomBackgroundSchema, CustomObjectSchema, type Asset, type CustomBackground, type CustomObject, type Piece, type Project } from '@/engine/model/schema';
import { deepClone, uid } from '@/engine/model/ids';
import { objectPieceLists } from '@/engine/world/pieces';

export const BUNDLE_VERSION = 2;

export interface ObjectBundle { bundle: 2; object: CustomObject; objects: CustomObject[]; assets: Asset[] }
export interface BackgroundBundle { bundle: 2; background: CustomBackground; objects: CustomObject[]; assets: Asset[] }
export type Read<T> = { ok: true; bundle: T } | { ok: false; reason: string };

/* ------------------------------ dependências ------------------------------ */
function assetIdsOfPieces(pieces: Piece[]): string[] {
  const out: string[] = [];
  for (const pc of pieces) {
    if (pc.assetId) out.push(pc.assetId);
    if (pc.character?.def.spriteAssetId) out.push(pc.character.def.spriteAssetId);
  }
  return out;
}

/** Fecho transitivo dos objetos usados por uma lista de peças (seguro contra ciclos). */
export function objectClosure(project: Pick<Project, 'customObjects'>, pieces: Piece[]): CustomObject[] {
  const seen = new Map<string, CustomObject>();
  const visit = (list: Piece[]) => {
    for (const pc of list) {
      if (pc.kind !== 'object' || !pc.refId || seen.has(pc.refId)) continue;
      const o = project.customObjects[pc.refId];
      if (!o) continue;
      seen.set(o.id, o);
      for (const list of objectPieceLists(o)) visit(list);
    }
  };
  visit(pieces);
  return [...seen.values()];
}

/** O objeto `candidate` contém (direta ou indiretamente) o objeto `target`? Usado para impedir ciclos. */
export function objectContains(project: Pick<Project, 'customObjects'>, candidateId: string, targetId: string): boolean {
  if (candidateId === targetId) return true;
  const o = project.customObjects[candidateId];
  return !!o && objectClosure(project, objectPieceLists(o).flat()).some((d) => d.id === targetId);
}

const assetsFor = (project: Pick<Project, 'assets'>, ids: Iterable<string>): Asset[] => {
  const out = new Map<string, Asset>();
  for (const id of ids) {
    const a = project.assets[id];
    if (a) out.set(id, deepClone(a));
  }
  return [...out.values()];
};

export function buildObjectBundle(project: Project, objectId: string): ObjectBundle | null {
  const object = project.customObjects[objectId];
  if (!object) return null;
  const objects = objectClosure(project, objectPieceLists(object).flat()).filter((o) => o.id !== object.id);
  const ids = [...assetIdsOfPieces(objectPieceLists(object).flat()), ...objects.flatMap((o) => assetIdsOfPieces(objectPieceLists(o).flat()))];
  return { bundle: 2, object: deepClone(object), objects: deepClone(objects), assets: assetsFor(project, ids) };
}

export function buildBackgroundBundle(project: Project, cbId: string): BackgroundBundle | null {
  const background = project.customBackgrounds[cbId];
  if (!background) return null;
  const pieces = Object.values(background.compositions ?? {}).flatMap((c) => c?.pieces ?? []);
  const objects = objectClosure(project, pieces);
  const ids = [
    ...Object.values(background.variants).flatMap((v) => (v ? [v.assetId] : [])),
    ...assetIdsOfPieces(pieces),
    ...objects.flatMap((o) => assetIdsOfPieces(objectPieceLists(o).flat())),
  ];
  return { bundle: 2, background: deepClone(background), objects: deepClone(objects), assets: assetsFor(project, ids) };
}

/* ------------------------------ leitura tolerante ------------------------------ */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readAssets(raw: unknown): { assets: Asset[]; bad: number } {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? Object.values(raw) : [];
  const assets: Asset[] = [];
  let bad = 0;
  for (const r of list) {
    const p = AssetSchema.safeParse(r);
    if (p.success) assets.push(p.data);
    else bad++;
  }
  return { assets, bad };
}

function readObjects(raw: unknown): CustomObject[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: CustomObject[] = [];
  for (const r of raw) {
    const p = CustomObjectSchema.safeParse(r);
    if (!p.success) return null;
    out.push(p.data);
  }
  return out;
}

export function readBackgroundBundle(data: unknown): Read<BackgroundBundle> {
  if (!isObj(data) || !isObj(data.background)) return { ok: false, reason: 'Formato não reconhecido (sem cenário).' };
  const bg = CustomBackgroundSchema.safeParse(data.background);
  if (!bg.success) return { ok: false, reason: 'O cenário salvo está incompleto ou foi criado por uma versão incompatível.' };
  const objects = readObjects(data.objects);
  if (!objects) return { ok: false, reason: 'Os objetos usados pelo cenário estão ilegíveis.' };
  const { assets, bad } = readAssets(data.assets);
  if (bad) return { ok: false, reason: `${bad} imagem(ns) do cenário estão ilegíveis.` };
  return { ok: true, bundle: { bundle: 2, background: bg.data, objects, assets } };
}

export function readObjectBundle(data: unknown): Read<ObjectBundle> {
  if (!isObj(data) || !isObj(data.object)) return { ok: false, reason: 'Formato não reconhecido (sem objeto).' };
  const ob = CustomObjectSchema.safeParse(data.object);
  if (!ob.success) return { ok: false, reason: 'O objeto salvo está incompleto ou foi criado por uma versão incompatível.' };
  const objects = readObjects(data.objects);
  if (!objects) return { ok: false, reason: 'Os objetos usados por este objeto estão ilegíveis.' };
  const { assets, bad } = readAssets(data.assets);
  if (bad) return { ok: false, reason: `${bad} imagem(ns) do objeto estão ilegíveis.` };
  return { ok: true, bundle: { bundle: 2, object: ob.data, objects, assets } };
}

/* ------------------------------ aplicação ------------------------------ */
const strip = <T extends { updatedAt?: number; createdAt?: number }>(o: T) => {
  const { updatedAt: _u, createdAt: _c, ...rest } = o;
  return JSON.stringify(rest);
};

export interface MergeResult {
  /** ID antigo → ID final de cada objeto do pacote. */
  ids: Map<string, string>;
  addedObjects: number;
  reusedObjects: number;
}

/**
 * Traz objetos e imagens para o projeto (dentro de um commit/Immer).
 * Mesmo ID com conteúdo igual é reaproveitado; com conteúdo diferente vira um objeto novo,
 * e as referências dos objetos trazidos são reescritas para o ID novo.
 */
export function mergeBundleObjects(draft: Project, objects: CustomObject[], assets: Asset[]): MergeResult {
  for (const a of assets) if (!draft.assets[a.id]) draft.assets[a.id] = deepClone(a);
  const byId = new Map(objects.map((o) => [o.id, o]));
  const done = new Map<string, string>();
  const visiting = new Set<string>();
  const res: MergeResult = { ids: done, addedObjects: 0, reusedObjects: 0 };
  const resolve = (id: string): string => {
    const known = done.get(id);
    if (known) return known;
    const o = byId.get(id);
    if (!o || visiting.has(id)) return id;
    visiting.add(id);
    const fix = (list: Piece[]) => list.map((p) => (p.kind === 'object' && p.refId ? { ...p, refId: resolve(p.refId) } : p));
    const pieces = fix(o.pieces);
    const clips = (o.clips ?? []).map((c) => ({ ...c, frames: c.frames.map((f) => ({ ...f, pieces: fix(f.pieces) })) }));
    visiting.delete(id);
    const candidate: CustomObject = { ...o, pieces, clips };
    const existing = draft.customObjects[id];
    if (existing && strip(deepClone(existing)) === strip(candidate)) {
      done.set(id, id);
      res.reusedObjects++;
      return id;
    }
    const finalId = existing ? uid('obj') : id;
    draft.customObjects[finalId] = { ...deepClone(candidate), id: finalId, updatedAt: Date.now() };
    done.set(id, finalId);
    res.addedObjects++;
    return finalId;
  };
  for (const o of objects) resolve(o.id);
  return res;
}

export function mergeObjectBundle(draft: Project, b: ObjectBundle): { id: string; result: MergeResult } {
  const result = mergeBundleObjects(draft, [b.object, ...b.objects], b.assets);
  return { id: result.ids.get(b.object.id) ?? b.object.id, result };
}

/** Reescreve referências de objeto das peças com o mapa antigo → novo. */
export function remapObjectRefs(pieces: Piece[], ids: Map<string, string>): void {
  for (const p of pieces) if (p.kind === 'object' && p.refId) p.refId = ids.get(p.refId) ?? p.refId;
}

export function mergeBackgroundBundle(draft: Project, b: BackgroundBundle): { id: string; result: MergeResult; copied: boolean } {
  const result = mergeBundleObjects(draft, b.objects, b.assets);
  const cb = deepClone(b.background);
  for (const c of Object.values(cb.compositions)) if (c) remapObjectRefs(c.pieces, result.ids);
  const existing = draft.customBackgrounds[cb.id];
  if (existing && strip(deepClone(existing)) === strip(cb)) return { id: cb.id, result, copied: false };
  let copied = false;
  if (existing) {
    cb.id = uid('cbg');
    cb.name = `${cb.name} (cópia)`;
    copied = true;
  }
  draft.customBackgrounds[cb.id] = cb;
  return { id: cb.id, result, copied };
}
