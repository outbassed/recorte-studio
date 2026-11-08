/**
 * Catálogo unificado (Elenco, Cenários e Objetos são três visões da mesma lista).
 *
 * Fontes, sem banco novo:
 *  - PADRÃO: elenco, cenários e objetos embarcados no app (imutáveis: editar = criar cópia);
 *  - PROJETO: definições guardadas no projeto aberto (personagens, objetos e cenários montados);
 *  - MEUS: registros da biblioteca persistente do navegador (IndexedDB), válidos em todos os projetos.
 *
 * Política de dependências: um item da biblioteca é COPIADO para o projeto ao ser usado
 * (com imagens e objetos aninhados). Apagar ou alterar a biblioteca nunca quebra um projeto existente.
 *
 * Tudo aqui é puro (sem React nem IndexedDB) para ser testado em unidade.
 */
import { CharacterDefinitionSchema, RigSchema, SceneSchema, type CharacterDefinition, type Rig, type CustomBackground, type Project, type Scene } from '@/engine/model/schema';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { PROPS, PROP_CATEGORY_LABELS } from '@/engine/world/props';
import { characterUsage } from '@/engine/model/ops';
import { customObjectUsage } from '@/engine/world/pieces';
import { availableTimes, customBackgroundUsage } from '@/engine/world/customBackgrounds';
import { readBackgroundBundle, readObjectBundle, type BackgroundBundle, type ObjectBundle } from '@/features/library/bundles';
import { matchesSearch } from '@/features/library/search';
import { ANIMATED_CATEGORY, ANIMATED_TEMPLATES, animatedTemplate, TEMPLATE_PREFIX } from './animatedTemplates';
import type { LibraryRecord, PackRecord } from '@/storage/db';

export type CatalogView = 'cast' | 'scenery' | 'objects';
export type CatalogOrigin = 'builtin' | 'project' | 'mine' | 'pack';
export type CatalogFilter = 'all' | 'builtin' | 'packs' | 'mine' | 'favorites' | 'recent' | 'project';
export type CatalogSort = 'default' | 'name' | 'updated' | 'favorites';
export type CatalogKind = 'character' | 'pose' | 'sequence' | 'prop' | 'object' | 'background' | 'scene';

export type CatalogRef =
  | { type: 'builtin-character'; builtinId: string }
  | { type: 'project-character'; id: string }
  | { type: 'builtin-prop'; propId: string }
  | { type: 'project-object'; id: string }
  | { type: 'builtin-background'; presetId: string }
  | { type: 'project-background'; id: string }
  | { type: 'builtin-object'; tplId: string }
  | { type: 'pack-item'; packId: string; itemId: string }
  | { type: 'library'; libId: string };

export interface PoseData { rig: Rig; handL: 'open' | 'fist' | 'point'; handR: 'open' | 'fist' | 'point' }
export interface SceneData { scene: Scene; characters: Project['characters'] }

export interface CatalogEntry {
  /** Chave estável e com espaço de nomes (favoritos e recentes usam esta chave). */
  key: string;
  view: CatalogView;
  kind: CatalogKind;
  category: string;
  name: string;
  keywords: string[];
  origin: CatalogOrigin;
  /** Padrão: imutável (editar cria cópia). Projeto e Meus: editáveis. */
  editable: boolean;
  favorite: boolean;
  updatedAt: number;
  /** Quantas vezes aparece nas cenas/cenários/objetos do projeto aberto. */
  usage: number;
  /** A definição está guardada no projeto aberto. */
  inProject: boolean;
  /** Item de projeto que também está salvo na biblioteca (mesma identidade). */
  libId?: string;
  /** Nome do pacote de origem (itens de pacote). */
  packName?: string;
  /** Personagem padrão que já tem definição no projeto (some de "Todos" para não duplicar). */
  shadowed?: boolean;
  /** Personagem do projeto que nasceu de um personagem padrão. */
  fromBuiltin?: boolean;
  /** Registro ilegível: aparece com o motivo, nunca some em silêncio. */
  broken?: string;
  states: Array<{ id: string; label: string }>;
  ref: CatalogRef;
  character?: CharacterDefinition;
  objectBundle?: ObjectBundle;
  backgroundBundle?: BackgroundBundle;
  pose?: PoseData;
  sequenceSteps?: number;
  sceneData?: SceneData;
  times?: string[];
}

