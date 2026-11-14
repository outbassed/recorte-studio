/**
 * Catálogo oficial de pacotes (.rspack): arquivos reais em `public/packs/` com um `index.json`.
 * O app NÃO carrega os pacotes de uma vez: o índice (pequeno) lista tudo e cada pacote só é baixado quando o usuário
 * vê o conteúdo ou instala. Todo arquivo baixado é conferido pelo sha256 do índice antes de ser lido.
 * Depois de instalado, o pacote vive no IndexedDB e funciona offline.
 */
import { z } from 'zod';
import { LIMITS, PACK_ITEM_KINDS } from './format';

export const OFFICIAL_INDEX_FORMAT = 'recorte-studio-pack-index';
const semver = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);

export const OfficialEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
  file: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.rspack$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size: z.number().int().min(1).max(LIMITS.zip),
  name: z.string().min(1).max(80),
  version: semver,
  description: z.string().max(500).default(''),
  author: z.string().max(80).default(''),
  license: z.string().min(1).max(200),
  category: z.string().max(40).default('Geral'),
  collection: z.string().max(60).optional(),
  volume: z.number().int().min(1).max(999).optional(),
  tags: z.array(z.string().max(30)).max(24).default([]),
  dependencies: z.array(z.object({ id: z.string().max(64), version: semver })).max(20).default([]),
  itemCount: z.number().int().min(1).max(LIMITS.entries),
  counts: z.partialRecord(z.enum(PACK_ITEM_KINDS), z.number().int().min(0)).default({}),
  animated: z.number().int().min(0).default(0),
  items: z.array(z.object({
    id: z.string().max(100), name: z.string().max(80), kind: z.enum(PACK_ITEM_KINDS),
    category: z.string().max(40).optional(), subcategory: z.string().max(40).optional(),
    animated: z.boolean().optional(),
    /** Miniatura individual gerada pelo renderizador do app, sem baixar o volume. */
    thumbSvg: z.string().max(24_000).optional(),
    /** Arquivo individual verificável: baixar só este item, não o kit. */
    single: z.object({
      file: z.string().regex(/^items\/[a-f0-9]{40}\.rspack$/),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      size: z.number().int().min(1).max(LIMITS.zip),
    }).optional(),
  })).max(LIMITS.entries),
  /** Capa já desenhada (SVG pequeno gerado no build, mostrado numa <img>: nunca executa nada). */
  coverSvg: z.string().max(24_000).optional(),
});
export type OfficialEntry = z.infer<typeof OfficialEntrySchema>;

export const OfficialIndexSchema = z.object({
  format: z.literal(OFFICIAL_INDEX_FORMAT),
  formatVersion: z.literal(1),
  packs: z.array(OfficialEntrySchema).max(500),
});
export type OfficialIndex = z.infer<typeof OfficialIndexSchema>;

type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'arrayBuffer'>>;
const baseUrl = (): string => (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
const urlOf = (name: string): string => new URL(`packs/${name}`, baseUrl()).href;

export async function fetchOfficialIndex(fetchFn: FetchLike = (u) => fetch(u, { cache: 'no-cache' })): Promise<OfficialIndex> {
  let res;
  try { res = await fetchFn(urlOf('index.json')); } catch { throw new Error('sem conexão com o catálogo oficial'); }
  if (!res.ok) throw new Error(`o catálogo oficial respondeu ${res.status}`);
  const parsed = OfficialIndexSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new Error('o índice do catálogo oficial é inválido');
  const ids = new Set<string>();
  for (const p of parsed.data.packs) {
    if (ids.has(p.id)) throw new Error(`o índice repete o pacote ${p.id}`);
    ids.add(p.id);
  }
  return parsed.data;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Baixa o arquivo do pacote e só o devolve se o tamanho e o sha256 baterem com o índice. */
export async function fetchOfficialPack(entry: OfficialEntry, fetchFn: FetchLike = (u) => fetch(u)): Promise<Uint8Array> {
  let res;
  try { res = await fetchFn(urlOf(entry.file)); } catch { throw new Error('sem conexão para baixar o pacote'); }
  if (!res.ok) throw new Error(`não foi possível baixar ${entry.file} (${res.status})`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength !== entry.size) throw new Error(`${entry.file}: o tamanho não confere com o catálogo`);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('este navegador não consegue verificar o pacote (WebCrypto indisponível)');
  if (hex(await subtle.digest('SHA-256', buf)) !== entry.sha256) throw new Error(`${entry.file}: o conteúdo não confere com o catálogo (sha256)`);
  return new Uint8Array(buf);
}

export type OfficialStatus = 'available' | 'installed' | 'update' | 'disabled';

/** Estado de um pacote oficial em relação ao que está instalado (compara versões x.y.z). */
export function officialStatus(entry: OfficialEntry, installed: ReadonlyArray<{ id: string; version: string; enabled: number }>): OfficialStatus {
  const have = installed.find((p) => p.id === entry.id);
  if (!have) return 'available';
  const a = entry.version.split('.').map(Number);
  const b = have.version.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0) ? 'update' : have.enabled ? 'installed' : 'disabled';
  return have.enabled ? 'installed' : 'disabled';
}

export interface CollectionGroup { name: string; packs: OfficialEntry[]; items: number }
/** Agrupa por coleção (volumes em ordem). Pacotes sem coleção ficam em "Avulsos". */
export function groupByCollection(packs: readonly OfficialEntry[]): CollectionGroup[] {
  const map = new Map<string, OfficialEntry[]>();
  for (const p of packs) map.set(p.collection ?? 'Avulsos', [...(map.get(p.collection ?? 'Avulsos') ?? []), p]);
  return [...map.entries()]
    .map(([name, list]) => ({ name, packs: list.sort((x, y) => (x.volume ?? 0) - (y.volume ?? 0) || x.name.localeCompare(y.name, 'pt-BR')), items: list.reduce((s, p) => s + p.itemCount, 0) }))
    .sort((x, y) => (x.name === 'Avulsos' ? 1 : y.name === 'Avulsos' ? -1 : x.name.localeCompare(y.name, 'pt-BR')));
}

/** Ordem de instalação de um conjunto de pacotes respeitando dependências (as dependências oficiais vêm antes). */
export function installOrder(wanted: readonly OfficialEntry[], all: readonly OfficialEntry[]): OfficialEntry[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const out: OfficialEntry[] = [];
  const seen = new Set<string>();
  const visit = (p: OfficialEntry, stack: string[]) => {
    if (seen.has(p.id) || stack.includes(p.id)) return;
    for (const d of p.dependencies) { const dep = byId.get(d.id); if (dep) visit(dep, [...stack, p.id]); }
    seen.add(p.id);
    out.push(p);
  };
  for (const p of wanted) visit(p, []);
  return out;
}
