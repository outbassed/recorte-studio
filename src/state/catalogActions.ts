/**
 * Ações do catálogo (Elenco, Cenários e Objetos). Toda mudança de projeto passa por `commit`
 * (um Ctrl+Z por ação); a biblioteca persistente fica no IndexedDB.
 *
 * Cópia ao editar: itens PADRÃO nunca mudam. "Editar" num item padrão cria uma cópia
 * editável com ID novo, guardada no projeto, e abre o criador nela.
 */
import { create } from 'zustand';
import { CharacterDefinitionSchema, CustomObjectSchema, type CharacterDefinition, type Project, type SceneNode } from '@/engine/model/schema';
import { deepClone, uid } from '@/engine/model/ids';
import { addScene as addSceneOp, applyBackground, applySequence, characterUsage, deleteCharacter, replaceSceneContent, sceneOf, type Sequence } from '@/engine/model/ops';
import { createScene } from '@/engine/model/factory';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { getBackground } from '@/engine/world/backgrounds';
import { getProp } from '@/engine/world/props';
import { createPiece } from '@/engine/world/pieces';
import { applyCustomBackground, availableTimes, createCustomBackground, customBackgroundUsage, deleteCustomBackground } from '@/engine/world/customBackgrounds';
import { buildBackgroundBundle, buildObjectBundle } from '@/features/library/bundles';
import { previewAssetUrl, registerAssetBlob } from '@/features/library/assets';
import { pushRecent, type CatalogEntry } from '@/features/catalog/catalog';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';
import { repo, type LibraryRecord } from '@/storage/db';
import { placeBuiltin, placeCharacter, placeProp } from './actions';
import {
  bringBackgroundFromLibrary, bringObjectFromLibrary, deleteCustomObject, insertCustomObject, libIdentity, openObjectCreator, openSceneCreator,
  builtinComposition, saveBackgroundToLibrary, saveObjectToLibrary, upsertLibrary,
} from './creatorActions';
import { commit, currentProject, currentScene } from './projectStore';
import { setPref, usePrefs } from './prefs';
import { seek, transport } from './transport';
import { confirmDialog, promptDialog, toast, useUI } from './uiStore';
import { usePacks } from './packActions';
import { applyWearable, bringWearable, deleteWearable, duplicateWearable, editWearable, openWearCreator, saveWearableToLibrary, selectedCharacterId } from './wearActions';

/** Veste a roupa/cabelo no personagem selecionado no palco. */
function wearOnSelected(wearId: string): boolean {
  const cid = selectedCharacterId();
  if (!cid) { toast('Selecione um personagem no palco para vestir a peça (ou use o Criador de Personagens → Roupas).', 'error'); return false; }
  return applyWearable(cid, wearId);
}

/* ------------------------------ biblioteca persistente (compartilhada pelos painéis) ------------------------------ */
interface LibraryState { records: LibraryRecord[]; loaded: boolean; error: string | null; blobs: number }
export const useLibrary = create<LibraryState>(() => ({ records: [], loaded: false, error: null, blobs: 0 }));

/** Registra as imagens dos pacotes da biblioteca para as miniaturas (só as que faltam). */
async function registerLibraryBlobs(records: LibraryRecord[]): Promise<void> {
  const ids = new Set<string>();
  for (const r of records) {
    const d = r.data as { assets?: unknown } | null;
    const list = Array.isArray(d?.assets) ? d.assets : d?.assets && typeof d.assets === 'object' ? Object.values(d.assets) : [];
    for (const a of list as Array<{ id?: unknown; kind?: unknown }>) if (typeof a?.id === 'string' && a.kind !== 'audio' && !previewAssetUrl(a.id)) ids.add(a.id);
  }
  let added = 0;
  for (const id of ids) {
    const blob = await repo.getBlob(id).catch(() => undefined);
    if (blob) { registerAssetBlob(id, blob); added++; }
  }
  if (added) useLibrary.setState((s) => ({ blobs: s.blobs + added }));
}