export const VIEW_LABELS: Record<CatalogView, string> = { cast: 'Elenco', scenery: 'Cenários', objects: 'Objetos' };
export const ORIGIN_LABELS: Record<CatalogOrigin, string> = { builtin: 'Padrão', project: 'Projeto', mine: 'Minha biblioteca', pack: 'Pacote' };
export const FILTER_LABELS: Record<CatalogFilter, string> = { all: 'Todos', builtin: 'Padrão', packs: 'Pacotes', mine: 'Meus', favorites: 'Favoritos', recent: 'Recentes', project: 'No projeto' };
export const SORT_LABELS: Record<CatalogSort, string> = { default: 'Por seção', name: 'Nome (A–Z)', updated: 'Mais recentes', favorites: 'Favoritos primeiro' };

export const CAT = {
  characters: 'Personagens',
  poses: 'Poses',
  sequences: 'Sequências',
  objects: 'Objetos montados',
  animated: ANIMATED_CATEGORY,
  custom: 'Personalizados',
  scenes: 'Cenas-molde',
} as const;

/** Cena salva na biblioteca, validada (com os padrões de campos novos) antes de virar miniatura ou cena. */
export function readSceneData(data: unknown): { sceneData?: SceneData; broken?: string } {
  const d = isObj(data) ? data : {};
  const scene = SceneSchema.safeParse(d.scene);
  if (!scene.success || !isObj(d.characters)) return { broken: 'A cena salva está ilegível ou é de uma versão incompatível.' };
  const characters: Project['characters'] = {};
  for (const [id, c] of Object.entries(d.characters)) {
    const p = CharacterDefinitionSchema.safeParse(c);
    if (!p.success) return { broken: 'Um personagem desta cena salva está ilegível.' };
    characters[id] = p.data;
  }
  return { sceneData: { scene: scene.data, characters } };
}

const keyOf = (ref: CatalogRef): string => {
  switch (ref.type) {
    case 'builtin-character': return `builtin:character:${ref.builtinId}`;
    case 'project-character': return `project:character:${ref.id}`;
    case 'builtin-prop': return `builtin:prop:${ref.propId}`;
    case 'project-object': return `project:object:${ref.id}`;
    case 'builtin-background': return `builtin:background:${ref.presetId}`;
    case 'project-background': return `project:background:${ref.id}`;
    case 'builtin-object': return `builtin:object:${ref.tplId}`;
    case 'pack-item': return `pack:${ref.packId}:${ref.itemId}`;
    case 'library': return `mine:${ref.libId}`;
  }
};
export const entryKey = keyOf;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export interface CatalogInput {
  project: Project;
  library: LibraryRecord[];
  /** Favoritos de itens sem campo próprio (padrão, objetos e cenários do projeto). */
  favorites: ReadonlySet<string>;
  /** Pacotes instalados; só os ATIVOS entram no catálogo. */
  packs?: PackRecord[];
}

function propUsage(project: Project, propId: string): number {
  let n = 0;
  for (const s of Object.values(project.scenes)) for (const nd of Object.values(s.nodes)) if (nd.kind === 'prop' && nd.propId === propId) n++;
  return n;
}
const backgroundUsage = (project: Project, presetId: string) => Object.values(project.scenes).filter((s) => s.background.presetId === presetId).length;
const cbTimes = (cb: CustomBackground) => availableTimes(cb) as string[];

