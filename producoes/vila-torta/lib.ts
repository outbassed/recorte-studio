/**
 * Mini-DSL de produção: cada "tomada" é uma Cena nativa do Recorte Studio, com nós, trilhas
 * de keyframes, clips de ação e de fala. Tudo é gravado pelas MESMAS operações do editor
 * (ops.ts / factory.ts), então o resultado continua 100% editável na interface.
 */
import { bodyMetrics } from '@/engine/character/render';
import { getPose, poseRig } from '@/engine/character/presets';
import { createCharacterNode, createGroupNode, createProject, createPropNode, createScene, createShapeNode, createTextNode } from '@/engine/model/factory';
import {
  addAudioClip, addAudioTrack, addDialogue, addEffect, addNode, applyBackground, ensurePropertyTrack, extendToFit, insertAction, readProperty, setKeyframe,
} from '@/engine/model/ops';
import {
  CAMERA_TARGET, ProjectSchema, type Background, type CharacterDefinition, type CustomObject, type Easing, type KeyValue, type Project, type Rig, type RigKey, type Scene, type ViewOrAuto,
} from '@/engine/model/schema';
import { OBJECT_PREFIX } from '@/engine/world/pieces';
import { createHash } from 'node:crypto';
import { computePeaks, PEAK_WINDOW_MS } from '@/engine/animation/lipsync';
import type { Asset } from '@/engine/model/schema';

export type Ease = Easing | 'hold';
export type KF = [number, KeyValue, Ease?];

export interface BgSpec { preset: string; variant?: Background['variant']; tone?: Background['tone']; tod?: Background['timeOfDay']; parallax?: number }

export interface DubRow { seq: string; shot: string; sceneId: string; who: string; text: string; localStartMs: number; durMs: number; style: string }

