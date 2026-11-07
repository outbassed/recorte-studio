/** Comandos do editor compartilhados por painéis, atalhos e menus. */
import {
  actorInsertIndex, addAudioClip, addAudioTrack, addBuiltinToScene, addNode, deleteClip, deleteKeyframe, deleteNode, deleteScene, duplicateClip, duplicateNode, duplicateScene, findPropertyTrack, ensurePropertyTrack, setKeyframe, sceneOf,
} from '@/engine/model/ops';
import { createCharacterNode, createImageNode, createPropNode } from '@/engine/model/factory';
import { WORLD_HEIGHT, frameSize, type KeyValue, type Keyframe, type Project, type SceneNode } from '@/engine/model/schema';
import { FLOOR_Y, getBackground } from '@/engine/world/backgrounds';
import { getProp } from '@/engine/world/props';
import { AssetError, importAudioFile, importImageFile, registerAssetBlob } from '@/features/library/assets';
import { SvgRejectedError } from '@/features/library/sanitizeSvg';
import { repo } from '@/storage/db';
import { commit, currentProject, currentScene, redo, undo } from './projectStore';
import { seek, transport } from './transport';
import { clearSelection, confirmDialog, selectNodes, selectTimeline, toast, useUI } from './uiStore';
import { StorageQuotaError } from '@/storage/db';

export function doUndo(): void {
  const l = undo();
  if (l) toast(`Desfeito: ${l}`);
}
export function doRedo(): void {
  const l = redo();
  if (l) toast(`Refeito: ${l}`);
}

export function switchScene(sceneId: string): void {
  commit('Trocar cena', (d) => {
    d.currentSceneId = sceneId;
  }, { silent: true });
  clearSelection();
  seek(0);
}

export function addScene(kind: 'empty' | 'duplicate'): void {
  let id = '';
  if (kind === 'duplicate') {
    const cur = currentScene();
    commit('Duplicar cena', (d) => {
      id = duplicateScene(d as Project, cur.id);
    });
    toast('Cena duplicada.');
  } else {
    commit('Criar cena vazia', (d) => {
      const n = d.sceneOrder.length + 1;
      id = addEmpty(d as Project, n);
    });
    toast('Cena vazia criada.');
  }
  clearSelection();
  seek(0);
  return void id;
}

import { addEmptyScene } from '@/engine/model/ops';
const addEmpty = (p: Project, n: number) => addEmptyScene(p, `Cena ${n}`);

export async function requestDeleteScene(sceneId: string): Promise<void> {
  const p = currentProject();
  if (p.sceneOrder.length <= 1) {
    toast('O projeto precisa de pelo menos uma cena.', 'error');
    return;
  }
  const name = p.scenes[sceneId]?.name ?? '';
  const ok = await confirmDialog({ title: 'Excluir cena', message: `Excluir "${name}"? Os personagens da biblioteca são mantidos. Você pode desfazer com Ctrl+Z.`, confirmLabel: 'Excluir cena', danger: true });
  if (!ok) return;
  commit('Excluir cena', (d) => {
    deleteScene(d as Project, sceneId);
  });
  clearSelection();
  seek(0);
}

export function placeBuiltin(builtinId: string): void {
  const scene = currentScene();
  const count = Object.values(scene.nodes).filter((n) => n.kind === 'character').length;
  const spots = getBackground(scene.background.presetId).spots;
  const x = spots[count % spots.length] ?? 0;
  let id: string | null = null;
  commit('Adicionar personagem', (d) => {
    id = addBuiltinToScene(d as Project, sceneOf(d as Project, scene.id), builtinId, x);
  });
  if (id) selectNodes([id]);
}

export function placeCharacter(characterId: string): void {
  const scene = currentScene();
  const def = currentProject().characters[characterId];
  if (!def) return;
  const count = Object.values(scene.nodes).filter((n) => n.kind === 'character').length;
  const spots = getBackground(scene.background.presetId).spots;
  const node = createCharacterNode(characterId, def.name, { x: spots[count % spots.length] ?? 0, y: FLOOR_Y });
  commit('Adicionar personagem', (d) => {
    const sc = sceneOf(d as Project, scene.id);
    addNode(sc, node, actorInsertIndex(sc));
  });
  selectNodes([node.id]);
}

export function placeProp(propId: string): void {
  const scene = currentScene();
  const def = getProp(propId);
  const count = Object.values(scene.nodes).filter((n) => n.kind === 'prop').length;
  const node = createPropNode(propId, { x: ((count % 5) - 2) * 150, y: def?.wall ? -90 : def?.handheld ? 180 : FLOOR_Y - 20 });
  commit(`Adicionar ${def?.label ?? 'objeto'}`, (d) => {
    addNode(sceneOf(d as Project, scene.id), node);
  });
  selectNodes([node.id]);
}

export function addNodeToScene(node: SceneNode, label = 'Adicionar elemento'): void {
  const scene = currentScene();
  commit(label, (d) => {
    addNode(sceneOf(d as Project, scene.id), node);
  });
  selectNodes([node.id]);
}

