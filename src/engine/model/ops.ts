/**
 * Operações do documento. Funções PURAS sobre um rascunho do projeto (Immer Draft ou
 * objeto comum): sem UI, sem IO; é o que os testes exercitam e o que o histórico
 * captura em forma de patches.
 */
import { ACTIONS, getAction, sampleActionClip } from '../animation/actions';
import { sortKeys, evaluateKeys } from '../animation/interp';
import { VIEW_YAW } from '../character/views';
import { poseRig, getPose } from '../character/presets';
import { FLOOR_Y, getBackground } from '../world/backgrounds';
import { createCharacterNode, createGroupNode, createKeyframe, createPropNode, createScene, ensureBuiltinCharacter } from './factory';
import { deepClone, uid } from './ids';
import { getPath, setPath, type PropertyDef, clampToDef, getPropertyDef } from './properties';
import {
  ActionClipSchema, AudioClipSchema, CAMERA_TARGET, DialogueClipSchema, EffectClipSchema, SubtitleClipSchema, frameSize, type ActionClip, type AnyClip, type AudioTrack,
  type Background, type CharacterNode, type Keyframe, type KeyValue, type Project, type PropertyTrack, type RigKey, type Scene, type SceneNode, type Track, type ViewId,
} from './schema';

export const sceneOf = (p: Project, id: string): Scene => {
  const s = p.scenes[id];
  if (!s) throw new Error(`Cena inexistente: ${id}`);
  return s;
};

/* ------------------------------ Cenas ------------------------------ */

export function addScene(p: Project, scene: Scene, afterId?: string | null): string {
  p.scenes[scene.id] = scene;
  const idx = afterId ? p.sceneOrder.indexOf(afterId) : -1;
  if (idx >= 0) p.sceneOrder.splice(idx + 1, 0, scene.id);
  else p.sceneOrder.push(scene.id);
  p.currentSceneId = scene.id;
  return scene.id;
}

export function addEmptyScene(p: Project, name?: string): string {
  const n = p.sceneOrder.length + 1;
  const scene = createScene(name ?? `Cena ${n}`, 8000, 'neutro');
  return addScene(p, scene, p.currentSceneId);
}

/** Copia uma cena com IDs novos para nós, trilhas, keys e clips, religando vínculos. */
export function cloneScene(src: Scene): Scene {
  const copy: Scene = deepClone(src);
  copy.id = uid('cena');
  const map = new Map<string, string>();
  for (const id of Object.keys(src.nodes)) map.set(id, uid('node'));
  const clipMap = new Map<string, string>();
  const nodes: Scene['nodes'] = {};
  for (const [id, node] of Object.entries(copy.nodes)) {
    node.id = map.get(id)!;
    if (node.parentId) node.parentId = map.get(node.parentId) ?? null;
    if (node.kind === 'group') node.children = node.children.map((c) => map.get(c) ?? c);
    if (node.kind === 'character' && node.gaze.targetId) node.gaze.targetId = map.get(node.gaze.targetId) ?? null;
    if (node.kind === 'prop' && node.heldBy) {
      const [owner, side] = node.heldBy.split(':');
      node.heldBy = owner && map.get(owner) ? `${map.get(owner)}:${side}` : '';
    }
    nodes[node.id] = node;
  }
  copy.nodes = nodes;
  copy.layerOrder = copy.layerOrder.map((id) => map.get(id)!).filter(Boolean);
  if (copy.camera.followNodeId) copy.camera.followNodeId = map.get(copy.camera.followNodeId) ?? null;
  for (const track of copy.tracks) {
    track.id = uid('track');
    if (track.type === 'property') {
      if (track.targetNodeId !== CAMERA_TARGET) track.targetNodeId = map.get(track.targetNodeId) ?? track.targetNodeId;
      for (const k of track.keyframes) {
        k.id = uid('key');
        if (track.propertyPath === 'gaze.targetId' && typeof k.value === 'string') k.value = map.get(k.value) ?? k.value;
        if (track.propertyPath === 'heldBy' && typeof k.value === 'string' && k.value) {
          const [o, side] = k.value.split(':');
          k.value = o && map.get(o) ? `${map.get(o)}:${side}` : '';
        }
      }
    } else if (track.type === 'action' || track.type === 'dialogue') {
      track.targetNodeId = map.get(track.targetNodeId) ?? track.targetNodeId;
      for (const c of track.clips) {
        const nid = uid('clip');
        clipMap.set(c.id, nid);
        c.id = nid;
      }
    } else {
      for (const c of track.clips) {
        const nid = uid('clip');
        clipMap.set(c.id, nid);
        c.id = nid;
        if (c.kind === 'audio' && c.lipSyncNodeId) c.lipSyncNodeId = map.get(c.lipSyncNodeId) ?? null;
      }
    }
  }
  for (const track of copy.tracks) {
    if (track.type === 'dialogue') for (const c of track.clips) if (c.audioClipId) c.audioClipId = clipMap.get(c.audioClipId) ?? null;
  }
  return copy;
}

