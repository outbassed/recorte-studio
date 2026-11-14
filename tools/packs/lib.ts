/**
 * Montagem dos pacotes oficiais: cada fonte (`sources/*.ts`) descreve um pacote; aqui ele vira um .rspack
 * determinístico (mesmo conteúdo = mesmos bytes), com sha256, contagens, lista de itens e capa para o índice.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mediaIdFor } from '@/features/library/media';
import { buildPack, readPack, type BuildItem, type PackManifest } from '@/features/packs/format';
import { OFFICIAL_INDEX_FORMAT, OfficialIndexSchema, type OfficialEntry, type OfficialIndex } from '@/features/packs/official';
import { itemSvg } from './preview';

export interface PackSource {
  meta: Omit<PackManifest, 'format' | 'formatVersion' | 'items' | 'media' | 'tags'> & { tags?: string[] };
  items: BuildItem[];
  media?: Array<{ bytes: Uint8Array; mime: string; ext: string }>;
  /** ID do item usado na capa (padrão: o primeiro objeto, personagem ou cenário). */
  cover?: string;
}
export interface BuiltPack { entry: OfficialEntry; bytes: Uint8Array; file: string; singles: Array<{ file: string; bytes: Uint8Array }> }

export const LICENSE_ORIGINAL = 'CC0 1.0 — conteúdo original do Recorte Studio (domínio público; use, altere e distribua livremente)';
export const AUTHOR = 'Recorte Studio';

const COVER_MAX = 20_000;
const THUMB_MAX = 24_000;

export async function buildOfficial(src: PackSource): Promise<BuiltPack> {
  const bytes = await buildPack(src.meta, src.items, src.media ?? [], { deterministic: true });
  // O que vai para o índice vem do próprio arquivo relido (nada declarado à mão).
  const read = await readPack(bytes);
  if (!read.ok) throw new Error(`Pacote ${src.meta.id} inválido: ${read.reason}`);
  const m = read.pack.manifest;
  const counts: Record<string, number> = {};
  for (const it of m.items) counts[it.kind] = (counts[it.kind] ?? 0) + 1;
  const animated = read.pack.items.filter((it) => it.kind === 'object' && it.data.object.clips.length > 0).length;
  const coverItem = src.items.find((i) => i.id === src.cover) ?? src.items.find((i) => i.kind !== 'pose') ?? src.items[0]!;
  let coverSvg: string | undefined = itemSvg(coverItem, { size: 200 });
  if (coverSvg.length > COVER_MAX) coverSvg = undefined; // capa grande demais para o índice: o app mostra um ícone
  // Um .rspack por item: instalação avulsa transfere somente o arquivo selecionado.
  // O volume original continua disponível para instalação em conjunto.
  const singles: BuiltPack['singles'] = [];
  const itemInfo: OfficialEntry['items'] = [];
  const mediaIds = await Promise.all((src.media ?? []).map(async (med) => ({ med, id: (await mediaIdFor(med.bytes)).id })));
  for (const it of src.items) {
    const hash = createHash('sha256').update(`${m.id}\0${it.id}`).digest('hex').slice(0, 40);
    const singleId = `rs-item-${hash}`;
    const soloMeta = {
      ...src.meta,
      id: singleId,
      name: `${it.name} (avulso)`.slice(0, 80),
      description: `Item de ${m.name}; os demais itens do volume são opcionais.`.slice(0, 500),
    };
    const assetIds = new Set((it.kind === 'object' || it.kind === 'background')
      ? (((it.data as { assets?: Array<{ id: string }> }).assets ?? []).map((asset) => asset.id))
      : []);
    const soloMedia = mediaIds.filter(({ id }) => assetIds.has(id)).map(({ med }) => med);
    const one = await buildPack(soloMeta, [it], soloMedia, { deterministic: true });
    const singleFile = `items/${hash}.rspack`;
    singles.push({ file: singleFile, bytes: one });
    let thumbSvg: string | undefined = itemSvg(it, { size: 112 });
    if (thumbSvg.length > THUMB_MAX) thumbSvg = undefined;
    itemInfo.push({
      id: it.id, name: it.name, kind: it.kind,
      category: it.meta?.category || m.category, subcategory: it.meta?.subcategory,
      thumbSvg,
      single: { file: singleFile, sha256: createHash('sha256').update(one).digest('hex'), size: one.length },
    });
  }
  const file = `${m.id}.rspack`;
  const entry: OfficialEntry = {
    id: m.id, file, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, name: m.name, version: m.version,
    description: m.description, author: m.author, license: m.license, category: m.category, collection: m.collection, volume: m.volume,
    tags: m.tags, dependencies: m.dependencies, itemCount: m.items.length, counts: counts as OfficialEntry['counts'], animated,
    items: itemInfo, coverSvg,
  };
  return { entry, bytes, file, singles };
}

/** Escreve os .rspack e o index.json; apaga .rspack antigos que não existem mais nas fontes. */
export function writeOfficial(dir: string, packs: BuiltPack[]): OfficialIndex {
  mkdirSync(dir, { recursive: true });
  const keep = new Set(packs.map((p) => p.file));
  for (const f of readdirSync(dir)) if (f.endsWith('.rspack') && !keep.has(f)) rmSync(join(dir, f));
  for (const p of packs) writeFileSync(join(dir, p.file), p.bytes);
  const itemsDir = join(dir, 'items');
  mkdirSync(itemsDir, { recursive: true });
  const singles = packs.flatMap((p) => p.singles);
  const keepSingles = new Set(singles.map((p) => p.file.slice('items/'.length)));
  for (const f of readdirSync(itemsDir)) if (f.endsWith('.rspack') && !keepSingles.has(f)) rmSync(join(itemsDir, f));
  for (const one of singles) writeFileSync(join(dir, one.file), one.bytes);
  const sorted = [...packs].sort((a, b) => (a.entry.collection ?? '~').localeCompare(b.entry.collection ?? '~', 'pt-BR') || (a.entry.volume ?? 0) - (b.entry.volume ?? 0) || a.entry.id.localeCompare(b.entry.id));
  const index = OfficialIndexSchema.parse({ format: OFFICIAL_INDEX_FORMAT, formatVersion: 1, packs: sorted.map((p) => p.entry) });
  writeFileSync(join(dir, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  return index;
}