const FLOOR = 420;
const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Divide no fim de frase (ou vírgula) mais próximo do meio. */
export function splitSpeech(text: string): string[] {
  const mid = text.length / 2;
  const cut = (re: RegExp) => {
    let best = -1;
    for (const m of text.matchAll(re)) { const i = (m.index ?? 0) + m[0].length; if (i > 22 && text.length - i > 18 && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i; }
    return best;
  };
  const i = cut(/[.!?…]\s+/g) >= 0 ? cut(/[.!?…]\s+/g) : cut(/,\s+/g);
  return i < 0 ? [text] : [text.slice(0, i).trim(), text.slice(i).trim()];
}
export const speechMs = (text: string) => clampN(text.length * 60 + 520, 1250, 7600);

export class Builder {
  project: Project;
  scenes: Scene[] = [];
  names: Record<string, string> = {};
  chars: Record<string, CharacterDefinition> = {};
  objects: Record<string, CustomObject> = {};
  bgs: Record<string, BgSpec> = {};
  dub: DubRow[] = [];
  seq = '';
  blobs = new Map<string, Blob>();
  audio: Record<string, { id: string; durMs: number }> = {};
  private beds: Array<{ asset: string; from: number; to: number; vol: number; role: 'music' | 'ambient' | 'sfx'; endInLastMs?: number; fadeInMs?: number; fadeOutMs?: number; skipFirstMs?: number }> = [];
  private counter = 0;

  /** Registra um áudio original (WAV 16-bit mono) como mídia do projeto. */
  addAudio(key: string, wav: Uint8Array, samples: Float32Array, sr: number, name: string, category: Asset['category']) {
    const hash = createHash('sha256').update(wav).digest('hex');
    const id = `media_${hash.slice(0, 40)}`;
    const durMs = Math.round((samples.length / sr) * 1000);
    this.project.assets[id] = { id, kind: 'audio', name, mime: 'audio/wav', size: wav.length, durationMs: durMs, peaks: computePeaks([samples], sr), createdAt: 1, category, hash } as Asset;
    this.blobs.set(id, new Blob([wav as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }));
    this.audio[key] = { id, durMs };
    void PEAK_WINDOW_MS;
  }

  /** Cama sonora contínua (música/ambiente) sobre as tomadas de índice `from`..`to` (1-based); repete o arquivo em laço. */
  bed(asset: string, from: number, to: number, o: { vol?: number; role?: 'music' | 'ambient'; endInLastMs?: number; fadeInMs?: number; fadeOutMs?: number; skipFirstMs?: number } = {}) {
    this.beds.push({ asset, from: from - 1, to: to - 1, vol: o.vol ?? 0.6, role: o.role ?? 'ambient', endInLastMs: o.endInLastMs, fadeInMs: o.fadeInMs, fadeOutMs: o.fadeOutMs, skipFirstMs: o.skipFirstMs });
  }

  private applyBeds() {
    for (const b of this.beds) {
      const a = this.audio[b.asset]!;
      let loopPos = b.skipFirstMs ?? 0;
      for (let i = b.from; i <= b.to; i++) {
        const sc = this.scenes[i]!;
        const track = addAudioTrack(sc, b.role);
        const end = i === b.to && b.endInLastMs !== undefined ? b.endInLastMs : sc.durationMs;
        let t = 0;
        while (t < end) {
          const left = a.durMs - (loopPos % a.durMs);
          const d = Math.min(left, end - t);
          addAudioClip(sc, track.id, a.id, t, d, { offsetMs: loopPos % a.durMs, volume: b.vol, fadeInMs: i === b.from && t === 0 ? (b.fadeInMs ?? 0) : 0, fadeOutMs: i === b.to && t + d >= end ? (b.fadeOutMs ?? 0) : 0 });
          t += d; loopPos += d;
        }
      }
    }
    this.beds = [];
    // nenhum áudio passa do fim da cena (sem vazar para a tomada seguinte)
    for (const sc of this.scenes) for (const t of sc.tracks) if (t.type === 'audio') t.clips = t.clips.filter((c) => c.startMs < sc.durationMs).map((c) => ({ ...c, durationMs: Math.max(1, Math.min(c.durationMs, sc.durationMs - c.startMs)) }));
  }

  constructor(title: string) {
    this.project = createProject(title, { width: 1920, height: 1080, aspect: '16:9', fps: 30 });
    // O projeto nasce com uma cena de exemplo: removemos, as tomadas entram depois.
    this.project.scenes = {};
    this.project.sceneOrder = [];
    this.project.currentSceneId = null;
  }

  addCharacter(key: string, def: CharacterDefinition) {
    this.chars[key] = def;
    this.project.characters[def.id] = def;
    this.names[key] = def.name;
  }

  /** Nova tomada (cena). */
  shot(name: string, bg: BgSpec | string, durMs: number, fn: (s: Shot) => void): Scene {
    const spec = typeof bg === 'string' ? this.bgs[bg] ?? { preset: bg } : bg;
    this.counter++;
    const label = `${String(this.counter).padStart(3, '0')} · ${name}`;
    const scene = createScene(label, Math.max(800, durMs), spec.preset);
    scene.background = { ...scene.background, presetId: spec.preset, variant: spec.variant ?? 'day', tone: spec.tone ?? 'normal', timeOfDay: spec.tod };
    if (spec.parallax !== undefined) scene.background.parallax = spec.parallax;
    scene.notes = `Sequência: ${this.seq}`;
    const s = new Shot(this, scene, name);
    fn(s);
    s.finish();
    const falas = this.dub.filter((d) => d.sceneId === scene.id);
    if (falas.length) {
      const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
      scene.notes += `\n\nFalas (prontas para dublagem individual):\n${falas.map((d) => `• ${d.who} [${mmss(d.localStartMs)}, ${(d.durMs / 1000).toFixed(1)} s]: ${d.text}`).join('\n')}`;
    }
    this.project.scenes[scene.id] = scene;
    this.project.sceneOrder.push(scene.id);
    this.scenes.push(scene);
    return scene;
  }

  finish(): Project {
    this.applyBeds();
    this.project.currentSceneId = this.project.sceneOrder[0] ?? null;
    this.project.updatedAt = Date.now();
    return ProjectSchema.parse(JSON.parse(JSON.stringify(this.project)));
  }
}

interface ActorOpts {
  x: number; y?: number; scale?: number;
  look?: string | { x: number; y: number } | 'cam';
  ex?: string; pose?: string; hold?: boolean;
  view?: ViewOrAuto; shirt?: string; hair?: string; skin?: string; pants?: string;
  headStrength?: number; intensity?: number; calm?: boolean;
}
interface PropOpts {
  x: number; y?: number; scale?: number; sx?: number; state?: string; clip?: string; clipSpeed?: number;
  a?: string; b?: string; held?: string; parent?: string; rot?: number; opacity?: number; noShadow?: boolean; vis?: boolean; bottom?: boolean; pivot?: [number, number]; parallax?: number; clipOffset?: number;
}
export interface SayOpts { dur?: number; style?: string; g?: 'auto' | 'none' | 'gesture' | 'point' | 'shrug' | 'facepalm' | 'crossArms' | 'think'; ex?: string; side?: 'L' | 'R'; at?: number; gap?: number; look?: string; intensity?: number }

export class Shot {
  ids: Record<string, string> = {};
  /** Cursor de fala (ms). */
  t = 0;
  private sideFlip = 0;
  private curExpr: Record<string, string> = {};
  private curPose: Record<string, string> = {};
  private pendingLooks: Array<[string, string]> = [];

  constructor(public B: Builder, public scene: Scene, public name: string) {}

  get p() { return this.B.project; }
  id(key: string): string { const i = this.ids[key]; if (!i) throw new Error(`Tomada "${this.name}": nó "${key}" não existe`); return i; }

  /* ------------------------------ nós ------------------------------ */
  actor(key: string, who: string, o: ActorOpts): string {
    const def = this.B.chars[who];
    if (!def) throw new Error(`Personagem "${who}" não existe`);
    const node = createCharacterNode(def.id, def.name, { x: o.x, y: o.y ?? FLOOR, scale: o.scale ?? 0.7, bodyView: o.view ?? 'auto', headView: o.view ?? 'auto' });
    node.name = key === who ? def.name : `${def.name} (${key})`;
    node.expression = o.ex ?? 'neutral';
    this.curExpr[key] = node.expression;
    if (o.intensity !== undefined) node.expressionIntensity = o.intensity;
    if (o.calm) node.secondary.enabled = true;
    const ov: Record<string, string> = {};
    if (o.shirt) ov.topColor = o.shirt;
    if (o.hair) ov.hairColor = o.hair;
    if (o.skin) ov.skin = o.skin;
    if (o.pants) ov.bottomColor = o.pants;
    node.appearanceOverrides = ov;
    node.gaze.headStrength = o.headStrength ?? 0.55;
    if (o.look === undefined) node.gaze.mode = 'none';
    this.ids[key] = node.id;
    addNode(this.scene, node);
    if (o.look !== undefined) this.look(key, 0, o.look);
    const pose = o.pose ?? 'idle';
    this.curPose[key] = pose;
    const pr = getPose(pose);
    node.rig = { ...node.rig, ...poseRig(pose) };
    if (pr?.handL) node.handL = pr.handL;
    if (pr?.handR) node.handR = pr.handR;
    return node.id;
  }

  prop(key: string, propId: string, o: PropOpts): string {
    const id = propId.startsWith('obj_') ? OBJECT_PREFIX + propId : propId;
    const node = createPropNode(id, { x: o.x, y: o.y ?? FLOOR - 20, scale: o.scale ?? 1, colorA: o.a, colorB: o.b, state: o.state, name: key });
    if (o.sx !== undefined) node.transform.scaleX = o.sx;
    if (o.rot) node.transform.rotationDeg = o.rot;
    if (o.pivot) { node.transform.pivotX = o.pivot[0]; node.transform.pivotY = o.pivot[1]; }
    if (o.opacity !== undefined) node.opacity = o.opacity;
    if (o.noShadow) node.shadow.enabled = false;
    if (o.parallax !== undefined) node.parallax = o.parallax;
    if (o.vis === false) node.visible = false;
    if (o.clip !== undefined) node.clip = o.clip;
    if (o.clipSpeed !== undefined) node.clipSpeed = o.clipSpeed;
    if (o.clipOffset !== undefined) node.clipOffsetMs = o.clipOffset;
    if (o.held) { node.heldBy = `${this.id(o.held.split(':')[0]!)}:${o.held.split(':')[1] ?? 'R'}`; }
    this.ids[key] = node.id;
    addNode(this.scene, node, o.bottom ? 'bottom' : undefined);
    return node.id;
  }

  shape(key: string, shape: 'rect' | 'ellipse' | 'triangle' | 'star' | 'burst', o: { x: number; y: number; w: number; h: number; fill: string; stroke?: string; sw?: number; radius?: number; opacity?: number; rot?: number; bottom?: boolean; pivot?: [number, number]; vis?: boolean; sx?: number; sy?: number }): string {
    const node = createShapeNode(shape, { name: key, width: o.w, height: o.h, fill: o.fill, stroke: o.stroke ?? '#23202b', strokeWidth: o.sw ?? 4, radius: o.radius ?? 0 });
    node.transform.x = o.x; node.transform.y = o.y;
    if (o.rot) node.transform.rotationDeg = o.rot;
    if (o.sx !== undefined) node.transform.scaleX = o.sx;
    if (o.sy !== undefined) node.transform.scaleY = o.sy;
    if (o.pivot) { node.transform.pivotX = o.pivot[0]; node.transform.pivotY = o.pivot[1]; }
    if (o.opacity !== undefined) node.opacity = o.opacity;
    if (o.vis === false) node.visible = false;
    node.shadow.enabled = false;
    this.ids[key] = node.id;
    addNode(this.scene, node, o.bottom ? 'bottom' : undefined);
    return node.id;
  }

  text(key: string, text: string, o: { x: number; y: number; size?: number; color?: string; stroke?: string; sw?: number; weight?: '400' | '700' | '900'; rot?: number; opacity?: number; vis?: boolean; family?: 'sans' | 'serif' | 'hand' | 'mono'; sx?: number; sy?: number; align?: 'start' | 'middle' | 'end' }): string {
    const node = createTextNode(text, { name: key, fontSize: o.size ?? 64, color: o.color ?? '#ffffff', strokeColor: o.stroke ?? '#23202b', strokeWidth: o.sw ?? 6, fontWeight: o.weight ?? '900', fontFamily: o.family ?? 'sans', align: o.align ?? 'middle' });
    node.transform.x = o.x; node.transform.y = o.y;
    if (o.rot) node.transform.rotationDeg = o.rot;
    if (o.sx !== undefined) node.transform.scaleX = o.sx;
    if (o.sy !== undefined) node.transform.scaleY = o.sy;
    if (o.opacity !== undefined) node.opacity = o.opacity;
    if (o.vis === false) node.visible = false;
    node.shadow.enabled = false;
    this.ids[key] = node.id;
    addNode(this.scene, node);
    return node.id;
  }

  /** Agrupa nós já criados (ordem de camadas preservada). Os filhos passam a ser relativos ao grupo. */
  group(key: string, children: string[], o: { x?: number; y?: number; scale?: number } = {}): string {
    const kids = children.map((c) => this.id(c));
    const members = this.scene.layerOrder.filter((i) => kids.includes(i));
    const g = createGroupNode(key, members);
    const anchor = Math.max(...members.map((m) => this.scene.layerOrder.indexOf(m)));
    this.scene.nodes[g.id] = g;
    this.scene.layerOrder.splice(anchor + 1, 0, g.id);
    this.scene.layerOrder = this.scene.layerOrder.filter((i) => !members.includes(i));
    for (const m of members) this.scene.nodes[m]!.parentId = g.id;
    g.transform.x = o.x ?? 0; g.transform.y = o.y ?? 0;
    g.transform.scaleX = g.transform.scaleY = o.scale ?? 1;
    this.ids[key] = g.id;
    return g.id;
  }

  /* ------------------------------ tempo ------------------------------ */
  /** Keyframes numa propriedade de nó (ou da câmera com key = 'camera'). */
  k(key: string, path: string, kfs: KF[]): void {
    const target = key === 'camera' ? CAMERA_TARGET : this.id(key);
    const track = ensurePropertyTrack(this.scene, target, path);
    for (const [t, v, e] of kfs) {
      if (e === 'hold') setKeyframe(track, t, v, { interpolation: 'hold' });
      else if (e === 'linear') setKeyframe(track, t, v, { interpolation: 'linear' });
      else setKeyframe(track, t, v, { interpolation: 'bezier', easing: e ?? 'easeInOut' });
    }
    if (kfs.length) extendToFit(this.scene, Math.max(...kfs.map((x) => x[0])));
  }

  /** Câmera: valores iniciais. */
  cam0(c: { x?: number; y?: number; zoom?: number; rot?: number }) {
    Object.assign(this.scene.camera, { x: c.x ?? 0, y: c.y ?? 0, zoom: c.zoom ?? 1, rotationDeg: c.rot ?? 0 });
  }

  /** Movimento de câmera entre o valor atual e o alvo (travelling, panorâmica, zoom). */
  cam(t: number, c: { x?: number; y?: number; zoom?: number; rot?: number }, dur = 1500, ease: Ease = 'easeInOut') {
    for (const [path, v] of [['x', c.x], ['y', c.y], ['zoom', c.zoom], ['rotationDeg', c.rot]] as const) {
      if (v === undefined) continue;
      const cur = readProperty(this.scene, CAMERA_TARGET, path, t) as number;
      this.k('camera', path, [[t, cur, 'linear'], [t + dur, v, ease]]);
    }
  }

  /** Corte seco de câmera num instante. */
  camCut(t: number, c: { x?: number; y?: number; zoom?: number; rot?: number }) {
    for (const [path, v] of [['x', c.x], ['y', c.y], ['zoom', c.zoom], ['rotationDeg', c.rot]] as const) {
      if (v === undefined) continue;
      const cur = readProperty(this.scene, CAMERA_TARGET, path, Math.max(0, t - 1)) as number;
      this.k('camera', path, [[Math.max(0, t - 1), cur, 'hold'], [t, v, 'hold']]);
    }
  }

  /** Enquadramento calculado a partir de atores (estado inicial da tomada). */
  frame(kind: 'wide' | 'medium' | 'close' | 'two' | 'over' | 'full', targets: string[], o: { dx?: number; dy?: number; zoom?: number } = {}) {
    const box = (key: string) => {
      const n = this.scene.nodes[this.id(key)]!;
      const sc = Math.abs(n.transform.scaleY);
      if (n.kind === 'character') {
        const m = bodyMetrics(this.B.chars[this.charOf(key)]!);
        return { x: n.transform.x, headY: n.transform.y + m.headCenterY * sc, top: n.transform.y - m.totalHeight * sc, bottom: n.transform.y, h: m.totalHeight * sc };
      }
      return { x: n.transform.x, headY: n.transform.y - 150, top: n.transform.y - 300, bottom: n.transform.y, h: 300 * sc };
    };
    // O alvo principal passa à frente dos demais (nenhum rosto de fundo tapa quem fala).
    if (kind !== 'wide') {
      const top = this.id(targets[0]!);
      if (this.scene.layerOrder.includes(top)) this.scene.layerOrder = [...this.scene.layerOrder.filter((i) => i !== top), top];
    }
    let c: { x: number; y: number; zoom: number };
    if (kind === 'wide') c = { x: 0, y: 0, zoom: 1 };
    else if (kind === 'two' || kind === 'over') {
      const a = box(targets[0]!); const b = box(targets[1]!);
      const width = Math.abs(a.x - b.x) + 560;
      const zoom = clampN(Math.min(1920 / width, 1080 / (Math.max(a.h, b.h) * 1.05)), 0.9, 3);
      c = { x: (a.x + b.x) / 2, y: (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2 - 20, zoom };
    } else {
      const a = box(targets[0]!);
      if (kind === 'full') c = { x: a.x, y: a.top + a.h * 0.5, zoom: clampN(1080 / (a.h * 1.12), 1, 2) };
      else if (kind === 'medium') c = { x: a.x, y: a.top + a.h * 0.42, zoom: clampN(1080 / (a.h * 0.88), 1.1, 2.6) };
      else c = { x: a.x, y: a.headY + a.h * 0.13, zoom: clampN(1080 / (a.h * 0.66), 1.4, 3.6) };
    }
    this.cam0({ x: c.x + (o.dx ?? 0), y: c.y + (o.dy ?? 0), zoom: o.zoom ?? c.zoom });
  }

  private charOf(key: string): string {
    const n = this.scene.nodes[this.id(key)]!;
    if (n.kind !== 'character') throw new Error('não é personagem');
    const found = Object.entries(this.B.chars).find(([, d]) => d.id === n.characterId);
    return found![0];
  }

  ex(key: string, t: number, expression: string) {
    this.k(key, 'expression', [[t, expression, 'hold']]);
    this.curExpr[key] = expression;
  }

  look(key: string, t: number, target: string | { x: number; y: number } | 'cam' | 'none') {
    const n = this.scene.nodes[this.id(key)];
    if (!n || n.kind !== 'character') return;
    if (t === 0) {
      if (target === 'none') n.gaze.mode = 'none';
      else if (target === 'cam') n.gaze.mode = 'camera';
      else if (typeof target === 'string') { n.gaze.mode = 'node'; this.pendingLooks.push([n.id, target]); }
      else { n.gaze.mode = 'point'; n.gaze.x = target.x; n.gaze.y = target.y; }
      return;
    }
    if (target === 'none') this.k(key, 'gaze.mode', [[t, 'none', 'hold']]);
    else if (target === 'cam') this.k(key, 'gaze.mode', [[t, 'camera', 'hold']]);
    else if (typeof target === 'string') { this.k(key, 'gaze.mode', [[t, 'node', 'hold']]); this.k(key, 'gaze.targetId', [[t, this.id(target), 'hold']]); }
    else { this.k(key, 'gaze.mode', [[t, 'point', 'hold']]); this.k(key, 'gaze.x', [[t, target.x, 'hold']]); this.k(key, 'gaze.y', [[t, target.y, 'hold']]); }
  }

  /** Muda de pose com transição suave (animando só os eixos que diferem). */
  pose(key: string, t: number, poseId: string, ms = 280) {
    const from = poseRig(this.curPose[key] ?? 'idle');
    const to = poseRig(poseId);
    const keys = Object.keys(to) as RigKey[];
    for (const rk of keys) {
      if (rk === 'bodyY' || rk === 'breath') continue;
      const a = from[rk as keyof Rig]; const b = to[rk as keyof Rig];
      if (a === b) continue;
      this.k(key, `rig.${rk}`, [[Math.max(0, t - 1), a, 'linear'], [t + ms, b, 'easeInOut']]);
    }
    this.curPose[key] = poseId;
  }

  /** Ação nativa (walk, gesture, point, shrug, react, facepalm…). Retorna a duração. */
  act(key: string, action: string, t: number, o: { dur?: number; side?: 'L' | 'R' | 'auto'; intensity?: number; speed?: number; to?: number } = {}): number {
    return insertAction(this.p, this.scene, this.id(key), action, t, { durationMs: o.dur, side: o.side ?? 'auto', intensity: o.intensity, speed: o.speed, targetX: o.to });
  }

  /** Caminha de x0 a x1 (deslocamento físico: keyframes de X + clip "andar"). */
  walk(key: string, t: number, x0: number, x1: number, o: { speed?: number; dur?: number; run?: boolean } = {}): number {
    const n = this.scene.nodes[this.id(key)]!;
    const k = Math.abs(n.transform.scaleX);
    const px = (o.run ? 640 : 300) * k * (o.speed ?? 1);
    const dur = o.dur ?? Math.max(500, (Math.abs(x1 - x0) / px) * 1000);
    // A ação nativa grava os próprios keyframes de X (alvo padrão +300): por isso entra primeiro e os nossos sobrescrevem.
    this.act(key, o.run ? 'run' : 'walk', t, { dur, speed: (o.speed ?? 1) * (o.run ? 1 : 1) });
    this.k(key, 'transform.x', [[t, x0, 'linear'], [t + dur, x1, 'linear']]);
    return dur;
  }

  /** Fala com balão. Avança o cursor `t` (ou usa `at`). Gesto automático em falas longas. */
  say(who: string, text: string, o: SayOpts = {}): number {
    // Falas longas viram dois balões em sequência (o balão nunca cobre o rosto de quem fala).
    const parts = text.length > 78 ? splitSpeech(text) : [text];
    if (parts.length > 1) {
      const total = o.dur ?? parts.reduce((a, p) => a + speechMs(p), 0);
      const sum = parts.reduce((a, p) => a + p.length, 0);
      let t = o.at ?? this.t; let end = t;
      parts.forEach((p, i) => {
        const d = Math.round((total * p.length) / sum);
        end = this.say(who, p, { ...o, at: t, dur: d, g: i === 0 ? o.g : 'none', ex: i === 0 ? o.ex : undefined, look: i === 0 ? o.look : undefined });
        t = end + 120;
      });
      if (o.at === undefined) this.t = end + (o.gap ?? 260);
      return end;
    }
    const start = o.at ?? this.t;
    // Tempo mínimo de leitura/dublagem: no máximo ~19 caracteres por segundo.
    const dur = Math.max(o.dur ?? speechMs(text), Math.round(text.length * 52 + 700));
    const shout = o.style ?? (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{4,}[^a-z]*[!?]+/.test(text) && text === text.toUpperCase() ? 'shout' : 'speech');
    const clip = addDialogue(this.scene, this.id(who), text, start, dur, { showBubble: true, showSubtitle: false, bubbleStyle: shout });
    void clip;
    const stripped = this.B.names[this.charKeyOf(who)] ?? who;
    this.B.dub.push({ seq: this.B.seq, shot: this.name, sceneId: this.scene.id, who: stripped, text, localStartMs: start, durMs: dur, style: shout });
    if (o.ex) this.ex(who, start, o.ex);
    if (o.look) this.look(who, start, o.look);
    let g = o.g ?? 'auto';
    if (g === 'auto') g = (text.length > 34 || shout === 'shout') && dur > 1700 ? 'gesture' : 'none';
    if (g !== 'none') {
      const side = o.side ?? (this.sideFlip++ % 2 ? 'L' : 'R');
      const gd = Math.min(dur, g === 'gesture' ? dur - 200 : 1400);
      this.act(who, g, start + 120, { dur: Math.max(500, gd), side, intensity: o.intensity ?? (shout === 'shout' ? 1.15 : 0.8) });
    }
    if (o.at === undefined) this.t = start + dur + (o.gap ?? 260);
    else this.t = Math.max(this.t, start + dur);
    extendToFit(this.scene, start + dur);
    return start + dur;
  }

  private charKeyOf(nodeKey: string): string {
    try { return this.charOf(nodeKey); } catch { return nodeKey; }
  }

  wait(ms: number) { this.t += ms; }
  /** Efeito sonoro pontual (trilha SFX da cena). */
  snd(asset: string, t: number, vol = 0.8, o: { dur?: number; offset?: number } = {}) {
    const a = this.B.audio[asset];
    if (!a) throw new Error(`áudio "${asset}" não existe`);
    let tr = this.scene.tracks.find((x) => x.type === 'audio' && x.role === 'sfx');
    if (!tr) tr = addAudioTrack(this.scene, 'sfx');
    if (tr.type === 'audio') addAudioClip(this.scene, tr.id, a.id, t, o.dur ?? a.durMs, { volume: vol, offsetMs: o.offset ?? 0 });
  }
  fx(effect: 'shake' | 'flash' | 'fadeBlack' | 'fadeFromBlack' | 'vignette' | 'tint', t: number, dur: number, intensity?: number) {
    const c = addEffect(this.scene, effect, t, dur);
    if (intensity !== undefined) c.intensity = intensity;
  }

  /** Duração final: fim do conteúdo + respiro. */
  end(pad = 500) { this.scene.durationMs = Math.max(this.scene.durationMs, Math.ceil((this.t + pad) / 100) * 100); }
  dur(ms: number) { this.scene.durationMs = ms; }
  finish() {
    for (const [nid, tk] of this.pendingLooks) {
      const n = this.scene.nodes[nid];
      if (n?.kind !== 'character') continue;
      // Alvo ausente nesta tomada (ex.: plano sem aquele personagem): olha reto, sem erro.
      if (this.ids[tk]) n.gaze.targetId = this.ids[tk]!;
      else n.gaze.mode = 'none';
    }
    this.pendingLooks = [];
    this.scene.durationMs = Math.ceil(this.scene.durationMs / 100) * 100;
  }
  background(presetId: string, patch: Partial<Background> = {}) { applyBackground(this.scene, presetId, patch, false); }
}