export function duplicateScene(p: Project, sceneId: string): string {
  const src = sceneOf(p, sceneId);
  const copy = cloneScene(src);
  copy.name = `${src.name} (cópia)`;
  return addScene(p, copy, sceneId);
}

export function deleteScene(p: Project, sceneId: string): boolean {
  if (p.sceneOrder.length <= 1 || !p.scenes[sceneId]) return false;
  const idx = p.sceneOrder.indexOf(sceneId);
  p.sceneOrder.splice(idx, 1);
  delete p.scenes[sceneId];
  if (p.currentSceneId === sceneId) p.currentSceneId = p.sceneOrder[Math.min(idx, p.sceneOrder.length - 1)] ?? null;
  return true;
}

export function moveScene(p: Project, sceneId: string, delta: number): boolean {
  const i = p.sceneOrder.indexOf(sceneId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= p.sceneOrder.length) return false;
  const [id] = p.sceneOrder.splice(i, 1);
  p.sceneOrder.splice(j, 0, id!);
  return true;
}

/** Mescla o conteúdo de outra cena (colar/importar) mantendo a cena de destino. */
export function pasteSceneContent(p: Project, targetId: string, source: Scene): void {
  const target = sceneOf(p, targetId);
  const copy = cloneScene(source);
  Object.assign(target.nodes, copy.nodes);
  target.layerOrder.push(...copy.layerOrder);
  target.tracks.push(...copy.tracks);
  target.durationMs = Math.max(target.durationMs, copy.durationMs);
}

export function replaceSceneContent(p: Project, targetId: string, source: Scene): void {
  const target = sceneOf(p, targetId);
  const copy = cloneScene(source);
  target.nodes = copy.nodes;
  target.layerOrder = copy.layerOrder;
  target.tracks = copy.tracks;
  target.background = copy.background;
  target.camera = copy.camera;
  target.durationMs = copy.durationMs;
}

/* ------------------------------ Camadas ------------------------------ */

/** Índice logo abaixo dos móveis de primeiro plano do cenário (mesas à frente etc.). */
export function actorInsertIndex(scene: Scene): number {
  let i = scene.layerOrder.length;
  while (i > 0 && scene.nodes[scene.layerOrder[i - 1]!]?.backgroundOwned && isForeground(scene, scene.layerOrder[i - 1]!)) i--;
  return i;
}

function isForeground(scene: Scene, id: string): boolean {
  const n = scene.nodes[id];
  if (n?.kind !== 'prop') return false;
  return getBackground(scene.background.presetId).furniture.some((f) => f.front && f.propId === n.propId);
}

export function addNode(scene: Scene, node: SceneNode, at?: 'top' | 'bottom' | number): string {
  scene.nodes[node.id] = node;
  if (at === 'bottom') scene.layerOrder.unshift(node.id);
  else if (typeof at === 'number') scene.layerOrder.splice(at, 0, node.id);
  else scene.layerOrder.push(node.id);
  return node.id;
}

export function moveLayer(scene: Scene, nodeId: string, how: 'up' | 'down' | 'top' | 'bottom'): boolean {
  const i = scene.layerOrder.indexOf(nodeId);
  if (i < 0) return false;
  const last = scene.layerOrder.length - 1;
  const j = how === 'up' ? i + 1 : how === 'down' ? i - 1 : how === 'top' ? last : 0;
  if (j < 0 || j > last || j === i) return false;
  scene.layerOrder.splice(i, 1);
  scene.layerOrder.splice(j, 0, nodeId);
  return true;
}

/** Remove o nó e limpa TODOS os vínculos que ficariam órfãos. */
export function deleteNode(scene: Scene, nodeId: string): boolean {
  const node = scene.nodes[nodeId];
  if (!node) return false;
  if (node.kind === 'group') for (const c of [...node.children]) deleteNode(scene, c);
  if (node.parentId) {
    const parent = scene.nodes[node.parentId];
    if (parent?.kind === 'group') parent.children = parent.children.filter((c) => c !== nodeId);
  }
  delete scene.nodes[nodeId];
  scene.layerOrder = scene.layerOrder.filter((id) => id !== nodeId);
  scene.tracks = scene.tracks.filter((t) => !((t.type === 'property' || t.type === 'action' || t.type === 'dialogue') && t.targetNodeId === nodeId));
  for (const n of Object.values(scene.nodes)) {
    if (n.kind === 'character' && n.gaze.targetId === nodeId) {
      n.gaze.targetId = null;
      n.gaze.mode = 'camera';
    }
    if (n.kind === 'prop' && n.heldBy.startsWith(`${nodeId}:`)) n.heldBy = '';
  }
  for (const t of scene.tracks) {
    if (t.type === 'property' && t.propertyPath === 'gaze.targetId') t.keyframes = t.keyframes.filter((k) => k.value !== nodeId);
    if (t.type === 'property' && t.propertyPath === 'heldBy') t.keyframes = t.keyframes.filter((k) => !(typeof k.value === 'string' && k.value.startsWith(`${nodeId}:`)));
    if (t.type === 'audio') for (const c of t.clips) if (c.lipSyncNodeId === nodeId) c.lipSyncNodeId = null;
  }
  if (scene.camera.followNodeId === nodeId) scene.camera.followNodeId = null;
  return true;
}