/** Monta a lista completa. Ordem natural: projeto, minha biblioteca, padrão. */
export function buildCatalog({ project, library, favorites, packs = [] }: CatalogInput): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  const fav = (key: string) => favorites.has(key);

  // Identidades da biblioteca (para ligar item do projeto ao registro salvo).
  const libChar = new Map<string, LibraryRecord>();
  const libObj = new Map<string, LibraryRecord>();
  const libBg = new Map<string, LibraryRecord>();
  for (const r of library) {
    if (r.kind === 'character' && isObj(r.data) && typeof r.data.id === 'string') libChar.set(r.data.id, r);
    if (r.kind === 'object' && isObj(r.data) && isObj(r.data.object) && typeof r.data.object.id === 'string') libObj.set(r.data.object.id, r);
    if (r.kind === 'background' && isObj(r.data) && isObj(r.data.background) && typeof r.data.background.id === 'string') libBg.set(r.data.background.id, r);
  }

  /* ---------------- projeto ---------------- */
  const builtinInProject = new Set<string>();
  for (const c of Object.values(project.characters)) {
    if (c.builtinId) builtinInProject.add(c.builtinId);
    const ref: CatalogRef = { type: 'project-character', id: c.id };
    out.push({
      key: keyOf(ref), view: 'cast', kind: 'character', category: CAT.characters, name: c.name,
      keywords: [c.hair.style, c.outfit.top, c.builtinId ?? ''], origin: 'project', editable: true, favorite: c.favorite,
      updatedAt: project.updatedAt, usage: characterUsage(project, c.id), inProject: true, libId: libChar.get(c.id)?.id,
      fromBuiltin: !!c.builtinId, states: [], ref, character: c,
    });
  }
  for (const o of Object.values(project.customObjects)) {
    const ref: CatalogRef = { type: 'project-object', id: o.id };
    const key = keyOf(ref);
    out.push({
      key, view: 'objects', kind: 'object', category: o.clips.length ? CAT.animated : CAT.objects, name: o.name, keywords: o.pieces.flatMap((p) => (p.kind === 'text' ? [p.name, p.text] : [p.name])),
      origin: 'project', editable: true, favorite: fav(key), updatedAt: o.updatedAt || o.createdAt, usage: customObjectUsage(project, o.id),
      inProject: true, libId: libObj.get(o.id)?.id, states: o.clips.map((c) => ({ id: c.id, label: c.name })), ref, fromBuiltin: o.id.startsWith(TEMPLATE_PREFIX),
    });
  }
  for (const cb of Object.values(project.customBackgrounds)) {
    const ref: CatalogRef = { type: 'project-background', id: cb.id };
    const key = keyOf(ref);
    out.push({
      key, view: 'scenery', kind: 'background', category: CAT.custom, name: cb.name, keywords: [],
      origin: 'project', editable: true, favorite: fav(key), updatedAt: cb.createdAt, usage: customBackgroundUsage(project, cb.id),
      inProject: true, libId: libBg.get(cb.id)?.id, states: [], times: cbTimes(cb), ref,
    });
  }

  /* ---------------- minha biblioteca ---------------- */
  for (const r of library) {
    const ref: CatalogRef = { type: 'library', libId: r.id };
    const base = {
      key: keyOf(ref), name: r.name, origin: 'mine' as const, editable: true, favorite: !!r.favorite,
      updatedAt: r.updatedAt ?? r.createdAt, usage: 0, inProject: false, states: [], ref, keywords: [] as string[],
    };
    if (r.kind === 'character') {
      const p = CharacterDefinitionSchema.safeParse(r.data);
      if (p.success && project.characters[p.data.id]) continue; // já no projeto (mesma identidade)
      out.push({ ...base, view: 'cast', kind: 'character', category: CAT.characters, character: p.success ? p.data : undefined, broken: p.success ? undefined : 'O personagem salvo está incompleto ou é de uma versão incompatível.' });
    } else if (r.kind === 'pose') {
      const d = isObj(r.data) ? r.data : {};
      const rig = RigSchema.safeParse(d.rig);
      const hand = (h: unknown) => (h === 'fist' || h === 'point' ? h : 'open');
      out.push({ ...base, view: 'cast', kind: 'pose', category: CAT.poses, pose: rig.success ? { rig: rig.data, handL: hand(d.handL), handR: hand(d.handR) } : undefined, broken: rig.success ? undefined : 'A pose salva está ilegível.' });
    } else if (r.kind === 'animation') {
      const d = isObj(r.data) ? r.data : {};
      const ok = Array.isArray(d.items);
      out.push({ ...base, view: 'cast', kind: 'sequence', category: CAT.sequences, sequenceSteps: ok ? (d.items as unknown[]).length : 0, broken: ok ? undefined : 'A sequência salva está ilegível.' });
    } else if (r.kind === 'object') {
      const read = readObjectBundle(r.data);
      if (read.ok && project.customObjects[read.bundle.object.id]) continue;
      out.push({ ...base, view: 'objects', kind: 'object', category: CAT.objects, keywords: read.ok ? read.bundle.object.pieces.flatMap((p) => (p.kind === 'text' ? [p.name, p.text] : [p.name])) : [], objectBundle: read.ok ? read.bundle : undefined, broken: read.ok ? undefined : read.reason });
    } else if (r.kind === 'background') {
      const read = readBackgroundBundle(r.data);
      if (read.ok && project.customBackgrounds[read.bundle.background.id]) continue;
      out.push({ ...base, view: 'scenery', kind: 'background', category: CAT.custom, backgroundBundle: read.ok ? read.bundle : undefined, times: read.ok ? cbTimes(read.bundle.background) : [], broken: read.ok ? undefined : read.reason });
    } else if (r.kind === 'scene') {
      out.push({ ...base, view: 'scenery', kind: 'scene', category: CAT.scenes, ...readSceneData(r.data) });
    }
    // 'prop' e 'audio' nunca foram gravados por nenhuma versão; não há o que mostrar.
  }

  /* ---------------- pacotes ativos (protegidos: editar cria cópia) ---------------- */
  for (const pk of packs) {
    if (!pk.enabled) continue;
    for (const it of pk.items) {
      const ref: CatalogRef = { type: 'pack-item', packId: pk.id, itemId: it.id };
      const key = keyOf(ref);
      const base = {
        key, name: it.name, origin: 'pack' as const, editable: false, favorite: fav(key), updatedAt: pk.installedAt, usage: 0, inProject: false,
        states: [] as Array<{ id: string; label: string }>, ref, packName: pk.name, keywords: [pk.name, pk.manifest.category], category: pk.manifest.category,
      };
      if (it.kind === 'object') {
        const o = it.data.object;
        out.push({ ...base, view: 'objects', kind: 'object', usage: customObjectUsage(project, o.id), shadowed: !!project.customObjects[o.id], states: o.clips.map((c) => ({ id: c.id, label: c.name })), objectBundle: it.data });
      } else {
        const bg = it.data.background;
        out.push({ ...base, view: 'scenery', kind: 'background', usage: customBackgroundUsage(project, bg.id), shadowed: !!project.customBackgrounds[bg.id], times: cbTimes(bg), backgroundBundle: it.data });
      }
    }
  }

  /* ---------------- padrão ---------------- */
  for (const c of BUILTIN_CHARACTERS) {
    const ref: CatalogRef = { type: 'builtin-character', builtinId: c.builtinId! };
    const key = keyOf(ref);
    const inProj = Object.values(project.characters).find((d) => d.builtinId === c.builtinId);
    out.push({
      key, view: 'cast', kind: 'character', category: CAT.characters, name: c.name, keywords: [c.hair.style, c.outfit.top],
      origin: 'builtin', editable: false, favorite: fav(key), updatedAt: 0, usage: inProj ? characterUsage(project, inProj.id) : 0,
      inProject: false, shadowed: builtinInProject.has(c.builtinId!), states: [], ref, character: c,
    });
  }
  for (const t of ANIMATED_TEMPLATES) {
    const ref: CatalogRef = { type: 'builtin-object', tplId: t.id };
    const key = keyOf(ref);
    const o = animatedTemplate(t.id)!;
    out.push({
      key, view: 'objects', kind: 'object', category: t.category ?? CAT.animated, name: t.label, keywords: t.keywords, origin: 'builtin', editable: false,
      favorite: fav(key), updatedAt: 0, usage: customObjectUsage(project, o.id), inProject: false, shadowed: !!project.customObjects[o.id],
      states: o.clips.map((c) => ({ id: c.id, label: c.name })), ref,
    });
  }
  const groupOrder = [...new Set(BACKGROUNDS.map((b) => b.group))];
  for (const b of [...BACKGROUNDS].sort((x, y) => groupOrder.indexOf(x.group) - groupOrder.indexOf(y.group))) {
    const ref: CatalogRef = { type: 'builtin-background', presetId: b.id };
    const key = keyOf(ref);
    out.push({
      key, view: 'scenery', kind: 'background', category: b.group, name: b.label, keywords: b.keywords, origin: 'builtin', editable: false,
      favorite: fav(key), updatedAt: 0, usage: backgroundUsage(project, b.id), inProject: false,
      states: [{ id: 'day', label: 'Dia' }, { id: 'night', label: 'Noite' }], ref,
    });
  }
  const catOrder = Object.keys(PROP_CATEGORY_LABELS);
  for (const p of [...PROPS].sort((x, y) => catOrder.indexOf(x.category) - catOrder.indexOf(y.category))) {
    const ref: CatalogRef = { type: 'builtin-prop', propId: p.id };
    const key = keyOf(ref);
    out.push({
      key, view: 'objects', kind: 'prop', category: PROP_CATEGORY_LABELS[p.category], name: p.label, keywords: p.keywords, origin: 'builtin',
      editable: false, favorite: fav(key), updatedAt: 0, usage: propUsage(project, p.id), inProject: false, states: p.states ?? [], ref,
    });
  }
  return out;
}