export async function reloadLibrary(): Promise<void> {
  try {
    const records = await repo.listLibrary();
    useLibrary.setState({ records, loaded: true, error: null });
    void registerLibraryBlobs(records);
  } catch (e) {
    useLibrary.setState({ loaded: true, error: e instanceof Error ? e.message : 'erro desconhecido' });
  }
}

/** Dados do item de pacote (pacote instalado e ativo). */
const packItemOf = (e: CatalogEntry) => {
  if (e.ref.type !== 'pack-item') return undefined;
  const { packId, itemId } = e.ref;
  return usePacks.getState().packs.find((p) => p.id === packId && p.enabled)?.items.find((i) => i.id === itemId);
};

const recordOf = (e: CatalogEntry): LibraryRecord | undefined =>
  e.ref.type === 'library' ? useLibrary.getState().records.find((r) => r.id === (e.ref as { libId: string }).libId) : undefined;

/* ------------------------------ favoritos e recentes ------------------------------ */
export function recordRecent(key: string): void {
  setPref('catalogRecents', pushRecent(usePrefs.getState().catalogRecents, key));
}

export async function toggleFavorite(e: CatalogEntry): Promise<void> {
  if (e.ref.type === 'project-character') {
    const id = e.ref.id;
    commit(e.favorite ? 'Tirar dos favoritos' : 'Favoritar', (d) => { const c = d.characters[id]; if (c) c.favorite = !c.favorite; });
    return;
  }
  if (e.ref.type === 'library') {
    const r = recordOf(e);
    if (r) { await repo.putLibrary({ ...r, favorite: r.favorite ? 0 : 1 }); await reloadLibrary(); }
    return;
  }
  const favs = new Set(usePrefs.getState().catalogFavorites);
  if (favs.has(e.key)) favs.delete(e.key);
  else favs.add(e.key);
  setPref('catalogFavorites', [...favs]);
}

/* ------------------------------ inserir ------------------------------ */
function selectedCharacter(): Extract<SceneNode, { kind: 'character' }> | null {
  const id = useUI.getState().nodeIds[0];
  const n = id ? currentScene().nodes[id] : undefined;
  return n?.kind === 'character' ? n : null;
}

/** Traz um personagem da biblioteca mantendo a identidade (se já estiver no projeto, usa o do projeto). */
function bringCharacter(def: CharacterDefinition): string {
  if (currentProject().characters[def.id]) return def.id;
  const copy: CharacterDefinition = { ...deepClone(def), builtinId: undefined };
  commit('Trazer personagem da biblioteca', (d) => { d.characters[copy.id] = copy; });
  return copy.id;
}