/** Duplica o nó com ID novo, trilhas próprias e transformação independente. */
export function duplicateNode(scene: Scene, nodeId: string): string | null {
  const src = scene.nodes[nodeId];
  if (!src) return null;
  const copy: SceneNode = deepClone(src);
  copy.id = uid('node');
  copy.name = `${src.name} (cópia)`;
  copy.transform.x += 60;
  copy.transform.y += 0;
  if (copy.kind === 'group') {
    copy.children = src.kind === 'group' ? src.children.map((c) => {
      const cid = duplicateChild(scene, c, copy.id);
      return cid ?? c;
    }) : [];
  }
  scene.nodes[copy.id] = copy;
  if (src.parentId) {
    const parent = scene.nodes[src.parentId];
    if (parent?.kind === 'group') parent.children.push(copy.id);
  } else {
    const i = scene.layerOrder.indexOf(nodeId);
    scene.layerOrder.splice(i + 1, 0, copy.id);
  }
  const newTracks: Track[] = [];
  for (const t of scene.tracks) {
    if ((t.type === 'property' || t.type === 'action' || t.type === 'dialogue') && t.targetNodeId === nodeId) {
      const c = deepClone(t) as Track;
      c.id = uid('track');
      (c as PropertyTrack).targetNodeId = copy.id;
      if (c.type === 'property') {
        for (const k of c.keyframes) {
          k.id = uid('key');
          if (c.propertyPath === 'transform.x' && typeof k.value === 'number') k.value += 60;
        }
      } else if (c.type === 'action' || c.type === 'dialogue') for (const cl of c.clips) cl.id = uid('clip');
      newTracks.push(c);
    }
  }
  scene.tracks.push(...newTracks);
  return copy.id;
}

function duplicateChild(scene: Scene, id: string, parentId: string): string | null {
  const src = scene.nodes[id];
  if (!src) return null;
  const copy: SceneNode = deepClone(src);
  copy.id = uid('node');
  copy.parentId = parentId;
  scene.nodes[copy.id] = copy;
  return copy.id;
}

export function groupNodes(scene: Scene, ids: string[], name = 'Grupo'): string | null {
  const members = scene.layerOrder.filter((id) => ids.includes(id));
  if (members.length < 2) return null;
  const group = createGroupNode(name, members);
  const top = Math.max(...members.map((m) => scene.layerOrder.indexOf(m)));
  const anchor = scene.layerOrder[top]!;
  scene.nodes[group.id] = group;
  const idx = scene.layerOrder.indexOf(anchor);
  scene.layerOrder.splice(idx + 1, 0, group.id);
  scene.layerOrder = scene.layerOrder.filter((id) => !members.includes(id));
  for (const m of members) scene.nodes[m]!.parentId = group.id;
  return group.id;
}

export function ungroup(scene: Scene, groupId: string): string[] {
  const group = scene.nodes[groupId];
  if (!group || group.kind !== 'group') return [];
  const idx = scene.layerOrder.indexOf(groupId);
  const kids = [...group.children];
  scene.layerOrder.splice(idx, 1, ...kids);
  for (const k of kids) {
    const child = scene.nodes[k];
    if (!child) continue;
    child.parentId = null;
    child.transform.x += group.transform.x;
    child.transform.y += group.transform.y;
    child.transform.scaleX *= group.transform.scaleX;
    child.transform.scaleY *= group.transform.scaleY;
    child.transform.rotationDeg += group.transform.rotationDeg;
  }
  delete scene.nodes[groupId];
  scene.tracks = scene.tracks.filter((t) => !((t.type === 'property' || t.type === 'action') && t.targetNodeId === groupId));
  return kids;
}

/* ------------------------------ Cenário ------------------------------ */

/** Troca o cenário e seus móveis. Itens do usuário nunca são removidos. */
export function applyBackground(scene: Scene, presetId: string, patch: Partial<Background> = {}, withFurniture = true): void {
  for (const n of Object.values(scene.nodes)) if (n.backgroundOwned) deleteNode(scene, n.id);
  scene.background.presetId = presetId;
  scene.background.primary = '';
  scene.background.secondary = '';
  scene.background.floor = '';
  Object.assign(scene.background, patch);
  if (!withFurniture) return;
  const def = getBackground(presetId);
  const back: string[] = [];
  const front: string[] = [];
  for (const f of def.furniture) {
    const node = createPropNode(f.propId, { x: f.x, y: f.y, scale: f.scale, colorA: f.colorA, colorB: f.colorB, state: f.state, backgroundOwned: true });
    scene.nodes[node.id] = node;
    (f.front ? front : back).push(node.id);
  }
  scene.layerOrder = [...back, ...scene.layerOrder, ...front];
}

