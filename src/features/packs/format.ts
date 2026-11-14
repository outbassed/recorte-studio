/**
 * Pacotes opcionais (.rspack): ZIP com manifest.json, items/*.json e media/*.
 *
 * Segurança e integridade (tudo verificado ANTES de gravar qualquer coisa):
 *  - só entram manifest.json, items/<nome> e media/<nome> (nada de "..", barras invertidas, caminhos absolutos);
 *  - limites: 60 MB compactado, 120 MB descompactado, 25 MB por mídia, 2 MB por item, 500 itens/mídias;
 *  - sha256 de cada arquivo confere com o manifesto, e o ID de cada mídia é o do conteúdo (media_<sha256>);
 *  - SVG com script, evento, link externo ou qualquer coisa que o limpador removeria é recusado;
 *  - itens são lidos pelos mesmos leitores tolerantes da biblioteca e só podem usar mídias do próprio pacote.
 * Nenhum pacote executa código: são só dados.
 */
import { strFromU8, strToU8, unzip, unzipSync, zipSync, type UnzipOptions, type Zippable } from 'fflate';
import { z } from 'zod';
import { CharacterDefinitionSchema, RigSchema, type Asset, type CharacterDefinition, type Piece, type Rig } from '@/engine/model/schema';
import { objectPieceLists } from '@/engine/world/pieces';
import { readBackgroundBundle, readObjectBundle, type BackgroundBundle, type ObjectBundle } from '@/features/library/bundles';
import { mediaIdFor, sha256Hex, sniffMedia } from '@/features/library/media';
import { sanitizeSvg } from '@/features/library/sanitizeSvg';

export const PACK_FORMAT = 'recorte-studio-pack';
export const PACK_EXT = '.rspack';
export const LIMITS = { zip: 60 * 1024 * 1024, total: 120 * 1024 * 1024, media: 25 * 1024 * 1024, item: 2 * 1024 * 1024, entries: 500 } as const;

const hex64 = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 inválido');
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SAFE_PATH = /^(items|media)\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const semver = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/, 'versão deve ser como 1.0.0');

export const PACK_ITEM_KINDS = ['object', 'background', 'character', 'pose'] as const;
export type PackItemKind = (typeof PACK_ITEM_KINDS)[number];

/** Metadados opcionais de cada item (pacotes antigos não têm: o item herda a categoria do pacote). */
const itemMeta = {
  category: z.string().trim().max(40).optional(),
  subcategory: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(24).default([]),
  description: z.string().max(300).default(''),
};

export const PackManifestSchema = z.object({
  format: z.literal(PACK_FORMAT),
  formatVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/, 'ID do pacote inválido (use minúsculas, números, ponto, hífen)'),
  name: z.string().trim().min(1).max(80),
  version: semver,
  description: z.string().max(500).default(''),
  author: z.string().max(80).default(''),
  license: z.string().trim().min(1, 'informe a licença').max(200),
  category: z.string().max(40).default('Geral'),
  /** Coleção temática (ex.: "Natal"): vários volumes podem pertencer a ela. */
  collection: z.string().trim().max(60).optional(),
  /** Número do volume dentro da coleção. Não é a versão do pacote. */
  volume: z.number().int().min(1).max(999).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(24).default([]),
  dependencies: z.array(z.object({ id: z.string().max(64), version: semver })).max(20).default([]),
  items: z.array(z.object({
    id: z.string().regex(SAFE_NAME),
    kind: z.enum(PACK_ITEM_KINDS),
    name: z.string().trim().min(1).max(80),
    file: z.string().regex(SAFE_PATH),
    sha256: hex64,
    ...itemMeta,
  })).min(1).max(LIMITS.entries),
  media: z.array(z.object({
    id: z.string().regex(/^media_[a-z0-9]+$/),
    file: z.string().regex(SAFE_PATH),
    mime: z.string().max(60),
    size: z.number().int().min(1).max(LIMITS.media),
    sha256: hex64,
  })).max(LIMITS.entries).default([]),
});
export type PackManifest = z.infer<typeof PackManifestSchema>;