export interface CatalogQuery { text: string; filter: CatalogFilter; category: string | null; sort: CatalogSort; kind?: CatalogKind | null }
export const DEFAULT_QUERY: CatalogQuery = { text: '', filter: 'all', category: null, sort: 'default', kind: null };
/** Nomes dos tipos de item (Biblioteca principal e Toolbox). */
export const KIND_LABELS: Record<CatalogKind, string> = { character: 'Personagens', pose: 'Poses', sequence: 'Sequências', prop: 'Objetos prontos', object: 'Objetos montados', background: 'Cenários', scene: 'Cenas-molde' };
export type CatalogScope = CatalogView | 'all';

const ORIGIN_RANK: Record<CatalogOrigin, number> = { project: 0, mine: 1, pack: 2, builtin: 3 };

/** Filtra e ordena uma visão. Busca sem diferenciar maiúsculas nem acentos. */
export function queryCatalog(entries: CatalogEntry[], view: CatalogScope, q: CatalogQuery, recents: readonly string[] = []): CatalogEntry[] {
  const recentIdx = new Map(recents.map((k, i) => [k, i]));
  let list = view === 'all' ? [...entries] : entries.filter((e) => e.view === view);
  if (q.kind) list = list.filter((e) => e.kind === q.kind);
  if (q.category) list = list.filter((e) => e.category === q.category);
  list = list.filter((e) => matchesSearch(q.text, e.name, e.keywords, e.category));
  switch (q.filter) {
    case 'all': list = list.filter((e) => !e.shadowed); break;
    case 'builtin': list = list.filter((e) => e.origin === 'builtin'); break;
    case 'packs': list = list.filter((e) => e.origin === 'pack'); break;
    case 'mine': list = list.filter((e) => e.origin === 'mine' || (e.origin === 'project' && !e.fromBuiltin)); break;
    case 'favorites': list = list.filter((e) => e.favorite); break;
    case 'recent': list = list.filter((e) => recentIdx.has(e.key)); break;
    case 'project': list = list.filter((e) => e.inProject || e.usage > 0); break;
  }
  const byName = (a: CatalogEntry, b: CatalogEntry) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  if (q.filter === 'recent' && q.sort === 'default') return list.sort((a, b) => recentIdx.get(a.key)! - recentIdx.get(b.key)!);
  if (q.sort === 'name') return list.sort(byName);
  if (q.sort === 'updated') return list.sort((a, b) => b.updatedAt - a.updatedAt || byName(a, b));
  if (q.sort === 'favorites') return list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin]);
  return list.sort((a, b) => ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin]);
}