/* ------------------------------ Trilhas e keyframes ------------------------------ */

export function findPropertyTrack(scene: Scene, target: string, path: string): PropertyTrack | undefined {
  return scene.tracks.find((t): t is PropertyTrack => t.type === 'property' && t.targetNodeId === target && t.propertyPath === path);
}

export function ensurePropertyTrack(scene: Scene, target: string, path: string): PropertyTrack {
  const found = findPropertyTrack(scene, target, path);
  if (found) return found;
  const def = target === CAMERA_TARGET ? getPropertyDef('camera', path) : getPropertyDef(scene.nodes[target]?.kind ?? 'character', path);
  const track: PropertyTrack = { id: uid('track'), name: def?.label ?? path, type: 'property', enabled: true, locked: false, muted: false, solo: false, targetNodeId: target, propertyPath: path, keyframes: [] };
  scene.tracks.push(track);
  return track;
}

/** Cria ou atualiza o key no tempo. Nunca há dois keys no mesmo instante. */
export function setKeyframe(track: PropertyTrack, timeMs: number, value: KeyValue, o: Partial<Pick<Keyframe, 'interpolation' | 'easing'>> = {}): Keyframe {
  const t = Math.max(0, Math.round(timeMs));
  const existing = track.keyframes.find((k) => k.timeMs === t);
  if (existing) {
    existing.value = value;
    if (o.interpolation) existing.interpolation = o.interpolation;
    if (o.easing) existing.easing = o.easing;
    return existing;
  }
  const k = createKeyframe(t, value, typeof value === 'number' ? o : { interpolation: 'hold', ...o });
  track.keyframes.push(k);
  track.keyframes = sortKeys(track.keyframes);
  return k;
}

export function moveKeyframe(track: PropertyTrack, keyId: string, timeMs: number): void {
  const k = track.keyframes.find((x) => x.id === keyId);
  if (!k) return;
  const t = Math.max(0, Math.round(timeMs));
  track.keyframes = track.keyframes.filter((x) => x.id === keyId || x.timeMs !== t);
  const again = track.keyframes.find((x) => x.id === keyId)!;
  again.timeMs = t;
  track.keyframes = sortKeys(track.keyframes);
}

export function deleteKeyframe(scene: Scene, trackId: string, keyId: string): void {
  const t = scene.tracks.find((x) => x.id === trackId);
  if (t?.type !== 'property') return;
  t.keyframes = t.keyframes.filter((k) => k.id !== keyId);
  if (t.keyframes.length === 0) scene.tracks = scene.tracks.filter((x) => x.id !== trackId);
}

/** Lê o valor efetivo de uma propriedade no tempo (keyframes têm prioridade). */
export function readProperty(scene: Scene, target: string, path: string, timeMs: number): unknown {
  const track = findPropertyTrack(scene, target, path);
  if (track && track.keyframes.length && track.enabled) return evaluateKeys(track.keyframes, timeMs);
  const owner = target === CAMERA_TARGET ? scene.camera : scene.nodes[target];
  return getPath(owner, path);
}

/**
 * Escreve a propriedade: se ela já é animada, grava um key no tempo atual; caso
 * contrário altera o valor-base. É o comportamento esperado de "auto-key".
 */
export function writeProperty(scene: Scene, target: string, path: string, value: KeyValue, timeMs: number, def?: Pick<PropertyDef, 'min' | 'max'>): void {
  const v = typeof value === 'number' && def ? clampToDef(def, value) : value;
  const track = findPropertyTrack(scene, target, path);
  if (track && track.keyframes.length) {
    setKeyframe(track, timeMs, v);
    return;
  }
  const owner = target === CAMERA_TARGET ? scene.camera : scene.nodes[target];
  if (owner) setPath(owner, path, v);
}

export function addKeyAtTime(scene: Scene, target: string, path: string, timeMs: number): Keyframe {
  const current = readProperty(scene, target, path, timeMs);
  const track = ensurePropertyTrack(scene, target, path);
  return setKeyframe(track, timeMs, (current ?? 0) as KeyValue);
}

export function getOrCreateActionTrack(scene: Scene, nodeId: string) {
  const f = scene.tracks.find((t) => t.type === 'action' && t.targetNodeId === nodeId);
  if (f && f.type === 'action') return f;
  const name = scene.nodes[nodeId]?.name ?? 'Ações';
  const track: Extract<Track, { type: 'action' }> = { id: uid('track'), name: `Ações · ${name}`, type: 'action', enabled: true, locked: false, muted: false, solo: false, targetNodeId: nodeId, clips: [] };
  scene.tracks.push(track);
  return track;
}