/** Coloca o item na cena atual (ou aplica, no caso de pose, sequência e cenário). Devolve false se nada mudou. */
export async function insertEntry(e: CatalogEntry, opts: { variant?: 'day' | 'night' } = {}): Promise<boolean> {
  if (e.broken) {
    toast(`Este item não pode ser usado: ${e.broken}`, 'error');
    return false;
  }
  const ref = e.ref;
  const scene = currentScene();
  let ok = true;
  switch (ref.type) {
    case 'builtin-character': placeBuiltin(ref.builtinId); break;
    case 'project-character': placeCharacter(ref.id); break;
    case 'builtin-prop': placeProp(ref.propId); break;
    case 'project-object': insertCustomObject(ref.id); break;
    case 'project-wearable': ok = wearOnSelected(ref.id); break;
    case 'pack-item': {
      // Usar item de pacote = trazer uma CÓPIA (com imagens) para o projeto; o pacote pode sumir depois.
      const it = packItemOf(e);
      if (!it) { toast('Este pacote está desativado ou foi removido.', 'error'); return false; }
      if (it.kind === 'object') {
        const id = await bringObjectFromLibrary(it.data, true);
        if (id) insertCustomObject(id);
        ok = !!id;
      } else {
        const id = await bringBackgroundFromLibrary(it.data, true);
        const cb = id ? currentProject().customBackgrounds[id] : undefined;
        if (cb && availableTimes(cb).length) commit('Usar cenário', (d) => { const c = d.customBackgrounds[cb.id]; if (c) applyCustomBackground(sceneOf(d as Project, scene.id), c); });
        ok = !!id;
      }
      break;
    }
    case 'builtin-object': {
      const tpl = animatedTemplate(ref.tplId);
      if (!tpl) return false;
      // Entra no projeto com identidade estável (uma vez); as próximas inserções reaproveitam.
      if (!currentProject().customObjects[tpl.id]) commit(`Trazer ${tpl.name}`, (d) => { d.customObjects[tpl.id] = deepClone(tpl); });
      insertCustomObject(tpl.id);
      break;
    }
    case 'builtin-background': {
      const variant = opts.variant ?? 'day';
      commit('Trocar cenário', (d) => applyBackground(sceneOf(d as Project, scene.id), ref.presetId, { variant }));
      toast(`Cenário: ${getBackground(ref.presetId).label}. Móveis viraram camadas editáveis.`);
      break;
    }
    case 'project-background': {
      const cb = currentProject().customBackgrounds[ref.id];
      if (!cb || !availableTimes(cb).length) {
        toast('Este cenário ainda não tem nenhum horário. Abra os detalhes e adicione uma imagem ou abra no Criador de Cenários.', 'error');
        return false;
      }
      commit('Usar cenário', (d) => { const c = d.customBackgrounds[ref.id]; if (c) applyCustomBackground(sceneOf(d as Project, scene.id), c); });
      break;
    }
    case 'library': {
      const r = recordOf(e);
      if (!r) return false;
      if (e.kind === 'character' && e.character) placeCharacter(bringCharacter(e.character));
      else if (e.kind === 'wearable') {
        if (!selectedCharacterId()) { toast('Selecione um personagem no palco para vestir a peça.', 'error'); return false; }
        const id = bringWearable(r.data);
        ok = !!id && wearOnSelected(id);
      } else if (e.kind === 'object') {
        const id = await bringObjectFromLibrary(r.data);
        if (id) insertCustomObject(id);
        ok = !!id;
      } else if (e.kind === 'background') {
        const id = await bringBackgroundFromLibrary(r.data, true);
        const cb = id ? currentProject().customBackgrounds[id] : undefined;
        if (cb && availableTimes(cb).length) {
          commit('Usar cenário', (d) => { const c = d.customBackgrounds[cb.id]; if (c) applyCustomBackground(sceneOf(d as Project, scene.id), c); });
          toast(`Cenário "${cb.name}" na cena.`, 'success');
        }
        ok = !!id;
      } else if (e.kind === 'pose' && e.pose) {
        const n = selectedCharacter();
        if (!n) { toast('Selecione um personagem no palco para aplicar a pose.', 'error'); return false; }
        const pose = e.pose;
        commit('Aplicar pose', (d) => {
          const m = sceneOf(d as Project, scene.id).nodes[n.id];
          if (m?.kind === 'character') { m.rig = deepClone(pose.rig); m.handL = pose.handL; m.handR = pose.handR; }
        });
        toast(`Pose "${e.name}" aplicada a ${n.name}.`, 'success');
      } else if (e.kind === 'sequence') {
        const n = selectedCharacter();
        if (!n) { toast('Selecione um personagem no palco para aplicar a sequência.', 'error'); return false; }
        let count = 0;
        commit('Aplicar sequência', (d) => { count = applySequence(sceneOf(d as Project, scene.id), n.id, r.data as Sequence, transport.getState().timeMs); });
        toast(`${count} passo(s) aplicados a ${n.name} a partir do tempo atual. Todos editáveis na timeline.`, 'success');
      } else if (e.kind === 'scene' && e.sceneData) {
        const data = e.sceneData;
        commit('Inserir cena da biblioteca', (d) => {
          for (const [id, c] of Object.entries(data.characters)) if (!d.characters[id]) d.characters[id] = deepClone(c);
          const s = createScene(data.scene.name);
          addSceneOp(d as Project, s, (d as Project).currentSceneId);
          replaceSceneContent(d as Project, s.id, data.scene);
        });
        seek(0);
        toast(`Cena "${e.name}" adicionada depois da cena atual.`, 'success');
      } else ok = false;
      break;
    }
  }
  if (ok) recordRecent(e.key);
  return ok;
}

