/**
 * Ações da Biblioteca principal (tela inicial ou sobreposição no editor). Funcionam SEM projeto
 * aberto: gravam direto na biblioteca persistente (mesmo armazenamento das abas do Studio).
 * Criar e editar precisam de um criador, que vive dentro de um projeto: sem projeto aberto, usam a
 * "Oficina da Biblioteca", um projeto real reaproveitado; com projeto aberto, usam o projeto atual.
 */
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { createProject, newCharacterDefinition } from '@/engine/model/factory';
import { deepClone, uid } from '@/engine/model/ids';
import { CustomObjectSchema, type CharacterDefinition } from '@/engine/model/schema';
import { getProp } from '@/engine/world/props';
import { createPiece } from '@/engine/world/pieces';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';
import type { CatalogEntry } from '@/features/catalog/catalog';
import { createAndOpen, openProjectById } from '@/features/projects/session';
import { repo, StorageQuotaError, type LibraryKind, type LibraryRecord } from '@/storage/db';
import { editEntry, reloadLibrary, useLibrary } from './catalogActions';
import { libIdentity, newCustomObject, newScenery } from './creatorActions';
import { usePacks } from './packActions';
import { newWearableInProject } from './wearActions';
import { setPref, usePrefs } from './prefs';
import { commit, useProjectStore } from './projectStore';
import { closeOverlay, confirmDialog, promptDialog, toast, useUI } from './uiStore';

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

export async function createInLibrary(kind: 'object' | 'background' | 'character' | 'clothing' | 'hair'): Promise<void> {
  await ensureWorkshop();
  if (kind === 'clothing' || kind === 'hair') { if (!(await newWearableInProject(kind, kind === 'hair' ? 'hair-short' : 'tshirt'))) return; }
  else if (kind === 'object') await newCustomObject();
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
    if (src) { const d: CharacterDefinition = { ...deepClone(src), id: uid('char'), name: `${src.name} (cópia)`, builtinId: undefined, favorite: false }; rec = { id: uid('lib'), kind: 'character', name: d.name, favorite: 0, createdAt: now, updatedAt: now, data: d }; }
  } else if (ref.type === 'builtin-prop') {
    const def = getProp(ref.propId);
    if (def) {
      const obj = CustomObjectSchema.parse({ id: uid('obj'), name: `${def.label} (cópia)`, width: def.w, height: def.h, createdAt: now, updatedAt: now, pieces: [createPiece('prop', { name: def.label, refId: def.id, colorA: def.a, colorB: def.b, state: def.defaultState ?? '' })] });
      rec = { id: uid('lib'), kind: 'object', name: obj.name, favorite: 0, createdAt: now, updatedAt: now, data: { bundle: 2, object: obj, objects: [], assets: [] } };
    }
  } else if (ref.type === 'builtin-object') {
    const t = animatedTemplate(ref.tplId);
    if (t) { const obj = { ...deepClone(t), id: uid('obj'), name: `${t.name} (cópia)`, createdAt: now, updatedAt: now }; rec = { id: uid('lib'), kind: 'object', name: obj.name, favorite: 0, createdAt: now, updatedAt: now, data: { bundle: 2, object: obj, objects: [], assets: [] } }; }
  } else if (ref.type === 'pack-item') {
    const it = usePacks.getState().packs.find((p) => p.id === ref.packId)?.items.find((i) => i.id === ref.itemId);
    if (it?.kind === 'object') { const data = deepClone(it.data); data.object = { ...data.object, id: uid('obj'), name: `${it.name} (cópia)` }; rec = { id: uid('lib'), kind: 'object', name: data.object.name, favorite: 0, createdAt: now, updatedAt: now, data }; }
    if (it?.kind === 'background') { const data = deepClone(it.data); data.background = { ...data.background, id: uid('cbg'), name: `${it.name} (cópia)` }; rec = { id: uid('lib'), kind: 'background', name: data.background.name, favorite: 0, createdAt: now, updatedAt: now, data }; }
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
  if (r.kind === 'wearable') (data as Record<string, unknown>).name = name;
  if (await safePut({ ...r, name, data, updatedAt: Date.now() }, 'Não foi possível renomear')) await reloadLibrary();
}

export async function duplicateRecord(libId: string): Promise<void> {
  const r = recordOf(libId);
  if (!r) return;
  const data = deepClone(r.data) as Record<string, unknown>;
  if (r.kind === 'character') data.id = uid('char');
  if (r.kind === 'object' && data.object) (data.object as Record<string, unknown>).id = uid('obj');
  if (r.kind === 'background' && data.background) (data.background as Record<string, unknown>).id = uid('cbg');
  if (r.kind === 'wearable') { data.id = uid('roupa'); data.name = `${r.name} (cópia)`; }
  const now = Date.now();
  if (await safePut({ ...r, id: uid('lib'), name: `${r.name} (cópia)`, favorite: 0, createdAt: now, updatedAt: now, data }, 'Não foi possível duplicar')) {
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

const IDENTITY: Partial<Record<LibraryKind, (d: unknown) => string | undefined>> = { object: libIdentity.object, background: libIdentity.background, character: libIdentity.character, wearable: (d) => (d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'string' ? (d as { id: string }).id : undefined) };

/**
 * Importa um arquivo de biblioteca (.json). Item com a mesma identidade de um já salvo ATUALIZA o
 * registro existente em vez de duplicar. Devolve quantos foram criados e atualizados.
 */
export async function importLibraryJson(text: string): Promise<{ created: number; updated: number; skipped: number }> {
  const parsed = JSON.parse(text) as { format?: string; items?: unknown };
  if (parsed.format !== 'recorte-studio-library' || !Array.isArray(parsed.items)) throw new Error('não é um arquivo de biblioteca do Recorte Studio');
  const existing = await repo.listLibrary();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const raw of parsed.items as Array<Partial<LibraryRecord>>) {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.kind || raw.data === undefined) { skipped++; continue; }
    const idOf = IDENTITY[raw.kind];
    const ident = idOf?.(raw.data);
    const same = ident ? existing.find((r) => r.kind === raw.kind && idOf!(r.data) === ident) : undefined;
    const now = Date.now();
    await repo.putLibrary({ id: same?.id ?? uid('lib'), kind: raw.kind, name: raw.name.slice(0, 120), favorite: same?.favorite ?? 0, createdAt: same?.createdAt ?? now, updatedAt: now, data: raw.data });
    if (same) updated++;
    else created++;
  }
  await reloadLibrary();
  return { created, updated, skipped };
}

/** Tamanho aproximado do item salvo (dados + imagens). */
export function recordBytes(data: unknown, assetSizes = 0): number {
  try { return new Blob([JSON.stringify(data)]).size + assetSizes; } catch { return assetSizes; }
}
