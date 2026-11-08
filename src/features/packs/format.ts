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
import type { Asset, Piece } from '@/engine/model/schema';
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
  dependencies: z.array(z.object({ id: z.string().max(64), version: semver })).max(20).default([]),
  items: z.array(z.object({
    id: z.string().regex(SAFE_NAME),
    kind: z.enum(['object', 'background']),
    name: z.string().trim().min(1).max(80),
    file: z.string().regex(SAFE_PATH),
    sha256: hex64,
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

export type PackItemData = { id: string; kind: 'object'; name: string; data: ObjectBundle } | { id: string; kind: 'background'; name: string; data: BackgroundBundle };
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

/** Peças de um item: objeto (com quadros) + objetos aninhados, ou composições do cenário. */
function itemPieces(it: { kind: 'object'; data: ObjectBundle } | { kind: 'background'; data: BackgroundBundle }): Piece[] {
  const objs = it.kind === 'object' ? [it.data.object, ...it.data.objects] : it.data.objects;
  const own = it.kind === 'background' ? Object.values(it.data.background.compositions).flatMap((c) => c?.pieces ?? []) : [];
  return [...own, ...objs.flatMap((o) => objectPieceLists(o).flat())];
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
    const read = it.kind === 'object' ? readObjectBundle(data) : readBackgroundBundle(data);
    if (!read.ok) return fail(`"${it.name}": ${read.reason}`);
    const missing = read.bundle.assets.find((a) => !mediaIds.has(a.id));
    if (missing) return fail(`"${it.name}" usa uma imagem que não está no pacote (${missing.id}).`);
    const item: PackItemData = it.kind === 'object' ? { id: it.id, kind: 'object', name: it.name, data: read.bundle as ObjectBundle } : { id: it.id, kind: 'background', name: it.name, data: read.bundle as BackgroundBundle };
    // Referências internas: todo objeto aninhado e toda imagem usada pelas peças vêm junto no item.
    const objIds = new Set(item.kind === 'object' ? [item.data.object.id, ...item.data.objects.map((o) => o.id)] : item.data.objects.map((o) => o.id));
    const assetIds = new Set(read.bundle.assets.map((a) => a.id));
    if (item.kind === 'background') for (const v of Object.values(item.data.background.variants)) if (v && !assetIds.has(v.assetId)) return fail(`"${it.name}": imagem de horário fora do item (${v.assetId}).`);
    for (const pc of itemPieces(item)) {
      if (pc.kind === 'object' && pc.refId && !objIds.has(pc.refId)) return fail(`"${it.name}" usa um objeto que não veio junto (${pc.refId}).`);
      if (pc.assetId && !assetIds.has(pc.assetId)) return fail(`"${it.name}" usa uma imagem que não veio junto (${pc.assetId}).`);
      const sprite = pc.character?.def.spriteAssetId;
      if (sprite && !assetIds.has(sprite)) return fail(`"${it.name}" usa uma imagem de personagem que não veio junto (${sprite}).`);
    }
    items.push(item);
  }
  return { ok: true, pack: { manifest, items, media, size: bytes.length } };
}

/** Monta um .rspack a partir de dados (pacote de demonstração e exportação). */
export async function buildPack(meta: Omit<PackManifest, 'format' | 'formatVersion' | 'items' | 'media'>, items: Array<{ id: string; kind: 'object' | 'background'; name: string; data: unknown }>, media: Array<{ bytes: Uint8Array; mime: string; ext: string }>): Promise<Uint8Array> {
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
    itemsOut.push({ id: it.id, kind: it.kind, name: it.name, file, sha256: (await sha256Hex(b))! });
  }
  const manifest: PackManifest = { format: PACK_FORMAT, formatVersion: 1, ...meta, items: itemsOut, media: mediaOut };
  zip['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(zip, { level: 6 });
}
