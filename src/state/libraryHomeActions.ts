/**
 * Ações da Biblioteca principal (tela inicial ou sobreposição no editor). Funcionam SEM projeto
 * aberto: gravam direto na biblioteca persistente (mesmo armazenamento das abas do Studio).
 * Criar e editar precisam de um criador, que vive dentro de um projeto: sem projeto aberto, usam a
 * "Oficina da Biblioteca", um projeto real reaproveitado; com projeto aberto, usam o projeto atual.
 */
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { createProject, newCharacterDefinition } from '@/engine/model/factory';
import { deepClone, newItemId } from '@/engine/model/ids';
import { CustomObjectSchema, type CharacterDefinition } from '@/engine/model/schema';
import { getProp } from '@/engine/world/props';
import { createPiece } from '@/engine/world/pieces';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';
import type { CatalogEntry } from '@/features/catalog/catalog';
import { createAndOpen, openProjectById } from '@/features/projects/session';
import { db, repo, StorageQuotaError, type LibraryRecord } from '@/storage/db';
import { identityOf, planIdChange } from '@/features/library/changeId';
import { analyzeImport, planImport, readLibraryRecord, type Resolutions } from '@/features/packs/conflicts';
import type { PackItemData, ParsedPack } from '@/features/packs/format';
import { builtinIds } from '@/features/packs/builtinIds';
import { editEntry, reloadLibrary, useLibrary } from './catalogActions';
import { newCustomObject, newScenery } from './creatorActions';
import { usePacks } from './packActions';
import { setPref, usePrefs } from './prefs';
import { commit, useProjectStore } from './projectStore';
import { askImportConflicts, closeOverlay, confirmDialog, promptDialog, toast, useUI } from './uiStore';

const hasProject = () => !!useProjectStore.getState().project;

/** Mensagem amigável para falhas do armazenamento do navegador. */
export function storageError(e: unknown, what: string): string {
  if (e instanceof StorageQuotaError || (e instanceof Error && /quota/i.test(`${e.name} ${e.message}`))) return `${what}: o armazenamento do navegador está cheio. Libere espaço em Configurações → Armazenamento.`;
  return `${what}: ${e instanceof Error ? e.message : 'erro desconhecido do navegador'}.`;
}
async function safePut(r: LibraryRecord, what: string): Promise<boolean> {
  try {
    await repo.putLibrary(r);
    return true;
  } catch (e) {
    toast(storageError(e, what), 'error');
    return false;
  }
}

/* ------------------------------ oficina ------------------------------ */
/** Garante um projeto aberto para usar os criadores (o atual, ou a Oficina da Biblioteca). */
export async function ensureWorkshop(): Promise<boolean> {
  if (hasProject()) { closeOverlay(); return true; }
  const id = usePrefs.getState().workshopProjectId;
  if (id && (await openProjectById(id))) return true;
  const p = createProject('Oficina da Biblioteca');
  p.metadata.description = 'Projeto usado pela Biblioteca para criar e editar itens. Pode ser apagado: os itens salvos na biblioteca não dependem dele.';
  setPref('workshopProjectId', p.id);
  await createAndOpen(p);
  return true;
}

export async function createInLibrary(kind: 'object' | 'background' | 'character'): Promise<void> {
  await ensureWorkshop();
  if (kind === 'object') await newCustomObject();
  else if (kind === 'background') await newScenery();
  else {
    const def = newCharacterDefinition('Novo personagem', {});
    commit('Criar personagem', (d) => { d.characters[def.id] = def; });
    useUI.setState({ dialog: 'creator', creatorCharacterId: def.id });
  }
  toast('Quando terminar, salve na biblioteca (botão Biblioteca do criador, ou detalhes do item → Salvar na biblioteca).');
}

/** Editar: item próprio abre no criador; padrão e pacote viram cópia (regra de sempre). */
export async function editInLibrary(e: CatalogEntry): Promise<void> {
  await ensureWorkshop();
  await editEntry(e);
}