/* ------------------------------ editar (com cópia para itens padrão) ------------------------------ */
/** Cria a cópia editável de um item padrão, guardada no projeto. Devolve o ID novo. */
export async function copyBuiltin(e: CatalogEntry, open = true): Promise<string | null> {
  const ref = e.ref;
  if (ref.type === 'builtin-character') {
    const src = BUILTIN_CHARACTERS.find((c) => c.builtinId === ref.builtinId);
    if (!src) return null;
    const copy: CharacterDefinition = { ...deepClone(src), id: uid('char'), name: `${src.name} (cópia)`, builtinId: undefined, favorite: false };
    commit('Criar cópia editável', (d) => { d.characters[copy.id] = copy; });
    if (open) useUI.setState({ dialog: 'creator', creatorCharacterId: copy.id });
    toast(`Cópia "${copy.name}" criada neste projeto. O personagem padrão continua igual.`, 'success');
    return copy.id;
  }
  if (ref.type === 'builtin-prop') {
    const def = getProp(ref.propId);
    if (!def) return null;
    const obj = CustomObjectSchema.parse({
      id: uid('obj'), name: `${def.label} (cópia)`, width: def.w, height: def.h, createdAt: Date.now(), updatedAt: Date.now(),
      pieces: [createPiece('prop', { name: def.label, refId: def.id, x: 0, y: 0, colorA: def.a, colorB: def.b, state: def.defaultState ?? '' })],
    });
    commit('Criar cópia editável', (d) => { d.customObjects[obj.id] = obj; });
    if (open) openObjectCreator(obj.id);
    toast(`Cópia "${obj.name}" criada em Meus objetos. O objeto padrão continua igual.`, 'success');
    return obj.id;
  }
  if (ref.type === 'pack-item') {
    // Item de pacote é protegido: editar gera uma cópia pessoal com ID novo; o pacote não muda.
    const it = packItemOf(e);
    if (!it) { toast('Este pacote está desativado ou foi removido.', 'error'); return null; }
    if (it.kind === 'object') {
      const srcId = await bringObjectFromLibrary(it.data, true);
      const src = srcId ? currentProject().customObjects[srcId] : undefined;
      if (!src) return null;
      const obj = { ...deepClone(src), id: uid('obj'), name: `${src.name} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
      commit('Criar cópia editável', (d) => { d.customObjects[obj.id] = obj; });
      if (open) openObjectCreator(obj.id);
      toast(`Cópia "${obj.name}" criada. O item do pacote continua igual.`, 'success');
      return obj.id;
    }
    const srcId = await bringBackgroundFromLibrary(it.data, true);
    const src = srcId ? currentProject().customBackgrounds[srcId] : undefined;
    if (!src) return null;
    const cb = { ...deepClone(src), id: uid('cbg'), name: `${src.name} (cópia)`, createdAt: Date.now() };
    commit('Criar cópia editável', (d) => { d.customBackgrounds[cb.id] = cb; });
    if (open) openSceneCreator(cb.id, availableTimes(cb)[0] ?? 'day');
    toast(`Cópia "${cb.name}" criada. O item do pacote continua igual.`, 'success');
    return cb.id;
  }
  if (ref.type === 'builtin-object') {
    const tpl = animatedTemplate(ref.tplId);
    if (!tpl) return null;
    const obj = { ...deepClone(tpl), id: uid('obj'), name: `${tpl.name} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
    commit('Criar cópia editável', (d) => { d.customObjects[obj.id] = obj; });
    if (open) openObjectCreator(obj.id);
    toast(`Cópia "${obj.name}" criada com as animações. O objeto padrão continua igual.`, 'success');
    return obj.id;
  }
  if (ref.type === 'builtin-background') {
    const def = getBackground(ref.presetId);
    let id = '';
    // Prepara Dia e Noite antes e grava tudo de uma vez: um único Ctrl+Z desfaz a cópia inteira.
    let day: Awaited<ReturnType<typeof builtinComposition>>;
    let night: Awaited<ReturnType<typeof builtinComposition>>;
    try {
      day = await builtinComposition(currentProject(), ref.presetId, 'day');
      night = await builtinComposition(currentProject(), ref.presetId, 'night');
    } catch (err) {
      toast(`Não foi possível copiar o cenário: ${err instanceof Error ? err.message : 'erro'}`, 'error');
      return null;
    }
    commit('Criar cópia editável', (d) => {
      const cb = createCustomBackground(d as Project, `${def.label} (cópia)`);
      id = cb.id;
      d.assets[day.asset.id] = day.asset;
      d.assets[night.asset.id] = night.asset;
      cb.compositions.day = day.comp;
      cb.compositions.night = night.comp;
    });
    if (open) openSceneCreator(id, 'day');
    toast(`Cópia "${def.label} (cópia)" criada com Dia e Noite. O cenário padrão continua igual.`, 'success');
    return id;
  }
  return null;
}

export async function editEntry(e: CatalogEntry): Promise<void> {
  if (e.broken) { toast(`Este item não pode ser editado: ${e.broken}`, 'error'); return; }
  const ref = e.ref;
  switch (ref.type) {
    case 'builtin-character': case 'builtin-prop': case 'builtin-background': case 'builtin-object': case 'pack-item': await copyBuiltin(e); return;
    case 'project-character': useUI.setState({ dialog: 'creator', creatorCharacterId: ref.id }); return;
    case 'project-object': openObjectCreator(ref.id); return;
    case 'project-wearable': openWearCreator(ref.id); return;
    case 'project-background': {
      const cb = currentProject().customBackgrounds[ref.id];
      openSceneCreator(ref.id, cb ? availableTimes(cb)[0] ?? 'day' : 'day');
      return;
    }
    case 'library': {
      const r = recordOf(e);
      if (!r) return;
      // Editar um item da biblioteca: ele entra no projeto com a MESMA identidade; depois,
      // "Salvar na biblioteca" atualiza este mesmo registro.
      if (e.kind === 'character' && e.character) useUI.setState({ dialog: 'creator', creatorCharacterId: bringCharacter(e.character) });
      else if (e.kind === 'object') { const id = await bringObjectFromLibrary(r.data, true); if (id) openObjectCreator(id); }
      else if (e.kind === 'wearable') { const id = bringWearable(r.data); if (id) openWearCreator(id); }
      else if (e.kind === 'background') {
        const id = await bringBackgroundFromLibrary(r.data, true);
        const cb = id ? currentProject().customBackgrounds[id] : undefined;
        if (cb) openSceneCreator(cb.id, availableTimes(cb)[0] ?? 'day');
      }
      return;
    }
  }
}

/** Pode abrir num criador? (poses, sequências e cenas-molde não têm criador próprio.) */
export const canEdit = (e: CatalogEntry) => !e.broken && ['character', 'prop', 'object', 'background', 'wearable'].includes(e.kind);

/* ------------------------------ duplicar, salvar, renomear, excluir, exportar ------------------------------ */
export async function duplicateEntry(e: CatalogEntry): Promise<void> {
  const ref = e.ref;
  const p = currentProject();
  if (ref.type === 'project-character') {
    const c = p.characters[ref.id];
    if (!c) return;
    const copy: CharacterDefinition = { ...deepClone(c), id: uid('char'), name: `${c.name} (cópia)`, builtinId: undefined };
    commit('Duplicar personagem', (d) => { d.characters[copy.id] = copy; });
  } else if (ref.type === 'project-object') {
    const o = p.customObjects[ref.id];
    if (!o) return;
    const copy = { ...deepClone(o), id: uid('obj'), name: `${o.name} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
    commit('Duplicar objeto', (d) => { d.customObjects[copy.id] = copy; });
  } else if (ref.type === 'project-wearable') {
    if (!duplicateWearable(ref.id)) return;
  } else if (ref.type === 'project-background') {
    const cb = p.customBackgrounds[ref.id];
    if (!cb) return;
    const copy = { ...deepClone(cb), id: uid('cbg'), name: `${cb.name} (cópia)`, createdAt: Date.now() };
    commit('Duplicar cenário', (d) => { d.customBackgrounds[copy.id] = copy; });
  } else if (ref.type === 'library') {
    const r = recordOf(e);
    if (!r) return;
    const data = deepClone(r.data) as Record<string, unknown>;
    // A cópia ganha identidade própria (senão seria tratada como o mesmo item).
    if (r.kind === 'character') data.id = uid('char');
    if (r.kind === 'object' && data.object) (data.object as Record<string, unknown>).id = uid('obj');
    if (r.kind === 'background' && data.background) (data.background as Record<string, unknown>).id = uid('cbg');
    if (r.kind === 'wearable') { data.id = uid('roupa'); data.name = `${r.name} (cópia)`; }
    const now = Date.now();
    await repo.putLibrary({ ...r, id: uid('lib'), name: `${r.name} (cópia)`, favorite: 0, createdAt: now, updatedAt: now, data });
    await reloadLibrary();
  } else {
    await copyBuiltin(e, false);
    return;
  }
  toast(`"${e.name} (cópia)" criado.`, 'success');
}

/** Salva/atualiza um item do projeto na biblioteca persistente (mesma identidade = mesmo registro). */
export async function saveEntryToLibrary(e: CatalogEntry): Promise<void> {
  const ref = e.ref;
  const p = currentProject();
  if (ref.type === 'project-character') {
    const c = p.characters[ref.id];
    if (!c) return;
    const how = await upsertLibrary('character', c.id, c.name, { ...deepClone(c), builtinId: undefined, favorite: false }, libIdentity.character);
    toast(`"${c.name}" ${how === 'updated' ? 'atualizado na' : 'salvo na'} sua biblioteca, disponível em todos os projetos.`, 'success');
  } else if (ref.type === 'project-object') await saveObjectToLibrary(ref.id);
  else if (ref.type === 'project-wearable') { if (!(await saveWearableToLibrary(ref.id))) return; }
  else if (ref.type === 'project-background') {
    const cb = p.customBackgrounds[ref.id];
    if (!cb || !availableTimes(cb).length) { toast('Adicione ao menos um horário antes de salvar o cenário.', 'error'); return; }
    await saveBackgroundToLibrary(ref.id);
  } else return;
  await reloadLibrary();
}

export async function renameEntry(e: CatalogEntry): Promise<void> {
  const name = (await promptDialog('Renomear', 'Nome', e.name))?.trim();
  if (!name || name === e.name) return;
  const ref = e.ref;
  if (ref.type === 'project-character') commit('Renomear personagem', (d) => { const c = d.characters[ref.id]; if (c) c.name = name; });
  else if (ref.type === 'project-object') commit('Renomear objeto', (d) => { const o = d.customObjects[ref.id]; if (o) { o.name = name; o.updatedAt = Date.now(); } });
  else if (ref.type === 'project-wearable') editWearable(ref.id, 'Renomear peça', (w) => { w.name = name; });
  else if (ref.type === 'project-background') commit('Renomear cenário', (d) => { const c = d.customBackgrounds[ref.id]; if (c) c.name = name; });
  else if (ref.type === 'library') {
    const r = recordOf(e);
    if (!r) return;
    const data = deepClone(r.data) as Record<string, unknown>;
    if (r.kind === 'character') data.name = name;
    if (r.kind === 'object' && data.object) (data.object as Record<string, unknown>).name = name;
    if (r.kind === 'background' && data.background) (data.background as Record<string, unknown>).name = name;
    if (r.kind === 'wearable') data.name = name;
    await repo.putLibrary({ ...r, name, data, updatedAt: Date.now() });
    await reloadLibrary();
  }
}

export async function deleteEntry(e: CatalogEntry): Promise<void> {
  const ref = e.ref;
  const p = currentProject();
  if (ref.type === 'library') {
    const ok = await confirmDialog({
      title: 'Apagar da minha biblioteca',
      message: `Apagar "${e.name}" da sua biblioteca? Os projetos que já o usam guardam a própria cópia e não mudam.`,
      confirmLabel: 'Apagar', danger: true,
    });
    if (!ok) return;
    await repo.deleteLibrary(ref.libId);
    await reloadLibrary();
    toast(`"${e.name}" apagado da biblioteca.`);
  } else if (ref.type === 'project-character') {
    const used = characterUsage(p, ref.id);
    if (used > 0) {
      toast(`"${e.name}" está em ${used} instância(s) nas cenas. Exclua as instâncias antes de remover o personagem do projeto.`, 'error');
      return;
    }
    const ok = await confirmDialog({ title: 'Remover personagem', message: `Remover "${e.name}" deste projeto? Ctrl+Z desfaz.`, confirmLabel: 'Remover', danger: true });
    if (ok) commit('Remover personagem', (d) => void deleteCharacter(d as Project, ref.id));
  } else if (ref.type === 'project-object') await deleteCustomObject(ref.id);
  else if (ref.type === 'project-wearable') await deleteWearable(ref.id);
  else if (ref.type === 'project-background') {
    const used = customBackgroundUsage(p, ref.id);
    const ok = await confirmDialog({ title: 'Excluir cenário', message: used ? `"${e.name}" é usado em ${used} cena(s); elas voltarão ao cenário neutro. Ctrl+Z desfaz.` : `Excluir "${e.name}"? Ctrl+Z desfaz.`, confirmLabel: 'Excluir', danger: true });
    if (ok) commit('Excluir cenário', (d) => void deleteCustomBackground(d as Project, ref.id));
  }
}

/** Arquivo no formato da biblioteca (o mesmo que "Importar" da Biblioteca aceita). */
export function libraryFileOf(e: CatalogEntry): { name: string; json: string } | null {
  const p = currentProject();
  const ref = e.ref;
  let item: LibraryRecord | undefined;
  const now = Date.now();
  if (ref.type === 'library') item = recordOf(e);
  else if (ref.type === 'project-character') {
    const c = p.characters[ref.id];
    if (c) item = { id: uid('lib'), kind: 'character', name: c.name, favorite: 0, createdAt: now, data: { ...deepClone(c), builtinId: undefined } };
  } else if (ref.type === 'project-object') {
    const b = buildObjectBundle(p, ref.id);
    if (b) item = { id: uid('lib'), kind: 'object', name: b.object.name, favorite: 0, createdAt: now, data: b };
  } else if (ref.type === 'project-wearable') {
    const w = p.wearables[ref.id];
    if (w) item = { id: uid('lib'), kind: 'wearable', name: w.name, favorite: 0, createdAt: now, data: deepClone(w) };
  } else if (ref.type === 'project-background') {
    const b = buildBackgroundBundle(p, ref.id);
    if (b) item = { id: uid('lib'), kind: 'background', name: b.background.name, favorite: 0, createdAt: now, data: b };
  }
  if (!item) return null;
  const safe = e.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'item';
  return { name: `${safe}.biblioteca.json`, json: JSON.stringify({ format: 'recorte-studio-library', version: 1, items: [item] }, null, 2) };
}

export function exportEntry(e: CatalogEntry): void {
  const f = libraryFileOf(e);
  if (!f) { toast('Este item não pode ser exportado.', 'error'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([f.json], { type: 'application/json' }));
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Arquivo "${f.name}" gerado. Importe em Biblioteca → Importar, em qualquer navegador.`);
}

/** Valida um personagem vindo de arquivo antes de entrar na biblioteca/projeto. */
export const parseCharacter = (raw: unknown) => CharacterDefinitionSchema.safeParse(raw);