export interface PoseData { rig: Rig; handL: 'open' | 'fist' | 'point'; handR: 'open' | 'fist' | 'point' }
export const PoseDataSchema = z.object({ rig: RigSchema, handL: z.enum(['open', 'fist', 'point']).default('open'), handR: z.enum(['open', 'fist', 'point']).default('open') });
export interface PackItemMeta { category?: string; subcategory?: string; tags: string[]; description: string }
export type PackItemData = (
  | { id: string; kind: 'object'; name: string; data: ObjectBundle }
  | { id: string; kind: 'background'; name: string; data: BackgroundBundle }
  | { id: string; kind: 'character'; name: string; data: CharacterDefinition }
  | { id: string; kind: 'pose'; name: string; data: PoseData }
) & { meta?: PackItemMeta };
export interface ParsedPack { manifest: PackManifest; items: PackItemData[]; media: Array<{ asset: Asset; bytes: Uint8Array }>; size: number }
export type PackRead = { ok: true; pack: ParsedPack } | { ok: false; reason: string };

/** Compara versões x.y.z. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

const fail = (reason: string): PackRead => ({ ok: false, reason });
/** Devolve o controle ao navegador (pacotes grandes não travam a interface). */
const tick = () => new Promise<void>((ok) => setTimeout(ok, 0));

/** Descompacta fora da thread principal quando o navegador permite; senão, no modo síncrono. */
async function unzipFiles(bytes: Uint8Array, opts: UnzipOptions): Promise<Record<string, Uint8Array>> {
  if (typeof Worker !== 'undefined') {
    try {
      return await new Promise((ok, err) => { unzip(bytes, opts, (e, d) => (e ? err(e) : ok(d))); });
    } catch { /* cai para o modo síncrono abaixo */ }
  }
  return unzipSync(bytes, opts);
}

/** Peças de um item: objeto (com quadros) + objetos aninhados, ou composições do cenário. Personagem e pose não têm peças. */
function itemPieces(it: PackItemData): Piece[] {
  if (it.kind === 'character' || it.kind === 'pose') return [];
  const objs = it.kind === 'object' ? [it.data.object, ...it.data.objects] : it.data.objects;
  const own = it.kind === 'background' ? Object.values(it.data.background.compositions).flatMap((c) => c?.pieces ?? []) : [];
  return [...own, ...objs.flatMap((o) => objectPieceLists(o).flat())];
}

/** ID da entidade dentro do item (é ele que identifica o item no catálogo). Pose não tem ID interno: vale o do item. */
export function innerIdOf(it: PackItemData): string {
  switch (it.kind) {
    case 'object': return it.data.object.id;
    case 'background': return it.data.background.id;
    case 'character': return it.data.id;
    case 'pose': return it.id;
  }
}

/**
 * Referências internas: todo objeto aninhado e toda imagem usada pelas peças vêm junto no item.
 * Devolve o motivo da recusa ou null. Também usada depois de trocar IDs na importação.
 */
export function itemIntegrityProblem(item: PackItemData): string | null {
  if (item.kind === 'character') return item.data.spriteAssetId ? `"${item.name}" usa uma imagem de personagem (sprite), que pacotes ainda não carregam.` : null;
  if (item.kind === 'pose') return null;
  const objIds = new Set(item.kind === 'object' ? [item.data.object.id, ...item.data.objects.map((o) => o.id)] : item.data.objects.map((o) => o.id));
  const assetIds = new Set(item.data.assets.map((a) => a.id));
  if (item.kind === 'background') for (const v of Object.values(item.data.background.variants)) if (v && !assetIds.has(v.assetId)) return `"${item.name}": imagem de horário fora do item (${v.assetId}).`;
  for (const pc of itemPieces(item)) {
    if (pc.kind === 'object' && pc.refId && !objIds.has(pc.refId)) return `"${item.name}" usa um objeto que não veio junto (${pc.refId}).`;
    if (pc.assetId && !assetIds.has(pc.assetId)) return `"${item.name}" usa uma imagem que não veio junto (${pc.assetId}).`;
    const sprite = pc.character?.def.spriteAssetId;
    if (sprite && !assetIds.has(sprite)) return `"${item.name}" usa uma imagem de personagem que não veio junto (${sprite}).`;
  }
  return null;
}