/* ------------------------------ cópia própria a partir do padrão ou pacote ------------------------------ */
/** Grava na minha biblioteca uma cópia com identidade nova de um item padrão ou de pacote. */
export async function copyToMyLibrary(e: CatalogEntry): Promise<string | null> {
  const now = Date.now();
  let rec: LibraryRecord | null = null;
  const ref = e.ref;
  if (ref.type === 'builtin-character') {
    const src = BUILTIN_CHARACTERS.find((c) => c.builtinId === ref.builtinId);
    if (src) { const d: CharacterDefinition = { ...deepClone(src), id: newItemId(), name: `${src.name} (cópia)`, builtinId: undefined, favorite: false }; rec = { id: newItemId(), kind: 'character', name: d.name, favorite: 0, createdAt: now, updatedAt: now, data: d }; }
  } else if (ref.type === 'builtin-prop') {
    const def = getProp(ref.propId);
    if (def) {
      const obj = CustomObjectSchema.parse({ id: newItemId(), name: `${def.label} (cópia)`, width: def.w, height: def.h, createdAt: now, updatedAt: now, pieces: [createPiece('prop', { name: def.label, refId: def.id, colorA: def.a, colorB: def.b, state: def.defaultState ?? '' })] });
      rec = { id: newItemId(), kind: 'object', name: obj.name, favorite: 0, createdAt: now, updatedAt: now, data: { bundle: 2, object: obj, objects: [], assets: [] } };
    }
  } else if (ref.type === 'builtin-object') {
    const t = animatedTemplate(ref.tplId);
    if (t) { const obj = { ...deepClone(t), id: newItemId(), name: `${t.name} (cópia)`, createdAt: now, updatedAt: now }; rec = { id: newItemId(), kind: 'object', name: obj.name, favorite: 0, createdAt: now, updatedAt: now, data: { bundle: 2, object: obj, objects: [], assets: [] } }; }
  } else if (ref.type === 'pack-item') {
    const it = usePacks.getState().packs.find((p) => p.id === ref.packId)?.items.find((i) => i.id === ref.itemId);
    if (it?.kind === 'object') { const data = deepClone(it.data); data.object = { ...data.object, id: newItemId(), name: `${it.name} (cópia)` }; rec = { id: newItemId(), kind: 'object', name: data.object.name, favorite: 0, createdAt: now, updatedAt: now, data }; }
    if (it?.kind === 'background') { const data = deepClone(it.data); data.background = { ...data.background, id: newItemId(), name: `${it.name} (cópia)` }; rec = { id: newItemId(), kind: 'background', name: data.background.name, favorite: 0, createdAt: now, updatedAt: now, data }; }
    if (it?.kind === 'character') { const d: CharacterDefinition = { ...deepClone(it.data), id: newItemId(), name: `${it.name} (cópia)`, builtinId: undefined, favorite: false }; rec = { id: newItemId(), kind: 'character', name: d.name, favorite: 0, createdAt: now, updatedAt: now, data: d }; }
    if (it?.kind === 'pose') rec = { id: newItemId(), kind: 'pose', name: `${it.name} (cópia)`, favorite: 0, createdAt: now, updatedAt: now, data: deepClone(it.data) };
  } else if (ref.type === 'builtin-background') {
    toast('Para copiar um cenário padrão, use Editar: ele abre no Criador de Cenários e você salva na biblioteca de lá.', 'info');
    return null;
  }
  if (!rec || !(await safePut(rec, 'Não foi possível salvar a cópia'))) return null;
  await reloadLibrary();
  toast(`"${rec.name}" salvo na sua biblioteca. O original não muda.`, 'success');
  return rec.id;
}

/* ------------------------------ itens próprios ------------------------------ */
const recordOf = (libId: string) => useLibrary.getState().records.find((r) => r.id === libId);

export async function renameRecord(libId: string): Promise<void> {
  const r = recordOf(libId);
  if (!r) return;
  const name = (await promptDialog('Renomear', 'Nome', r.name))?.trim();
  if (!name || name === r.name) return;
  const data = deepClone(r.data) as Record<string, Record<string, unknown> | unknown>;
  if (r.kind === 'character') (data as Record<string, unknown>).name = name;
  if (r.kind === 'object' && data.object) (data.object as Record<string, unknown>).name = name;
  if (r.kind === 'background' && data.background) (data.background as Record<string, unknown>).name = name;
  if (await safePut({ ...r, name, data, updatedAt: Date.now() }, 'Não foi possível renomear')) await reloadLibrary();
}