export async function deleteSelection(): Promise<void> {
  const ui = useUI.getState();
  const scene = currentScene();
  if (ui.timeline) {
    const { trackId, keyId, clipId } = ui.timeline;
    commit(keyId ? 'Excluir keyframe' : 'Excluir clip', (d) => {
      const s = sceneOf(d as Project, scene.id);
      if (keyId) deleteKeyframe(s, trackId, keyId);
      else if (clipId) deleteClip(s, clipId);
    });
    useUI.setState({ timeline: null });
    return;
  }
  if (ui.nodeIds.length === 0) return;
  const names = ui.nodeIds.map((id) => scene.nodes[id]?.name).filter(Boolean).join(', ');
  const ok = await confirmDialog({ title: 'Excluir camada', message: `Excluir "${names}"? Trilhas e vínculos ligados a ela saem junto. Ctrl+Z restaura tudo.`, confirmLabel: 'Excluir', danger: true });
  if (!ok) return;
  const ids = [...ui.nodeIds];
  commit('Excluir camada', (d) => {
    const s = sceneOf(d as Project, scene.id);
    for (const id of ids) deleteNode(s, id);
  });
  clearSelection();
}

export function duplicateSelection(): void {
  const ui = useUI.getState();
  const scene = currentScene();
  if (ui.timeline?.clipId) {
    const clipId = ui.timeline.clipId;
    const trackId = ui.timeline.trackId;
    let nid: string | null = null;
    commit('Duplicar clip', (d) => {
      nid = duplicateClip(sceneOf(d as Project, scene.id), clipId);
    });
    if (nid) selectTimeline({ trackId, clipId: nid });
    return;
  }
  const out: string[] = [];
  commit('Duplicar camada', (d) => {
    const s = sceneOf(d as Project, scene.id);
    for (const id of ui.nodeIds) {
      const c = duplicateNode(s, id);
      if (c) out.push(c);
    }
  });
  if (out.length) selectNodes(out);
}

/* -------- área de transferência interna de keyframes -------- */
let keyClipboard: { path: string; value: KeyValue; interpolation: Keyframe['interpolation']; easing: Keyframe['easing'] } | null = null;

export function copySelectedKey(): boolean {
  const sel = useUI.getState().timeline;
  if (!sel?.keyId) return false;
  const track = currentScene().tracks.find((t) => t.id === sel.trackId);
  if (track?.type !== 'property') return false;
  const k = track.keyframes.find((x) => x.id === sel.keyId);
  if (!k) return false;
  keyClipboard = { path: track.propertyPath, value: k.value, interpolation: k.interpolation, easing: k.easing };
  toast('Keyframe copiado.');
  return true;
}

export function pasteKey(): boolean {
  if (!keyClipboard) return false;
  const clip = keyClipboard;
  const ui = useUI.getState();
  const scene = currentScene();
  const t = transport.getState().timeMs;
  let target: string | null = null;
  if (ui.timeline) {
    const tr = scene.tracks.find((x) => x.id === ui.timeline!.trackId);
    if (tr?.type === 'property' && tr.propertyPath === clip.path) target = tr.targetNodeId;
  }
  if (!target && ui.nodeIds[0]) target = ui.nodeIds[0];
  if (!target) return false;
  const tgt = target;
  commit('Colar keyframe', (d) => {
    const s = sceneOf(d as Project, scene.id);
    setKeyframe(ensurePropertyTrack(s, tgt, clip.path), t, clip.value, { interpolation: clip.interpolation, easing: clip.easing });
  });
  toast('Keyframe colado.');
  return true;
}

export const keyAtPlayhead = (target: string, path: string): Keyframe | undefined => {
  const track = findPropertyTrack(currentScene(), target, path);
  const t = Math.round(transport.getState().timeMs);
  return track?.keyframes.find((k) => k.timeMs === t);
};

/* -------- Mídia -------- */

function explainError(e: unknown): string {
  if (e instanceof AssetError || e instanceof SvgRejectedError || e instanceof StorageQuotaError) return e.message;
  return e instanceof Error ? e.message : 'Erro desconhecido.';
}

export async function importImage(file: File): Promise<void> {
  try {
    const { asset, report } = await importImageFile(file);
    const blob = await repo.getBlob(asset.id);
    if (blob) registerAssetBlob(asset.id, blob);
    commit('Importar imagem', (d) => {
      d.assets[asset.id] = asset;
    });
    const fs = frameSize(currentProject().settings);
    const k = Math.min(1, (WORLD_HEIGHT * 0.6) / (asset.height ?? 400), (fs.w * 0.6) / (asset.width ?? 400));
    addNodeToScene(createImageNode(asset.id, asset.name, (asset.width ?? 400) * k, (asset.height ?? 400) * k), 'Inserir imagem');
    toast(report[0] ?? `"${file.name}" importada. Fica salva neste navegador.`, report.length ? 'info' : 'success');
  } catch (e) {
    toast(`Não foi possível importar: ${explainError(e)}`, 'error');
  }
}

export async function importAudio(file: File, role: 'dialogue' | 'voice' | 'music' | 'sfx' = 'sfx'): Promise<void> {
  try {
    toast(`Decodificando "${file.name}"…`);
    const asset = await importAudioFile(file);
    const scene = currentScene();
    const start = Math.round(transport.getState().timeMs);
    commit('Importar áudio', (d) => {
      d.assets[asset.id] = asset;
      const s = sceneOf(d as Project, scene.id);
      const existing = s.tracks.find((t) => t.type === 'audio' && t.role === role);
      const track = existing ?? addAudioTrack(s, role);
      addAudioClip(s, track.id, asset.id, start, asset.durationMs ?? 1000);
    });
    toast(`Áudio adicionado à timeline (${((asset.durationMs ?? 0) / 1000).toLocaleString('pt-BR')} s).`, 'success');
  } catch (e) {
    toast(`Não foi possível importar: ${explainError(e)}`, 'error');
  }
}
