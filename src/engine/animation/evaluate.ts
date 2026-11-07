/**
 * Avaliador de cena: estado imutável = f(projeto, cena, tempo). Não guarda nada entre
 * chamadas, então seek, reprodução e exportação sempre obtêm o mesmo resultado.
 */
import {
  CAMERA_TARGET,
  type ActionClip, type Camera, type CharacterDefinition, type CharacterNode, type DialogueClip, type EffectClip, type Project,
  type PropertyTrack, type Rig, type RigKey, type Scene, type SceneNode, type SubtitleClip, type ViewId,
} from '../model/schema';
import { setPath } from '../model/properties';
import { evaluateKeys } from './interp';
import { getAction, HOLD_AFTER, sampleActionClip } from './actions';
import { amplitudeAt, amplitudeToViseme, autoBlink, visemeAt } from './lipsync';
import { resolveGaze, type GazeResult } from '../gaze/gaze';
import { bodyMetrics, type CharacterPose } from '../character/render';
import { VIEW_YAW } from '../character/views';
import { BUILTIN_CHARACTERS } from '../character/presets';

export interface ResolvedCharacter {
  pose: CharacterPose;
  def: CharacterDefinition;
  gaze: GazeResult;
  speaking: boolean;
  /** cabeça no mundo */
  headX: number;
  headY: number;
}

export interface ActiveBubble {
  clip: DialogueClip;
  nodeId: string;
  /** progresso 0–1 */
  progress: number;
}

export interface ResolvedScene {
  camera: Camera & { shakeX: number; shakeY: number };
  nodes: Record<string, SceneNode>;
  characters: Record<string, ResolvedCharacter>;
  bubbles: ActiveBubble[];
  subtitles: Array<{ clip: SubtitleClip; progress: number }>;
  dialogueSubtitles: Array<{ text: string; progress: number }>;
  effects: Array<{ clip: EffectClip; progress: number }>;
}

const FALLBACK_DEF = BUILTIN_CHARACTERS[0]!;

/** Aplica sobrescritas da instância sobre a definição, sem alterar a biblioteca. */
export function applyOverrides(def: CharacterDefinition, node: CharacterNode): CharacterDefinition {
  const o = node.appearanceOverrides;
  if (!o || Object.keys(o).length === 0) return def;
  return {
    ...def,
    skin: o.skin ?? def.skin,
    hair: { ...def.hair, color: o.hairColor ?? def.hair.color, style: o.hairStyle ?? def.hair.style },
    outfit: { ...def.outfit, topColor: o.topColor ?? def.outfit.topColor, bottomColor: o.bottomColor ?? def.outfit.bottomColor, top: o.top ?? def.outfit.top, bottom: o.bottom ?? def.outfit.bottom },
  };
}

function cloneNode(n: SceneNode): SceneNode {
  const c: SceneNode = { ...n, transform: { ...n.transform } } as SceneNode;
  if (c.kind === 'character') {
    const src = n as CharacterNode;
    c.rig = { ...src.rig };
    c.gaze = { ...src.gaze };
  }
  return c;
}

export function trackActive(track: { enabled: boolean }): boolean {
  return track.enabled;
}

function pickSide(cos: number, yaw: number, dir: number): 'L' | 'R' {
  if (Math.abs(cos) < 0.1) return yaw > 0 ? 'R' : 'L';
  if (cos > 0) return dir >= 0 ? 'L' : 'R';
  return dir >= 0 ? 'R' : 'L';
}

function motionViewFor(tracks: PropertyTrack[], clips: ActionClip[], tMs: number, baseX: number): ViewId | null {
  const moving = clips.find((c) => (c.action === 'walk' || c.action === 'run') && tMs >= c.startMs && tMs < c.startMs + c.durationMs);
  if (!moving) return null;
  const xTrack = tracks.find((t) => t.propertyPath === 'transform.x');
  if (!xTrack || xTrack.keyframes.length < 2) return null;
  const a = evaluateKeys(xTrack.keyframes, tMs - 40);
  const b = evaluateKeys(xTrack.keyframes, tMs + 40);
  const dx = (typeof b === 'number' ? b : baseX) - (typeof a === 'number' ? a : baseX);
  if (Math.abs(dx) < 0.01) return null;
  return dx > 0 ? 'right' : 'left';
}