export async function duplicateRecord(libId: string): Promise<void> {
  const r = recordOf(libId);
  if (!r) return;
  const data = deepClone(r.data) as Record<string, unknown>;
  if (r.kind === 'character') data.id = newItemId();
  if (r.kind === 'object' && data.object) (data.object as Record<string, unknown>).id = newItemId();
  if (r.kind === 'background' && data.background) (data.background as Record<string, unknown>).id = newItemId();
  const now = Date.now();
  if (await safePut({ ...r, id: newItemId(), name: `${r.name} (cópia)`, favorite: 0, createdAt: now, updatedAt: now, data }, 'Não foi possível duplicar')) {
    await reloadLibrary();
    toast(`"${r.name} (cópia)" criado.`, 'success');
  }
}

export async function deleteRecord(libId: string): Promise<boolean> {
  const r = recordOf(libId);
  if (!r) return false;
  const ok = await confirmDialog({ title: 'Apagar da minha biblioteca', message: `Apagar "${r.name}"? Os projetos que já o usam guardam a própria cópia e não mudam.`, confirmLabel: 'Apagar', danger: true });
  if (!ok) return false;
  try {
    await repo.deleteLibrary(libId);
  } catch (e) {
    toast(storageError(e, 'Não foi possível apagar'), 'error');
    return false;
  }
  await reloadLibrary();
  toast(`"${r.name}" apagado da biblioteca.`);
  return true;
}

export function downloadJson(name: string, json: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function exportRecords(records: LibraryRecord[], fileName = 'biblioteca-recorte-studio.json'): void {
  downloadJson(fileName, JSON.stringify({ format: 'recorte-studio-library', version: 1, items: records }, null, 2));
}

export interface LibraryImportResult {
  /** Itens gravados (novos). */
  created: number;
  /** Mesmo ID e mesmo conteúdo de algo que já existe: reconhecidos como duplicata, não importados de novo. */
  duplicates: number;
  /** Conflitos resolvidos com um ID novo (automático ou manual). */
  renamed: number;
  /** Itens que o usuário escolheu não importar. */
  notImported: number;
  /** Registros ilegíveis ou repetidos dentro do próprio arquivo. */
  skipped: number;
  cancelled: boolean;
}

/**
 * Importa um arquivo de biblioteca (.json) com o MESMO motor de conflitos dos pacotes: item com o mesmo ID e o mesmo
 * conteúdo é duplicata reconhecida; com conteúdo diferente (ou ID de item padrão) abre o diálogo de conflito; nada é
 * sobrescrito em silêncio e a gravação é atômica. `opts` permite resolver sem diálogo (testes e automação).
 */
export async function importLibraryJson(text: string, label = 'Arquivo de biblioteca', opts: { resolutions?: Resolutions; resolveAll?: boolean } = {}): Promise<LibraryImportResult> {
  const parsed = JSON.parse(text) as { format?: string; items?: unknown };
  if (parsed.format !== 'recorte-studio-library' || !Array.isArray(parsed.items)) throw new Error('não é um arquivo de biblioteca do Recorte Studio');
  const [existing, packs] = await Promise.all([repo.listLibrary(), repo.listPacks()]);
  const res: LibraryImportResult = { created: 0, duplicates: 0, renamed: 0, notImported: 0, skipped: 0, cancelled: false };
  const now = Date.now();
  const items: PackItemData[] = [];
  const plain: LibraryRecord[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.items as Array<Partial<LibraryRecord>>) {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.kind || raw.data === undefined) { res.skipped++; continue; }
    const rec: LibraryRecord = { id: typeof raw.id === 'string' && raw.id ? raw.id : newItemId(), kind: raw.kind, name: raw.name.slice(0, 120), favorite: 0, createdAt: now, updatedAt: now, data: raw.data };
    const read = readLibraryRecord(rec);
    if (!read) { plain.push({ ...rec, id: newItemId() }); continue; } // cena, sequência ou item ilegível: entra como novo registro
    if (seen.has(read.id)) { res.skipped++; continue; } // o próprio arquivo repete o mesmo ID
    seen.add(read.id);
    items.push({ id: read.id, kind: read.kind, name: rec.name, data: read.data } as PackItemData);
  }
  const fake: ParsedPack = { manifest: { format: 'recorte-studio-pack', formatVersion: 1, id: 'arquivo-biblioteca', name: label, version: '', description: '', author: '', license: '—', category: 'Biblioteca', tags: [], dependencies: [], items: [], media: [] }, items, media: [], size: text.length };
  const analysis = analyzeImport(fake, { packs, library: existing, builtin: builtinIds(), incomingSource: 'imported' });
  let resolutions = opts.resolutions ?? {};
  let resolveAll = !!opts.resolveAll;
  if (analysis.conflicts.length && !opts.resolutions && !opts.resolveAll) {
    const answer = await askImportConflicts({ pack: fake, bytes: new Uint8Array(), sha256: '', source: 'imported', analysis, asSeparatePack: false });
    if (!answer) return { ...res, cancelled: true };
    resolutions = answer.resolutions;
    resolveAll = answer.resolveAll;
  }
  const plan = planImport(fake, analysis, resolutions, { resolveAll });
  if (!plan.ok) throw new Error(plan.errors.join(' '));
  res.duplicates = plan.duplicates.length;
  res.notImported = plan.skipped.length;
  res.renamed = Object.keys(plan.idMap).length;
  const out: LibraryRecord[] = [...plain];
  for (const it of plan.items) {
    // Pose e cena não têm ID interno: a identidade é o do registro. Os demais guardam a identidade dentro do dado.
    const recId = it.kind === 'pose' ? it.id : newItemId();
    out.push({ id: recId, kind: it.kind, name: it.name, favorite: 0, createdAt: now, updatedAt: now, data: it.data });
  }
  try {
    await db.transaction('rw', db.library, async () => { for (const r of out) await db.library.put(r); });
  } catch (e) {
    throw new Error(storageError(e, 'Não foi possível importar'));
  }
  res.created = out.length;
  await reloadLibrary();
  return res;
}