/** Categorias de uma visão, na ordem em que aparecem, com contagem. */
export function categoriesOf(entries: CatalogEntry[], view: CatalogScope): Array<{ id: string; count: number }> {
  const m = new Map<string, number>();
  for (const e of entries) if ((view === 'all' || e.view === view) && !e.shadowed) m.set(e.category, (m.get(e.category) ?? 0) + 1);
  const pinned: string[] = view === 'cast' ? [CAT.characters, CAT.poses, CAT.sequences] : view === 'scenery' ? [CAT.custom, CAT.scenes] : [CAT.objects, CAT.animated];
  const keys = [...m.keys()].sort((a, b) => {
    const ia = pinned.indexOf(a);
    const ib = pinned.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return keys.map((id) => ({ id, count: m.get(id)! }));
}

/** Seção de exibição no modo "Por seção". */
export function sectionOf(e: CatalogEntry): string {
  if (e.origin === 'project') return 'Neste projeto';
  if (e.origin === 'mine') return 'Minha biblioteca';
  if (e.origin === 'pack') return `Pacote: ${e.packName ?? ''}`;
  return e.view === 'scenery' || e.view === 'objects' ? e.category : 'Elenco pronto';
}

/** Lista de recentes: mais novo primeiro, sem repetição, limitada. */
export function pushRecent(list: readonly string[], key: string, max = 24): string[] {
  return [key, ...list.filter((k) => k !== key)].slice(0, max);
}