type ItemRead = { ok: true; item: PackItemData; assetIds: string[] } | { ok: false; reason: string };
function readItemData(kind: PackItemKind, id: string, name: string, data: unknown): ItemRead {
  if (kind === 'object' || kind === 'background') {
    const read = kind === 'object' ? readObjectBundle(data) : readBackgroundBundle(data);
    if (!read.ok) return { ok: false, reason: `"${name}": ${read.reason}` };
    const item: PackItemData = kind === 'object' ? { id, kind, name, data: read.bundle as ObjectBundle } : { id, kind, name, data: read.bundle as BackgroundBundle };
    return { ok: true, item, assetIds: read.bundle.assets.map((a) => a.id) };
  }
  if (kind === 'character') {
    const c = CharacterDefinitionSchema.safeParse(data);
    if (!c.success) return { ok: false, reason: `"${name}": o personagem está incompleto ou é de uma versão incompatível.` };
    return { ok: true, item: { id, kind, name, data: c.data }, assetIds: [] };
  }
  const p = PoseDataSchema.safeParse(data);
  if (!p.success) return { ok: false, reason: `"${name}": a pose está ilegível.` };
  return { ok: true, item: { id, kind, name, data: p.data }, assetIds: [] };
}

export async function readPack(bytes: Uint8Array, onProgress?: (done: number, total: number) => void): Promise<PackRead> {
  if (bytes.length > LIMITS.zip) return fail('Pacote maior que 60 MB.');
  let files: Record<string, Uint8Array>;
  let total = 0;
  let bad = '';
  try {
    files = await unzipFiles(bytes, {
      filter: (f) => {
        if (f.name.endsWith('/')) return false; // pastas
        if (f.name !== 'manifest.json' && !SAFE_PATH.test(f.name)) { bad ||= f.name; return false; }
        total += f.originalSize;
        return total <= LIMITS.total;
      },
    });
  } catch {
    return fail('Arquivo não é um pacote válido (ZIP ilegível).');
  }
  if (bad) return fail(`Caminho não permitido dentro do pacote: "${bad.slice(0, 80)}".`);
  if (total > LIMITS.total) return fail('Conteúdo descompactado maior que 120 MB.');
  const rawManifest = files['manifest.json'];
  if (!rawManifest) return fail('Pacote sem manifest.json.');
  let json: unknown;
  try { json = JSON.parse(strFromU8(rawManifest)); } catch { return fail('manifest.json não é JSON válido.'); }
  const m = PackManifestSchema.safeParse(json);
  if (!m.success) {
    const issue = m.error.issues[0];
    return fail(`Manifesto inválido: ${issue?.path.join('.') || 'raiz'}: ${issue?.message ?? 'erro'}.`);
  }
  const manifest = m.data;
  if (manifest.dependencies.some((d) => d.id === manifest.id)) return fail('O pacote depende dele mesmo.');
  const ids = new Set<string>();
  for (const it of manifest.items) {
    if (ids.has(it.id)) return fail(`ID de item repetido: ${it.id}.`);
    ids.add(it.id);
  }

  // Mídias: hash, ID pelo conteúdo, tipo real e SVG limpo.
  const media: ParsedPack['media'] = [];
  const mediaIds = new Set<string>();
  const steps = manifest.media.length + manifest.items.length;
  let done = 0;
  for (const md of manifest.media) {
    onProgress?.(++done, steps);
    if (done % 4 === 0) await tick();
    const b = files[md.file];
    if (!b) return fail(`Mídia ausente no pacote: ${md.file}.`);
    if (b.length > LIMITS.media || b.length !== md.size) return fail(`Tamanho da mídia não confere: ${md.file}.`);
    if ((await sha256Hex(b)) !== md.sha256) return fail(`Mídia corrompida (sha256 não confere): ${md.file}.`);
    if ((await mediaIdFor(b)).id !== md.id) return fail(`ID da mídia não corresponde ao conteúdo: ${md.file}.`);
    const sniff = sniffMedia(b);
    if (!sniff || sniff.kind === 'audio') return fail(`Mídia não suportada (só imagens): ${md.file}.`);
    let width = 400;
    let height = 400;
    if (sniff.kind === 'svg') {
      try {
        const r = sanitizeSvg(strFromU8(b));
        if (r.removed.length) return fail(`SVG com conteúdo não permitido (${[...new Set(r.removed)].slice(0, 3).join(', ')}): ${md.file}.`);
        width = r.width;
        height = r.height;
      } catch {
        return fail(`SVG inválido: ${md.file}.`);
      }
    }
    mediaIds.add(md.id);
    media.push({ bytes: b, asset: { id: md.id, kind: sniff.kind === 'svg' ? 'svg' : 'image', name: md.file.slice(6), mime: sniff.mime, size: b.length, width, height, createdAt: 0, hash: md.sha256 } as Asset });
  }

  // Itens: hash, leitura tolerante e mídias só do próprio pacote.
  const items: PackItemData[] = [];
  for (const it of manifest.items) {
    onProgress?.(++done, steps);
    if (done % 8 === 0) await tick();
    const b = files[it.file];
    if (!b) return fail(`Item ausente no pacote: ${it.file}.`);
    if (b.length > LIMITS.item) return fail(`Item grande demais: ${it.file}.`);
    if ((await sha256Hex(b)) !== it.sha256) return fail(`Item corrompido (sha256 não confere): ${it.file}.`);
    let data: unknown;
    try { data = JSON.parse(strFromU8(b)); } catch { return fail(`Item não é JSON válido: ${it.file}.`); }
    const read = readItemData(it.kind, it.id, it.name, data);
    if (!read.ok) return fail(read.reason);
    const missing = read.assetIds.find((id) => !mediaIds.has(id));
    if (missing) return fail(`"${it.name}" usa uma imagem que não está no pacote (${missing}).`);
    const problem = itemIntegrityProblem(read.item);
    if (problem) return fail(problem);
    items.push({ ...read.item, meta: { category: it.category, subcategory: it.subcategory, tags: it.tags, description: it.description } });
  }
  return { ok: true, pack: { manifest, items, media, size: bytes.length } };
}

