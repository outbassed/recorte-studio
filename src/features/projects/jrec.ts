/**
 * Formato oficial de projeto: .jrec — um ZIP legítimo com manifesto versionado.
 *
 *   manifest.json   { format, formatVersion, appVersion, project, assets[] (caminho, tipo, tamanho, sha256) }
 *   project.json    o documento (schema do projeto)
 *   assets/<id>.ext cada mídia uma única vez, no formato nativo
 *
 * Exportar valida todas as mídias antes de escrever. Importar valida manifesto,
 * tamanhos, hashes, tipos reais e troca os IDs das mídias por IDs de conteúdo,
 * então dois projetos nunca disputam o mesmo blob.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import type { Asset, Project } from '@/engine/model/schema';
import { ImportError, importProjectData, withFreshProjectId, type MigrationReport } from '@/migrations';
import { sanitizeSvg } from '@/features/library/sanitizeSvg';
import { extensionFor, mediaIdFor, sha256Hex, sniffMedia } from '@/features/library/media';
import { uid } from '@/engine/model/ids';
import type { Entry } from './archive';

export const JREC_FORMAT = 'recorte-studio-project';
export const JREC_VERSION = 1;
export const APP_VERSION = '1.1.0';

const ManifestSchema = z.object({
  format: z.literal(JREC_FORMAT),
  formatVersion: z.number().int().min(1),
  appVersion: z.string().optional(),
  createdAt: z.number().optional(),
  project: z.object({ id: z.string(), title: z.string() }).optional(),
  assets: z.array(z.object({ id: z.string(), path: z.string(), mime: z.string(), size: z.number().int().min(0), sha256: z.string().optional() })).max(5000),
  missing: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
});
export type JrecManifest = z.infer<typeof ManifestSchema>;

export class MissingMediaError extends Error {
  constructor(public missing: Array<{ id: string; name: string }>) {
    super(`${missing.length} mídia(s) do projeto não foram encontradas neste navegador: ${missing.map((m) => m.name).join(', ')}.`);
  }
}

/** Todas as mídias que o documento referencia, em qualquer parte. */
export function referencedAssetIds(p: Project): Set<string> {
  const ids = new Set<string>();
  for (const s of Object.values(p.scenes)) {
    for (const n of Object.values(s.nodes)) if (n.kind === 'image') ids.add(n.assetId);
    for (const t of s.tracks) if (t.type === 'audio') for (const c of t.clips) ids.add(c.assetId);
  }
  for (const c of Object.values(p.characters)) if (c.spriteAssetId) ids.add(c.spriteAssetId);
  for (const b of Object.values(p.customBackgrounds)) for (const v of Object.values(b.variants)) if (v) ids.add(v.assetId);
  return ids;
}

/** Troca IDs de mídia em todo o documento (in-place). */
export function remapAssetRefs(p: Project, map: Map<string, string>): void {
  const m = (id: string) => map.get(id) ?? id;
  for (const s of Object.values(p.scenes)) {
    for (const n of Object.values(s.nodes)) if (n.kind === 'image') n.assetId = m(n.assetId);
    for (const t of s.tracks) if (t.type === 'audio') for (const c of t.clips) c.assetId = m(c.assetId);
  }
  for (const c of Object.values(p.characters)) if (c.spriteAssetId) c.spriteAssetId = m(c.spriteAssetId);
  for (const b of Object.values(p.customBackgrounds)) for (const v of Object.values(b.variants)) if (v) v.assetId = m(v.assetId);
  const assets: Record<string, Asset> = {};
  for (const [id, a] of Object.entries(p.assets)) {
    const nid = m(id);
    assets[nid] = { ...a, id: nid };
  }
  p.assets = assets;
}

export interface BuildOptions {
  getBlob: (id: string) => Promise<Blob | undefined>;
  allowMissing?: boolean;
  onProgress?: (done: number, total: number) => void;
}

