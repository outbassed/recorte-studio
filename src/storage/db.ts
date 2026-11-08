/**
 * Persistência em IndexedDB (Dexie). Repositório tipado, sem dependência de UI.
 * Projetos ficam como JSON validado; mídia fica em blobs separados, fora do histórico.
 */
import Dexie, { type Table } from 'dexie';
import { ProjectSchema, type Asset, type Project } from '@/engine/model/schema';
import type { PackItemData, PackManifest } from '@/features/packs/format';
import { importProjectData } from '@/migrations';

export interface ProjectRecord {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
  archived: number;
  sceneCount: number;
  durationMs: number;
  thumbnail?: string;
  data: Project;
}

/** Linha da lista de projetos: sem o documento, com o formato do quadro. */
export type ProjectRow = Omit<ProjectRecord, 'data'> & { width: number; height: number; mediaCount: number };

export interface BlobRecord { id: string; blob: Blob; name: string; mime: string; size: number; createdAt: number }
export interface BackupRecord { id?: number; projectId: string; createdAt: number; label: string; raw: string }
export interface LibraryRecord { id: string; kind: LibraryKind; name: string; favorite: number; createdAt: number; data: unknown; /** Catálogo: última edição (registros antigos não têm). */ updatedAt?: number }
export type LibraryKind = 'character' | 'pose' | 'scene' | 'background' | 'animation' | 'prop' | 'audio' | 'object';
export interface MetaRecord { key: string; value: unknown }
/** Pacote opcional instalado: manifesto, itens já validados e estado. As mídias ficam na tabela de blobs. */
export interface PackRecord {
  id: string;
  name: string;
  version: string;
  /** 1 = ativo (aparece no catálogo); 0 = desativado (some das opções, projetos não mudam). */
  enabled: number;
  installedAt: number;
  size: number;
  manifest: PackManifest;
  items: PackItemData[];
  assets: Asset[];
}

class RecorteDB extends Dexie {
  projects!: Table<ProjectRecord, string>;
  blobs!: Table<BlobRecord, string>;
  backups!: Table<BackupRecord, number>;
  library!: Table<LibraryRecord, string>;
  meta!: Table<MetaRecord, string>;
  packs!: Table<PackRecord, string>;
  constructor() {
    super('recorte-studio');
    this.version(1).stores({
      projects: 'id, title, updatedAt, archived',
      blobs: 'id',
      backups: '++id, projectId, createdAt',
      library: 'id, kind, name, favorite',
      meta: 'key',
    });
    // v2: pacotes opcionais. Só acrescenta uma tabela; os dados existentes não mudam.
    this.version(2).stores({ packs: 'id' });
  }
}

export const db = new RecorteDB();

/** Todo ID de mídia segue um destes prefixos (legado: asset_, 1.1: media_). */
const MEDIA_REF = /\b(?:asset|media)_[a-z0-9]+\b/g;

export class StorageQuotaError extends Error {}

const isQuota = (e: unknown) => e instanceof Error && (e.name === 'QuotaExceededError' || /quota/i.test(e.message));

function recordOf(p: Project, thumbnail?: string): ProjectRecord {
  return {
    id: p.id,
    title: p.title,
    updatedAt: p.updatedAt,
    createdAt: p.createdAt,
    archived: p.metadata.archived ? 1 : 0,
    sceneCount: p.sceneOrder.length,
    durationMs: p.sceneOrder.reduce((sum, id) => sum + (p.scenes[id]?.durationMs ?? 0), 0),
    thumbnail,
    data: p,
  };
}