/** Tamanho aproximado do item salvo (dados + imagens). */
export function recordBytes(data: unknown, assetSizes = 0): number {
  try { return new Blob([JSON.stringify(data)]).size + assetSizes; } catch { return assetSizes; }
}

/**
 * Alterar o ID de um item da minha biblioteca: valida (1–40, A-Z a-z 0-9 -, livre no catálogo), pede confirmação,
 * atualiza as referências em outros itens da biblioteca e grava tudo de uma vez. Projetos .jrec não são tocados.
 */
export async function changeItemId(libId: string): Promise<boolean> {
  const [records, packs] = await Promise.all([repo.listLibrary(), repo.listPacks()]);
  const r = records.find((x) => x.id === libId);
  if (!r) return false;
  const raw = await promptDialog('Alterar ID', 'Novo ID (1 a 40 caracteres: letras sem acento, números e hífen)', identityOf(r));
  if (raw === null || raw === identityOf(r)) return false;
  const plan = planIdChange({ records, packs, builtin: builtinIds(), libId, newId: raw });
  if (!plan.ok) { toast(plan.message, 'error'); return false; }
  const ok = await confirmDialog({
    title: 'Alterar ID do item',
    message: `Mudar o ID de "${r.name}" de ${plan.oldId} para ${plan.newId}? ${plan.referencesUpdated ? `${plan.referencesUpdated} outro(s) item(ns) da biblioteca que usam este ID serão atualizados. ` : ''}Projetos já salvos guardam a própria cópia e continuam abrindo como estão.`,
    confirmLabel: 'Alterar ID',
  });
  if (ok !== true) return false;
  try {
    await db.transaction('rw', db.library, async () => {
      for (const id of plan.remove) await db.library.delete(id);
      for (const rec of plan.put) await db.library.put(rec);
    });
  } catch (e) {
    toast(storageError(e, 'Não foi possível alterar o ID'), 'error');
    return false;
  }
  await reloadLibrary();
  toast(`ID de "${r.name}" alterado para ${plan.newId}.`, 'success');
  return true;
}