export function getOrCreateDialogueTrack(scene: Scene, nodeId: string) {
  const f = scene.tracks.find((t) => t.type === 'dialogue' && t.targetNodeId === nodeId);
  if (f && f.type === 'dialogue') return f;
  const name = scene.nodes[nodeId]?.name ?? 'Fala';
  const track: Extract<Track, { type: 'dialogue' }> = { id: uid('track'), name: `Fala · ${name}`, type: 'dialogue', enabled: true, locked: false, muted: false, solo: false, targetNodeId: nodeId, clips: [] };
  scene.tracks.push(track);
  return track;
}

export function addAudioTrack(scene: Scene, role: AudioTrack['role']): AudioTrack {
  const label = { dialogue: 'Diálogo', voice: 'Voz', music: 'Música', sfx: 'Efeitos sonoros' }[role];
  const track: AudioTrack = { id: uid('track'), name: label, type: 'audio', role, enabled: true, locked: false, muted: false, solo: false, clips: [] };
  scene.tracks.push(track);
  return track;
}

export function addDialogue(scene: Scene, nodeId: string, text: string, startMs: number, durationMs?: number, extra: Partial<{ showBubble: boolean; showSubtitle: boolean; bubbleStyle: string }> = {}) {
  const track = getOrCreateDialogueTrack(scene, nodeId);
  const dur = durationMs ?? Math.max(900, Math.min(6000, text.length * 62 + 400));
  const clip = DialogueClipSchema.parse({ id: uid('clip'), kind: 'dialogue', startMs: Math.round(startMs), durationMs: Math.round(dur), text, ...extra });
  track.clips.push(clip);
  track.clips.sort((a, b) => a.startMs - b.startMs);
  extendToFit(scene, startMs + dur);
  return clip;
}

export function addAudioClip(scene: Scene, trackId: string, assetId: string, startMs: number, durationMs: number, extra: Partial<AnyClip> = {}) {
  const track = scene.tracks.find((t) => t.id === trackId);
  if (track?.type !== 'audio') return null;
  const clip = AudioClipSchema.parse({ id: uid('clip'), kind: 'audio', assetId, startMs: Math.round(startMs), durationMs: Math.round(durationMs), ...extra });
  track.clips.push(clip);
  extendToFit(scene, startMs + durationMs);
  return clip;
}

export function addSubtitle(scene: Scene, text: string, startMs: number, durationMs: number) {
  let track = scene.tracks.find((t) => t.type === 'subtitle');
  if (!track) {
    track = { id: uid('track'), name: 'Legendas', type: 'subtitle', enabled: true, locked: false, muted: false, solo: false, clips: [] };
    scene.tracks.push(track);
  }
  const clip = SubtitleClipSchema.parse({ id: uid('clip'), kind: 'subtitle', text, startMs: Math.round(startMs), durationMs: Math.round(durationMs) });
  if (track.type === 'subtitle') track.clips.push(clip);
  extendToFit(scene, startMs + durationMs);
  return clip;
}

export function addEffect(scene: Scene, effect: 'shake' | 'flash' | 'fadeBlack' | 'fadeFromBlack' | 'vignette' | 'tint', startMs: number, durationMs: number) {
  let track = scene.tracks.find((t) => t.type === 'effect');
  if (!track) {
    track = { id: uid('track'), name: 'Efeitos', type: 'effect', enabled: true, locked: false, muted: false, solo: false, clips: [] };
    scene.tracks.push(track);
  }
  const clip = EffectClipSchema.parse({ id: uid('clip'), kind: 'effect', effect, startMs: Math.round(startMs), durationMs: Math.round(durationMs) });
  if (track.type === 'effect') track.clips.push(clip);
  return clip;
}

export function extendToFit(scene: Scene, endMs: number): void {
  if (endMs > scene.durationMs) scene.durationMs = Math.ceil(endMs / 100) * 100;
}