export const repo = {
  async saveProject(p: Project, thumbnail?: string): Promise<void> {
    try {
      const prev = thumbnail === undefined ? await db.projects.get(p.id) : undefined;
      await db.projects.put(recordOf(p, thumbnail ?? prev?.thumbnail));
    } catch (e) {
      if (isQuota(e)) throw new StorageQuotaError('O armazenamento do navegador está cheio.');
      throw e;
    }
  },
  async loadProject(id: string): Promise<Project | null> {
    const r = await db.projects.get(id);
    if (!r) return null;
    const parsed = ProjectSchema.safeParse(r.data);
    if (parsed.success) return parsed.data;
    return importProjectData(r.data).project;
  },
  listProjects: async (): Promise<ProjectRow[]> => {
    const rows: ProjectRow[] = [];
    await db.projects.each((r) => {
      const { data, ...rest } = r;
      const st = (data as Partial<Project> | undefined)?.settings;
      const w = st?.width ?? 1920;
      const h = st?.height ?? 1080;
      rows.push({ ...rest, width: w, height: h, mediaCount: Object.keys((data as Partial<Project> | undefined)?.assets ?? {}).length });
    });
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async deleteProject(id: string): Promise<void> {
    await db.transaction('rw', db.projects, db.backups, async () => {
      await db.projects.delete(id);
      await db.backups.where('projectId').equals(id).delete();
    });
    await repo.collectOrphanBlobs();
  },
  /** Blobs sem nenhum projeto referenciando são removidos. */
  async collectOrphanBlobs(): Promise<number> {
    const used = new Set<string>();
    // Um blob é mantido se QUALQUER projeto ou item da biblioteca o referencia.
    await db.projects.each((r) => {
      for (const id of Object.keys(r.data.assets)) used.add(id);
      for (const m of JSON.stringify(r.data).matchAll(MEDIA_REF)) used.add(m[0]);
    });
    await db.library.each((r) => {
      for (const m of JSON.stringify(r.data).matchAll(MEDIA_REF)) used.add(m[0]);
    });
    await db.packs.each((r) => {
      for (const a of r.assets) used.add(a.id);
    });
    const all = await db.blobs.toCollection().primaryKeys();
    const orphans = all.filter((id) => !used.has(id));
    await db.blobs.bulkDelete(orphans);
    return orphans.length;
  },
  async putBlob(id: string, blob: Blob, name: string): Promise<void> {
    try {
      await db.blobs.put({ id, blob, name, mime: blob.type, size: blob.size, createdAt: Date.now() });
    } catch (e) {
      if (isQuota(e)) throw new StorageQuotaError('Sem espaço para guardar esta mídia no navegador.');
      throw e;
    }
  },
  /** Uso de armazenamento deste app: projetos, mídias e cópias de segurança. */
  async storageStats(): Promise<{ projects: number; blobs: number; blobBytes: number; backups: number; backupBytes: number }> {
    let blobBytes = 0;
    await db.blobs.each((b) => { blobBytes += b.size || b.blob.size || 0; });
    let backupBytes = 0;
    await db.backups.each((b) => { backupBytes += b.raw.length; });
    return { projects: await db.projects.count(), blobs: await db.blobs.count(), blobBytes, backups: await db.backups.count(), backupBytes };
  },
  /** Mantém só as N cópias de segurança mais recentes de cada projeto. */
  async pruneBackups(keepPerProject = 3): Promise<number> {
    const all = await db.backups.toArray();
    const byProject = new Map<string, BackupRecord[]>();
    for (const b of all) byProject.set(b.projectId, [...(byProject.get(b.projectId) ?? []), b]);
    const drop: number[] = [];
    for (const list of byProject.values()) list.sort((a, b) => b.createdAt - a.createdAt).slice(keepPerProject).forEach((b) => b.id !== undefined && drop.push(b.id));
    await db.backups.bulkDelete(drop);
    return drop.length;
  },
  getBlob: async (id: string): Promise<Blob | undefined> => (await db.blobs.get(id))?.blob,
  hasBlob: async (id: string): Promise<boolean> => (await db.blobs.where('id').equals(id).count()) > 0,
  async addBackup(projectId: string, label: string, raw: string): Promise<void> {
    await db.backups.add({ projectId, label, raw, createdAt: Date.now() });
  },
  listBackups: (projectId: string) => db.backups.where('projectId').equals(projectId).toArray(),
  getMeta: async <T>(key: string): Promise<T | undefined> => (await db.meta.get(key))?.value as T | undefined,
  setMeta: (key: string, value: unknown) => db.meta.put({ key, value }),
  listLibrary: (kind?: LibraryKind) => (kind ? db.library.where('kind').equals(kind).toArray() : db.library.toArray()),
  putLibrary: (r: LibraryRecord) => db.library.put(r),
  deleteLibrary: (id: string) => db.library.delete(id),
  listPacks: () => db.packs.toArray(),
  getPack: (id: string) => db.packs.get(id),
  putPack: (r: PackRecord) => db.packs.put(r),
  deletePack: (id: string) => db.packs.delete(id),
  getLibrary: (id: string) => db.library.get(id),
  async storageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  },
};