export interface BuildItem { id: string; kind: PackItemKind; name: string; data: unknown; meta?: Partial<PackItemMeta> }
export interface BuildOptions {
  /** Data fixa nos arquivos do ZIP: o mesmo conteúdo gera sempre os mesmos bytes (pacotes oficiais reproduzíveis). */
  deterministic?: boolean;
}
const FIXED_MTIME = new Date(Date.UTC(2000, 0, 1));

/** Monta um .rspack a partir de dados (pacotes oficiais, demonstração e exportação). */
export async function buildPack(meta: Omit<PackManifest, 'format' | 'formatVersion' | 'items' | 'media' | 'tags'> & { tags?: string[] }, items: BuildItem[], media: Array<{ bytes: Uint8Array; mime: string; ext: string }>, opts: BuildOptions = {}): Promise<Uint8Array> {
  const zip: Zippable = {};
  const mediaOut: PackManifest['media'] = [];
  for (const md of media) {
    const { id } = await mediaIdFor(md.bytes);
    const file = `media/${id}.${md.ext}`;
    zip[file] = md.bytes;
    mediaOut.push({ id, file, mime: md.mime, size: md.bytes.length, sha256: (await sha256Hex(md.bytes))! });
  }
  const itemsOut: PackManifest['items'] = [];
  for (const it of items) {
    const b = strToU8(JSON.stringify(it.data));
    const file = `items/${it.id}.json`;
    zip[file] = b;
    itemsOut.push({ id: it.id, kind: it.kind, name: it.name, file, sha256: (await sha256Hex(b))!, category: it.meta?.category, subcategory: it.meta?.subcategory, tags: it.meta?.tags ?? [], description: it.meta?.description ?? '' });
  }
  const manifest: PackManifest = { format: PACK_FORMAT, formatVersion: 1, ...meta, tags: meta.tags ?? [], items: itemsOut, media: mediaOut };
  zip['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(zip, opts.deterministic ? { level: 6, mtime: FIXED_MTIME } : { level: 6 });
}