export function evaluateScene(project: Project, scene: Scene, timeMs: number): ResolvedScene {
  const t = Math.max(0, timeMs);
  const nodes: Record<string, SceneNode> = {};
  for (const id of Object.keys(scene.nodes)) nodes[id] = cloneNode(scene.nodes[id]!);
  const camera = { ...scene.camera, shakeX: 0, shakeY: 0 };

  const propTracksByNode = new Map<string, PropertyTrack[]>();
  const actionClipsByNode = new Map<string, ActionClip[]>();
  const dialogueByNode = new Map<string, DialogueClip[]>();
  const bubbles: ActiveBubble[] = [];
  const subtitles: ResolvedScene['subtitles'] = [];
  const effects: ResolvedScene['effects'] = [];
  const dialogueSubtitles: ResolvedScene['dialogueSubtitles'] = [];
  const amplitude = new Map<string, number>();

  for (const track of scene.tracks) {
    if (!track.enabled) continue;
    switch (track.type) {
      case 'property': {
        const value = evaluateKeys(track.keyframes, t);
        if (value === undefined) break;
        if (track.targetNodeId === CAMERA_TARGET) setPath(camera, track.propertyPath, value);
        else if (nodes[track.targetNodeId]) {
          setPath(nodes[track.targetNodeId], track.propertyPath, value);
          const list = propTracksByNode.get(track.targetNodeId) ?? [];
          list.push(track);
          propTracksByNode.set(track.targetNodeId, list);
        }
        break;
      }
      case 'action': {
        const list = actionClipsByNode.get(track.targetNodeId) ?? [];
        list.push(...track.clips);
        actionClipsByNode.set(track.targetNodeId, list);
        break;
      }
      case 'dialogue': {
        const list = dialogueByNode.get(track.targetNodeId) ?? [];
        list.push(...track.clips);
        dialogueByNode.set(track.targetNodeId, list);
        break;
      }
      case 'audio': {
        for (const clip of track.clips) {
          if (!clip.lipSyncNodeId || t < clip.startMs || t >= clip.startMs + clip.durationMs || track.muted) continue;
          const peaks = project.assets[clip.assetId]?.peaks;
          const a = amplitudeAt(peaks, t - clip.startMs + clip.offsetMs, clip.sensitivity);
          amplitude.set(clip.lipSyncNodeId, Math.max(amplitude.get(clip.lipSyncNodeId) ?? 0, a));
        }
        break;
      }
      case 'subtitle':
        for (const clip of track.clips) {
          if (t >= clip.startMs && t < clip.startMs + clip.durationMs) subtitles.push({ clip, progress: (t - clip.startMs) / clip.durationMs });
        }
        break;
      case 'effect':
        for (const clip of track.clips) {
          if (t >= clip.startMs && t < clip.startMs + clip.durationMs) effects.push({ clip, progress: (t - clip.startMs) / clip.durationMs });
        }
        break;
    }
  }

  // Tremor de câmera é função do tempo (nunca Math.random).
  for (const { clip, progress } of effects) {
    if (clip.effect === 'shake') {
      const decay = 1 - progress;
      camera.shakeX += Math.sin(t * 0.083) * 26 * clip.intensity * decay;
      camera.shakeY += Math.cos(t * 0.117) * 18 * clip.intensity * decay;
    }
  }

  // Primeira passada: posição da cabeça de cada personagem, para resolver olhares.
  const headPos = new Map<string, { x: number; y: number; def: CharacterDefinition }>();
  for (const id of Object.keys(nodes)) {
    const n = nodes[id]!;
    if (n.kind !== 'character') continue;
    const base = project.characters[n.characterId] ?? FALLBACK_DEF;
    const def = applyOverrides(base, n);
    const m = bodyMetrics(def);
    const scaleY = n.transform.scaleY;
    headPos.set(id, { x: n.transform.x, y: n.transform.y + (m.headCenterY - n.rig.bodyY) * scaleY, def });
  }

  const targetOf = (n: CharacterNode): { x: number; y: number } | null => {
    if (n.gaze.mode === 'point') return { x: n.gaze.x, y: n.gaze.y };
    if (n.gaze.mode !== 'node' || !n.gaze.targetId) return null;
    const tgt = nodes[n.gaze.targetId];
    if (!tgt || tgt.id === n.id) return null;
    const hp = headPos.get(tgt.id);
    return hp ? { x: hp.x, y: hp.y } : { x: tgt.transform.x, y: tgt.transform.y - 100 * tgt.transform.scaleY };
  };

  const characters: Record<string, ResolvedCharacter> = {};
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (!n || n.kind !== 'character') continue;
    const hp = headPos.get(id)!;
    const clips = actionClipsByNode.get(id) ?? [];
    const target = targetOf(n);
    const motionView = motionViewFor(propTracksByNode.get(id) ?? [], clips, t, n.transform.x);
    const gaze = resolveGaze({ gaze: n.gaze, headX: hp.x, headY: hp.y, target, headView: n.headView, bodyView: n.bodyView, motionView });

    // Rig final = base + soma das ações ativas (ponderada pela blenda).
    const rig: Rig = { ...n.rig };
    let expression = n.expression;
    let handL = n.handL;
    let handR = n.handR;
    const yaw = VIEW_YAW[gaze.bodyView];
    const side = pickSide(Math.cos((yaw * Math.PI) / 180), yaw, gaze.dx || (yaw > 0 ? 1 : yaw < 0 ? -1 : 1));
    let exprWeight = 0;
    let sitHold = 0;
    for (const clip of [...clips].sort((a, b) => a.startMs - b.startMs)) {
      const hold = HOLD_AFTER[clip.action];
      if (hold && t >= clip.startMs + clip.durationMs) sitHold = (hold.sit ?? 0) * clip.intensity;
      if (clip.action === 'standUp' && t >= clip.startMs) sitHold = 0;
      const s = sampleActionClip(clip, t, side);
      if (!s) continue;
      for (const key of Object.keys(s.rig) as RigKey[]) rig[key] += (s.rig[key] ?? 0) * s.weight;
      if (s.expression && s.weight >= exprWeight && s.weight > 0.25) {
        expression = s.expression;
        exprWeight = s.weight;
      }
      if (s.weight > 0.3) {
        if (s.handL) handL = s.handL;
        if (s.handR) handR = s.handR;
      }
    }
    rig.sit = Math.min(1, rig.sit + sitHold);

    // Boca: uma única fonte de visema por vez. Prioridade: manual > fala > áudio > expressão.
    let viseme: string | null = null;
    let visemeAmount = 0;
    let speaking = false;
    const dialogues = dialogueByNode.get(id) ?? [];
    for (const clip of dialogues) {
      if (t < clip.startMs || t >= clip.startMs + clip.durationMs) continue;
      const local = t - clip.startMs;
      speaking = true;
      if (clip.showBubble && clip.text) bubbles.push({ clip, nodeId: id, progress: local / clip.durationMs });
      if (clip.showSubtitle && clip.text) dialogueSubtitles.push({ text: clip.text, progress: local / clip.durationMs });
      if (clip.lipSync === 'text') {
        viseme = visemeAt(clip.text, local, clip.durationMs);
        visemeAmount = 1;
      } else if (clip.lipSync === 'amplitude') {
        const r = amplitudeToViseme((amplitude.get(id) ?? 0) * clip.sensitivity);
        viseme = r.viseme;
        visemeAmount = Math.min(1, r.amount);
      }
    }
    if (!viseme && amplitude.has(id)) {
      const r = amplitudeToViseme(amplitude.get(id) ?? 0);
      viseme = r.viseme;
      visemeAmount = Math.min(1, r.amount);
      speaking = true;
    }
    if (n.mouthShape && n.mouthShape !== 'auto') {
      viseme = n.mouthShape;
      visemeAmount = 1;
    }

    const blink = n.blinkMode === 'closed' ? 1 : n.blinkMode === 'open' ? 0 : autoBlink(id, t);
    characters[id] = {
      def: hp.def,
      gaze,
      speaking,
      headX: hp.x,
      headY: hp.y,
      pose: {
        bodyView: gaze.bodyView,
        headView: gaze.headView,
        rig,
        handL,
        handR,
        face: {
          expression,
          intensity: exprWeight > 0 ? Math.max(n.expressionIntensity, 1) : n.expressionIntensity,
          viseme,
          visemeAmount,
          blink,
          gazeX: gaze.gazeX,
          gazeY: gaze.gazeY,
        },
      },
    };
  }

  // Seguir personagem: média no tempo (determinística, não acumula estado).
  if (camera.followNodeId && camera.followStrength > 0 && nodes[camera.followNodeId]) {
    const follow = camera.followNodeId;
    const samples = 7;
    const window = Math.max(0, camera.followSmoothMs);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < samples; i++) {
      const st = t - (window * i) / (samples - 1);
      sum += sampleNodeX(scene, follow, Math.max(0, st));
      count++;
    }
    const avg = sum / count;
    camera.x += (avg - camera.x) * Math.min(1, camera.followStrength);
  }

  return { camera, nodes, characters, bubbles, subtitles, dialogueSubtitles, effects };
}

function sampleNodeX(scene: Scene, nodeId: string, t: number): number {
  const track = scene.tracks.find((tr): tr is PropertyTrack => tr.type === 'property' && tr.targetNodeId === nodeId && tr.propertyPath === 'transform.x' && tr.enabled);
  const v = track ? evaluateKeys(track.keyframes, t) : undefined;
  return typeof v === 'number' ? v : (scene.nodes[nodeId]?.transform.x ?? 0);
}

export { getAction };
