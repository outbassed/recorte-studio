/** Ações das roupas e cabelos criados (Fase 3b). Tudo via commit: desfazer/refazer valem. */
import { WearableSchema, type Project, type Wearable } from '@/engine/model/schema';
import { deepClone, uid } from '@/engine/model/ids';
import { newWearable, wearOn } from '@/engine/character/wear';
import { commit, currentProject, currentScene } from './projectStore';
import { closeDialog, confirmDialog, promptDialog, toast, useUI } from './uiStore';
import { upsertLibrary } from './creatorActions';

export const openWearCreator = (id: string) => useUI.setState({ dialog: 'wear-creator', wearCreatorId: id });

/** Cria uma roupa ou cabelo neste projeto (a partir de um ponto de partida) e abre o criador. */
export async function newWearableInProject(kind: Wearable['kind'], starterId?: string): Promise<string | null> {
  const name = await promptDialog(kind === 'hair' ? 'Novo cabelo' : 'Nova roupa', 'Nome', kind === 'hair' ? 'Meu cabelo' : 'Minha roupa');
  if (!name) return null;
  const w = newWearable(kind, name, starterId);
  commit(kind === 'hair' ? 'Criar cabelo' : 'Criar roupa', (d) => { d.wearables[w.id] = w; });
  openWearCreator(w.id);
  return w.id;
}

/** Atualiza a peça e todos os personagens do projeto que a vestem (a mudança aparece em todas as cenas). */
export function editWearable(id: string, label: string, fn: (w: Wearable) => void, coalesce?: string): void {
  commit(label, (d) => {
    const w = (d as Project).wearables[id];
    if (!w) return;
    fn(w);
    w.updatedAt = Date.now();
    const snapshot = deepClone(w);
    for (const c of Object.values((d as Project).characters)) {
      const i = c.wear.findIndex((x) => x.id === id);
      if (i >= 0) c.wear[i] = deepClone(snapshot);
    }
  }, coalesce ? { coalesce: `wear-${id}-${coalesce}` } : {});
}

/** Veste a peça num personagem do projeto (definição: vale em todas as cenas). */
export function applyWearable(characterId: string, wearId: string): boolean {
  const p = currentProject();
  const w = p.wearables[wearId];
  const c = p.characters[characterId];
  if (!w || !c) return false;
  commit(`Vestir ${w.name}`, (d) => { const ch = (d as Project).characters[characterId]; const ww = (d as Project).wearables[wearId]; if (ch && ww) wearOn(ch, ww); });
  toast(`${c.name} agora usa "${w.name}" em todas as cenas. Para tirar, use o Criador de Personagens → Roupas.`, 'success');
  return true;
}

export function removeWearable(characterId: string, wearId: string): void {
  commit('Tirar peça', (d) => { const ch = (d as Project).characters[characterId]; if (ch) ch.wear = ch.wear.filter((x) => x.id !== wearId); });
}

/** Personagem selecionado no palco (para aplicar a peça). */
export function selectedCharacterId(): string | null {
  const id = useUI.getState().nodeIds[0];
  const n = id ? currentScene().nodes[id] : undefined;
  return n?.kind === 'character' ? n.characterId : null;
}

/** Salva/atualiza na biblioteca (mesma identidade = mesmo registro). */
export async function saveWearableToLibrary(id: string): Promise<boolean> {
  const w = currentProject().wearables[id];
  if (!w) return false;
  try {
    const how = await upsertLibrary('wearable', w.id, w.name, deepClone(w), (d) => (d && typeof d === 'object' && typeof (d as { id?: unknown }).id === 'string' ? (d as { id: string }).id : undefined));
    toast(`"${w.name}" ${how === 'updated' ? 'atualizado na' : 'salvo na'} sua biblioteca, disponível em todos os projetos.`, 'success');
    return true;
  } catch (e) {
    toast(`Não foi possível salvar: ${e instanceof Error ? e.message : 'erro'}`, 'error');
    return false;
  }
}

/** Traz da biblioteca para o projeto mantendo a identidade (se já existe, usa a do projeto). */
export function bringWearable(data: unknown): string | null {
  const r = WearableSchema.safeParse(data);
  if (!r.success) { toast('Esta roupa/cabelo salva está ilegível ou é de uma versão incompatível.', 'error'); return null; }
  const w = r.data;
  if (!currentProject().wearables[w.id]) commit(`Trazer ${w.name}`, (d) => { d.wearables[w.id] = deepClone(w); });
  return w.id;
}

export function duplicateWearable(id: string): string | null {
  const w = currentProject().wearables[id];
  if (!w) return null;
  const copy = { ...deepClone(w), id: uid(w.kind === 'hair' ? 'hair' : 'roupa'), name: `${w.name} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
  commit('Duplicar peça', (d) => { d.wearables[copy.id] = copy; });
  return copy.id;
}

export async function deleteWearable(id: string): Promise<void> {
  const p = currentProject();
  const w = p.wearables[id];
  if (!w) return;
  const users = Object.values(p.characters).filter((c) => c.wear.some((x) => x.id === id));
  const ok = await confirmDialog({
    title: 'Excluir do projeto', confirmLabel: 'Excluir', danger: true,
    message: users.length ? `"${w.name}" está vestido por ${users.map((c) => c.name).join(', ')}. Excluir tira a peça desses personagens. Ctrl+Z desfaz.` : `Excluir "${w.name}" deste projeto? Ctrl+Z desfaz.`,
  });
  if (!ok) return;
  commit('Excluir peça', (d) => {
    delete (d as Project).wearables[id];
    for (const c of Object.values((d as Project).characters)) c.wear = c.wear.filter((x) => x.id !== id);
  });
  if (useUI.getState().wearCreatorId === id) closeDialog();
}