export function findClip(scene: Scene, clipId: string): { track: Track; clip: AnyClip } | null {
  for (const track of scene.tracks) {
    if (track.type === 'property') continue;
    const clip = (track.clips as AnyClip[]).find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

export function deleteClip(scene: Scene, clipId: string): void {
  for (const track of scene.tracks) {
    if (track.type === 'property') continue;
    const list = track.clips as AnyClip[];
    const i = list.findIndex((c) => c.id === clipId);
    if (i >= 0) {
      list.splice(i, 1);
      if (track.type === 'audio') {
        for (const t of scene.tracks) if (t.type === 'dialogue') for (const c of t.clips) if (c.audioClipId === clipId) c.audioClipId = null;
      }
      return;
    }
  }
}

export function duplicateClip(scene: Scene, clipId: string): string | null {
  const f = findClip(scene, clipId);
  if (!f || f.track.type === 'property') return null;
  const copy = deepClone(f.clip);
  copy.id = uid('clip');
  copy.startMs = f.clip.startMs + f.clip.durationMs;
  (f.track.clips as AnyClip[]).push(copy);
  extendToFit(scene, copy.startMs + copy.durationMs);
  return copy.id;
}

export function deleteTrack(scene: Scene, trackId: string): void {
  scene.tracks = scene.tracks.filter((t) => t.id !== trackId);
}

/** Corta um clip no tempo dado, gerando dois clips independentes. */
export function splitClip(scene: Scene, clipId: string, atMs: number): string | null {
  const f = findClip(scene, clipId);
  if (!f || f.track.type === 'property') return null;
  const { clip } = f;
  const local = Math.round(atMs - clip.startMs);
  if (local <= 10 || local >= clip.durationMs - 10) return null;
  const second = deepClone(clip);
  second.id = uid('clip');
  second.startMs = clip.startMs + local;
  second.durationMs = clip.durationMs - local;
  clip.durationMs = local;
  if (second.kind === 'audio' && clip.kind === 'audio') second.offsetMs = clip.offsetMs + local;
  (f.track.clips as AnyClip[]).push(second);
  return second.id;
}

/* ------------------------------ Ações compostas ------------------------------ */

export interface ActionParams {
  durationMs?: number;
  intensity?: number;
  speed?: number;
  targetX?: number;
  targetNodeId?: string | null;
  side?: 'auto' | 'L' | 'R';
  view?: ViewId;
  fromRight?: boolean;
  easing?: ActionClip['easing'];
  text?: string;
  zoom?: number;
}

/** Biblioteca de ações compostas apresentada ao usuário. */
export const ACTION_PRESETS: Array<{ id: string; label: string; icon: string; keywords: string[]; needs?: 'door' | 'prop' | 'camera' | 'target' }> = [
  { id: 'walk', label: 'Andar até', icon: 'footprints', keywords: ['andar', 'anda', 'caminhar'] },
  { id: 'run', label: 'Correr até', icon: 'zap', keywords: ['correr', 'corre'] },
  { id: 'stop', label: 'Parar', icon: 'pause', keywords: ['parar', 'para'] },
  { id: 'enter', label: 'Entrar na cena', icon: 'log-in', keywords: ['entrar', 'entra', 'chegar', 'chega'] },
  { id: 'exit', label: 'Sair da cena', icon: 'log-out', keywords: ['sair', 'sai', 'ir embora'] },
  { id: 'talk', label: 'Falar', icon: 'message', keywords: ['falar', 'fala', 'dizer', 'diz'] },
  { id: 'turn', label: 'Virar', icon: 'rotate', keywords: ['virar', 'vira'] },
  { id: 'look', label: 'Olhar para', icon: 'eye', keywords: ['olhar', 'olha'], needs: 'target' },
  { id: 'lookAway', label: 'Desviar o olhar', icon: 'eye-off', keywords: ['desviar'] },
  { id: 'blink', label: 'Piscar', icon: 'eye', keywords: ['piscar', 'pisca'] },
  { id: 'openDoor', label: 'Abrir porta', icon: 'door-open', keywords: ['abrir porta'], needs: 'door' },
  { id: 'closeDoor', label: 'Fechar porta', icon: 'door-closed', keywords: ['fechar porta'], needs: 'door' },
  { id: 'cameraZoom', label: 'Câmera aproximar', icon: 'zoom-in', keywords: ['aproximar', 'zoom'], needs: 'camera' },
  { id: 'cameraPan', label: 'Câmera deslocar', icon: 'move', keywords: ['deslocar', 'panoramica'], needs: 'camera' },
  ...ACTIONS.filter((a) => !['walk', 'run'].includes(a.id)).map((a) => ({ id: a.id, label: a.label, icon: 'sparkles', keywords: a.keywords })),
];

function addActionClip(scene: Scene, nodeId: string, action: string, startMs: number, durationMs: number, p: ActionParams): ActionClip {
  const track = getOrCreateActionTrack(scene, nodeId);
  const def = getAction(action);
  const clip = ActionClipSchema.parse({
    id: uid('clip'), kind: 'action', action, label: def?.label ?? action, startMs: Math.round(startMs), durationMs: Math.round(durationMs),
    intensity: p.intensity ?? 1, speed: p.speed ?? 1, side: p.side ?? 'auto', easing: p.easing ?? 'easeInOut',
  });
  track.clips.push(clip);
  track.clips.sort((a, b) => a.startMs - b.startMs);
  extendToFit(scene, startMs + durationMs);
  return clip;
}

function travel(scene: Scene, nodeId: string, action: 'walk' | 'run', startMs: number, fromX: number, toX: number, p: ActionParams, durOverride?: number): number {
  const speedPx = action === 'run' ? 640 : 300;
  const dur = durOverride ?? p.durationMs ?? Math.max(500, (Math.abs(toX - fromX) / speedPx) * 1000);
  const track = ensurePropertyTrack(scene, nodeId, 'transform.x');
  setKeyframe(track, startMs, fromX, { interpolation: 'linear' });
  setKeyframe(track, startMs + dur, toX, { interpolation: 'linear' });
  addActionClip(scene, nodeId, action, startMs, dur, p);
  return dur;
}

/** Insere uma ação como clips + keyframes editáveis. Retorna a duração usada. */
export function insertAction(p: Project, scene: Scene, nodeId: string, action: string, startMs: number, params: ActionParams = {}): number {
  const node = scene.nodes[nodeId];
  const t = Math.max(0, Math.round(startMs));
  const fw = frameSize(p.settings).w;
  if (action === 'cameraZoom') {
    const dur = params.durationMs ?? 2500;
    const track = ensurePropertyTrack(scene, CAMERA_TARGET, 'zoom');
    setKeyframe(track, t, readProperty(scene, CAMERA_TARGET, 'zoom', t) as number);
    setKeyframe(track, t + dur, params.zoom ?? 1.35);
    extendToFit(scene, t + dur);
    return dur;
  }
  if (action === 'cameraPan') {
    const dur = params.durationMs ?? 2500;
    const track = ensurePropertyTrack(scene, CAMERA_TARGET, 'x');
    setKeyframe(track, t, readProperty(scene, CAMERA_TARGET, 'x', t) as number);
    setKeyframe(track, t + dur, params.targetX ?? (node ? node.transform.x : 200));
    extendToFit(scene, t + dur);
    return dur;
  }
  if (!node) return 0;
  const currentX = readProperty(scene, nodeId, 'transform.x', t) as number;
  switch (action) {
    case 'walk':
    case 'run':
      return travel(scene, nodeId, action, t, currentX, params.targetX ?? currentX + 300, params);
    case 'enter': {
      const fromRight = params.fromRight ?? currentX > 0;
      const from = (fromRight ? 1 : -1) * (fw / 2 + 220);
      return travel(scene, nodeId, 'walk', t, from, params.targetX ?? currentX, params);
    }
    case 'exit': {
      const toRight = params.fromRight ?? currentX > 0;
      return travel(scene, nodeId, 'walk', t, currentX, (toRight ? 1 : -1) * (fw / 2 + 220), params);
    }
    case 'stop': {
      const track = scene.tracks.find((tr) => tr.type === 'action' && tr.targetNodeId === nodeId);
      if (track?.type === 'action') {
        for (const c of track.clips) {
          if ((c.action === 'walk' || c.action === 'run') && t > c.startMs && t < c.startMs + c.durationMs) c.durationMs = t - c.startMs;
        }
      }
      const x = ensurePropertyTrack(scene, nodeId, 'transform.x');
      const value = currentX;
      x.keyframes = x.keyframes.filter((k) => k.timeMs <= t);
      setKeyframe(x, t, value, { interpolation: 'hold' });
      return 0;
    }
    case 'talk': {
      const clip = addDialogue(scene, nodeId, params.text ?? 'Olá!', t, params.durationMs);
      return clip.durationMs;
    }
    case 'turn': {
      const view = params.view ?? 'back';
      setKeyframe(ensurePropertyTrack(scene, nodeId, 'bodyView'), t, view);
      setKeyframe(ensurePropertyTrack(scene, nodeId, 'headView'), t, view);
      return 300;
    }
    case 'look': {
      setKeyframe(ensurePropertyTrack(scene, nodeId, 'gaze.mode'), t, 'node');
      if (params.targetNodeId) setKeyframe(ensurePropertyTrack(scene, nodeId, 'gaze.targetId'), t, params.targetNodeId);
      return 300;
    }
    case 'lookAway': {
      setKeyframe(ensurePropertyTrack(scene, nodeId, 'gaze.mode'), t, 'manual');
      const gx = ensurePropertyTrack(scene, nodeId, 'gaze.x');
      setKeyframe(gx, t, node.transform.x > 0 ? 200 : -200);
      const dur = params.durationMs ?? 1000;
      setKeyframe(ensurePropertyTrack(scene, nodeId, 'gaze.mode'), t + dur, 'camera');
      return dur;
    }
    case 'blink': {
      const track = ensurePropertyTrack(scene, nodeId, 'blinkMode');
      setKeyframe(track, t, 'closed');
      setKeyframe(track, t + 150, 'auto');
      return 150;
    }
    case 'openDoor':
    case 'closeDoor': {
      const door = Object.values(scene.nodes).find((n) => n.kind === 'prop' && n.propId === 'door');
      const value = action === 'openDoor' ? 'open' : 'closed';
      if (door) setKeyframe(ensurePropertyTrack(scene, door.id, 'state'), t, value);
      if (node.kind === 'character') addActionClip(scene, nodeId, 'point', t, 500, params);
      return 500;
    }
    default: {
      const def = getAction(action);
      if (!def) return 0;
      const dur = params.durationMs ?? def.duration;
      addActionClip(scene, nodeId, action, t, dur, params);
      return dur;
    }
  }
}

/** Converte um clip procedural em keyframes editáveis e remove o clip. */
export function bakeActionClip(scene: Scene, clipId: string, stepMs = 100): number {
  const f = findClip(scene, clipId);
  if (!f || f.clip.kind !== 'action' || f.track.type !== 'action') return 0;
  const clip = f.clip;
  const nodeId = f.track.targetNodeId;
  const node = scene.nodes[nodeId];
  if (!node || node.kind !== 'character') return 0;
  const end = clip.startMs + clip.durationMs;
  const yaw = VIEW_YAW[node.bodyView === 'auto' ? 'front' : node.bodyView];
  const side: 'L' | 'R' = Math.cos((yaw * Math.PI) / 180) >= 0 ? 'L' : 'R';
  const samples: Array<{ t: number; rig: Partial<Record<RigKey, number>> }> = [];
  const keys = new Set<RigKey>();
  for (let t = clip.startMs; t <= end; t += stepMs) {
    const s = sampleActionClip(clip, Math.min(t, end - 1), side);
    const rig: Partial<Record<RigKey, number>> = {};
    if (s) {
      for (const k of Object.keys(s.rig) as RigKey[]) {
        rig[k] = (s.rig[k] ?? 0) * s.weight;
        keys.add(k);
      }
    }
    samples.push({ t, rig });
  }
  let count = 0;
  for (const k of keys) {
    const track = ensurePropertyTrack(scene, nodeId, `rig.${k}`);
    const base = node.rig[k];
    for (const s of samples) {
      setKeyframe(track, s.t, base + (s.rig[k] ?? 0), { interpolation: 'linear' });
      count++;
    }
    setKeyframe(track, end + 1, base, { interpolation: 'linear' });
  }
  deleteClip(scene, clipId);
  return count;
}

export function applyPose(node: CharacterNode, poseId: string): void {
  const pose = getPose(poseId);
  if (!pose) return;
  node.poseId = poseId;
  node.rig = poseRig(poseId);
  node.handL = pose.handL ?? 'open';
  node.handR = pose.handR ?? 'open';
}

/* ------------------------------ Biblioteca do projeto ------------------------------ */

export function characterUsage(p: Project, characterId: string): number {
  let count = 0;
  for (const s of Object.values(p.scenes)) for (const n of Object.values(s.nodes)) if (n.kind === 'character' && n.characterId === characterId) count++;
  return count;
}

/** Não permite remover um personagem em uso: as cenas nunca ficam corrompidas. */
export function deleteCharacter(p: Project, characterId: string): boolean {
  if (characterUsage(p, characterId) > 0) return false;
  delete p.characters[characterId];
  return true;
}

export function assetUsage(p: Project, assetId: string): number {
  let count = 0;
  for (const s of Object.values(p.scenes)) {
    for (const n of Object.values(s.nodes)) if (n.kind === 'image' && n.assetId === assetId) count++;
    for (const t of s.tracks) if (t.type === 'audio') count += t.clips.filter((c) => c.assetId === assetId).length;
  }
  for (const c of Object.values(p.characters)) if (c.spriteAssetId === assetId) count++;
  return count;
}

export function deleteAsset(p: Project, assetId: string): boolean {
  if (assetUsage(p, assetId) > 0) return false;
  delete p.assets[assetId];
  return true;
}

/* ------------------------------ Conveniências para cenas ------------------------------ */

/** Insere um personagem embutido, respeitando a posição e sem tocar em outras cenas. */
export function addBuiltinToScene(p: Project, scene: Scene, builtinId: string, x: number, o: { y?: number; scale?: number } = {}): string | null {
  const def = ensureBuiltinCharacter(p, builtinId);
  if (!def) return null;
  const node = createCharacterNode(def.id, def.name, { x, y: o.y ?? FLOOR_Y, scale: o.scale });
  return addNode(scene, node, actorInsertIndex(scene));
}

/** Faz dois personagens se olharem, com a cabeça acompanhando. */
export function faceEachOther(scene: Scene, aId: string, bId: string): void {
  const a = scene.nodes[aId];
  const b = scene.nodes[bId];
  if (a?.kind === 'character' && b?.kind === 'character') {
    a.gaze.mode = 'node';
    a.gaze.targetId = bId;
    a.gaze.followHead = true;
    b.gaze.mode = 'node';
    b.gaze.targetId = aId;
    b.gaze.followHead = true;
  }
}

export function totalDurationMs(p: Project): number {
  return p.sceneOrder.reduce((sum, id) => sum + (p.scenes[id]?.durationMs ?? 0), 0);
}

export function countSceneActions(scene: Scene): number {
  let c = 0;
  for (const t of scene.tracks) c += t.type === 'property' ? t.keyframes.length : t.clips.length;
  return c;
}