/** Monta o .jrec. Lança MissingMediaError se faltar mídia e allowMissing não estiver ligado. */
export async function buildJrec(project: Project, opts: BuildOptions): Promise<{ blob: Blob; manifest: JrecManifest }> {
  const ids = new Set([...Object.keys(project.assets), ...referencedAssetIds(project)]);
  const files: Zippable = {};
  const manifestAssets: JrecManifest['assets'] = [];
  const missing: JrecManifest['missing'] = [];
  let done = 0;
  for (const id of ids) {
    const meta = project.assets[id];
    const blob = meta ? await opts.getBlob(id) : undefined;
    done++;
    opts.onProgress?.(done, ids.size);
    if (!meta || !blob || blob.size === 0) {
      missing.push({ id, name: meta?.name ?? id });
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sniffed = sniffMedia(bytes);
    const mime = sniffed?.mime ?? meta.mime;
    const path = `assets/${id.replace(/[^a-zA-Z0-9_-]/g, '_')}${extensionFor(mime)}`;
    files[path] = [bytes, { level: /^(audio|image\/(png|jpeg|webp|gif))/.test(mime) ? 0 : 6 }];
    manifestAssets.push({ id, path, mime, size: bytes.length, sha256: (await sha256Hex(bytes)) ?? undefined });
  }
  if (missing.length && !opts.allowMissing) throw new MissingMediaError(missing);
  const manifest: JrecManifest = {
    format: JREC_FORMAT, formatVersion: JREC_VERSION, appVersion: APP_VERSION, createdAt: Date.now(),
    project: { id: project.id, title: project.title }, assets: manifestAssets, missing,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['project.json'] = strToU8(JSON.stringify(project));
  const zipped = zipSync(files, { level: 6 });
  // Só declara sucesso depois de reler o que foi escrito.
  const check = unzipSync(zipped);
  if (!check['manifest.json'] || !check['project.json']) throw new Error('Falha ao verificar o pacote gerado.');
  for (const a of manifestAssets) {
    if (check[a.path]?.length !== a.size) throw new Error(`Falha ao verificar "${a.path}" no pacote gerado.`);
  }
  return { blob: new Blob([zipped as Uint8Array<ArrayBuffer>], { type: 'application/x-recorte-studio' }), manifest };
}

export interface ParsedMedia { oldId: string; data: Uint8Array; mime: string; kind: 'image' | 'svg' | 'audio' }
export interface ParsedProject {
  kind: 'project';
  project: Project;
  report: MigrationReport | null;
  media: ParsedMedia[];
  warnings: string[];
  raw: string;
  missing: string[];
}
export interface ParsedMediaOnly { kind: 'media'; files: Array<{ name: string; data: Uint8Array; mime: string; kind: 'image' | 'svg' | 'audio' }> }

/** Remove uma pasta única de topo (zips de "pasta inteira"). */
function stripCommonFolder(entries: Entry[]): Entry[] {
  const first = entries[0]?.path.split('/')[0];
  if (!first || entries.some((e) => !e.path.startsWith(`${first}/`))) return entries;
  return entries.map((e) => ({ ...e, path: e.path.slice(first.length + 1) }));
}

function validMedia(data: Uint8Array, declaredMime: string | undefined, warnings: string[], name: string): { data: Uint8Array; mime: string; kind: 'image' | 'svg' | 'audio' } | null {
  const sniffed = sniffMedia(data);
  if (!sniffed) {
    warnings.push(`"${name}" não é uma imagem ou áudio reconhecido e foi ignorado.`);
    return null;
  }
  if (declaredMime && declaredMime.split('/')[0] !== sniffed.mime.split('/')[0]) {
    warnings.push(`"${name}" dizia ser ${declaredMime}, mas é ${sniffed.mime}. Foi tratado pelo conteúdo real.`);
  }
  if (sniffed.kind === 'svg') {
    try {
      const clean = sanitizeSvg(new TextDecoder().decode(data));
      if (clean.removed.length) warnings.push(`"${name}" (SVG) foi sanitizado: ${[...new Set(clean.removed)].slice(0, 4).join(', ')}.`);
      return { data: strToU8(clean.svg), mime: 'image/svg+xml', kind: 'svg' };
    } catch (e) {
      warnings.push(`"${name}" (SVG) foi recusado: ${e instanceof Error ? e.message : 'inválido'}.`);
      return null;
    }
  }
  return { data, mime: sniffed.mime, kind: sniffed.kind };
}

/** Interpreta as entradas de um compactado: projeto (.jrec ou pacote legado) ou só mídias. */
export async function parseEntries(entriesIn: Entry[]): Promise<ParsedProject | ParsedMediaOnly> {
  const entries = stripCommonFolder(entriesIn);
  const byPath = new Map(entries.map((e) => [e.path, e.data]));
  const warnings: string[] = [];
  const manifestBytes = byPath.get('manifest.json');
  let projectBytes = byPath.get('project.json');
  if (!projectBytes) {
    const jsons = entries.filter((e) => /\.json$/i.test(e.path) && !e.path.includes('/') && e.path !== 'manifest.json');
    for (const j of jsons) {
      try {
        const obj = JSON.parse(strFromU8(j.data)) as Record<string, unknown>;
        if (obj.format === 'recorte-studio' || Array.isArray(obj.actors) || obj.schemaVersion) {
          projectBytes = j.data;
          break;
        }
      } catch {
        /* não é projeto */
      }
    }
  }
  if (!projectBytes) {
    const files: ParsedMediaOnly['files'] = [];
    for (const e of entries) {
      const m = validMedia(e.data, undefined, [], e.path);
      if (m) files.push({ name: e.path.split('/').pop()!, ...m });
    }
    if (files.length === 0) throw new ImportError('Nenhum projeto do Recorte Studio nem mídia reconhecida foi encontrada neste arquivo.');
    return { kind: 'media', files };
  }
  const raw = strFromU8(projectBytes);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ImportError('O project.json do pacote está corrompido.');
  }
  const { project, report } = importProjectData(data);
  const media: ParsedMedia[] = [];
  const missing: string[] = [];
  if (manifestBytes) {
    let manifest: JrecManifest;
    try {
      manifest = ManifestSchema.parse(JSON.parse(strFromU8(manifestBytes)));
    } catch {
      throw new ImportError('O manifesto do arquivo .jrec é inválido.');
    }
    if (manifest.formatVersion > JREC_VERSION) throw new ImportError(`Este .jrec foi criado por uma versão mais nova (formato ${manifest.formatVersion}). Atualize o Recorte Studio.`);
    for (const a of manifest.assets) {
      const bytes = byPath.get(a.path);
      if (!bytes) throw new ImportError(`O pacote está incompleto: falta "${a.path}".`);
      if (bytes.length !== a.size) throw new ImportError(`"${a.path}" está corrompido (tamanho diferente do manifesto).`);
      if (a.sha256) {
        const h = await sha256Hex(bytes);
        if (h && h !== a.sha256) throw new ImportError(`"${a.path}" está corrompido (conteúdo diferente do manifesto).`);
      }
      const m = validMedia(bytes, a.mime, warnings, project.assets[a.id]?.name ?? a.path);
      if (m) media.push({ oldId: a.id, ...m });
    }
    for (const mm of manifest.missing) missing.push(mm.name);
    if (manifest.missing.length) warnings.push(`O pacote foi salvo incompleto: faltavam ${manifest.missing.map((x) => x.name).join(', ')}.`);
  } else {
    // Pacote legado (.recorte.zip): assets/<id> sem manifesto.
    for (const [path, bytes] of byPath) {
      if (!path.startsWith('assets/')) continue;
      const id = path.slice('assets/'.length).replace(/\.[a-z0-9]+$/i, '');
      const meta = project.assets[id];
      if (!meta) continue;
      const m = validMedia(bytes, meta.mime, warnings, meta.name);
      if (m) media.push({ oldId: id, ...m });
    }
  }
  const present = new Set(media.map((m) => m.oldId));
  for (const [id, a] of Object.entries(project.assets)) if (!present.has(id) && !missing.includes(a.name)) missing.push(a.name);
  return { kind: 'project', project, report, media, warnings, raw, missing };
}

/**
 * Grava as mídias com IDs de conteúdo e reescreve o documento. Mídias ausentes recebem
 * um ID novo e exclusivo: nunca se ligam por acaso ao blob de outro projeto.
 */
export async function commitParsedProject(parsed: ParsedProject, putBlob: (id: string, blob: Blob, name: string) => Promise<void>, hasBlob: (id: string) => Promise<boolean>, keepIds: Set<string> = new Set()): Promise<Project> {
  const project = withFreshProjectId(parsed.project);
  const map = new Map<string, string>();
  for (const id of keepIds) map.set(id, id);
  for (const m of parsed.media) {
    const { id, hash } = await mediaIdFor(m.data);
    map.set(m.oldId, id);
    if (!(await hasBlob(id))) await putBlob(id, new Blob([m.data as Uint8Array<ArrayBuffer>], { type: m.mime }), project.assets[m.oldId]?.name ?? id);
    const a = project.assets[m.oldId];
    if (a) {
      a.mime = m.mime;
      a.size = m.data.length;
      if (hash) a.hash = hash;
    }
  }
  for (const id of [...Object.keys(project.assets), ...referencedAssetIds(project)]) if (!map.has(id)) map.set(id, uid('missing'));
  remapAssetRefs(project, map);
  return project;
}
