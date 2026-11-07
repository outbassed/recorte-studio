/**
 * Montagem final: sequência de cenas com transições. A mesma função é usada na
 * reprodução do projeto e na exportação, garantindo o mesmo resultado.
 */
import { frameSize, type Project, type Scene, type Transition } from '../model/schema';
import { n, safeColor } from './svg';
import { planFrame, planScene, type AssetResolver, type FramePlan, type PlanGroup } from './plan';

export interface MontageSegment {
  sceneId: string;
  startMs: number;
  durationMs: number;
  /** sobreposição efetiva com a cena anterior */
  overlapMs: number;
  transition: Transition;
}

const OVERLAPPING = new Set(['crossfade', 'wipe', 'slide']);

export function buildMontage(project: Project, sceneIds?: string[]): { segments: MontageSegment[]; totalMs: number } {
  const ids = sceneIds ?? project.sceneOrder;
  const segments: MontageSegment[] = [];
  let cursor = 0;
  ids.forEach((id, i) => {
    const scene = project.scenes[id];
    if (!scene) return;
    const prev = segments[segments.length - 1];
    let overlap = 0;
    const tr = scene.transitionIn;
    if (i > 0 && prev && OVERLAPPING.has(tr.kind)) {
      overlap = Math.min(tr.durationMs, Math.floor(prev.durationMs / 2), Math.floor(scene.durationMs / 2));
    }
    const start = cursor - overlap;
    segments.push({ sceneId: id, startMs: start, durationMs: scene.durationMs, overlapMs: overlap, transition: tr });
    cursor = start + scene.durationMs;
  });
  return { segments, totalMs: cursor };
}

export function segmentAt(segments: MontageSegment[], t: number): number {
  let idx = 0;
  for (let i = 0; i < segments.length; i++) if (segments[i]!.startMs <= t) idx = i;
  return idx;
}

export function planMontageFrame(project: Project, segments: MontageSegment[], t: number, assets: AssetResolver, opts: { transparentBg?: boolean } = {}): FramePlan {
  const idx = segmentAt(segments, t);
  const cur = segments[idx]!;
  const scene = project.scenes[cur.sceneId] as Scene;
  const local = t - cur.startMs;
  const base = planFrame(project, scene, local, assets, opts);
  const { w } = frameSize(project.settings);
  const prev = idx > 0 ? segments[idx - 1] : undefined;
  // Fades de/para preto
  const black = (op: number) => `<rect x="-4000" y="-3000" width="8000" height="6000" fill="#000" opacity="${op.toFixed(3)}"/>`;
  if (cur.transition.kind === 'fade' && local < cur.transition.durationMs && idx > 0) base.screen += black(1 - local / Math.max(1, cur.transition.durationMs));
  const out = scene.transitionOut;
  const remaining = cur.durationMs - local;
  if (out.kind === 'fade' && remaining < out.durationMs) base.screen += black(1 - remaining / Math.max(1, out.durationMs));

  if (prev && cur.overlapMs > 0 && local < cur.overlapMs) {
    const progress = local / cur.overlapMs;
    const prevScene = project.scenes[prev.sceneId] as Scene;
    const a = planScene(project, prevScene, t - prev.startMs, assets, opts);
    const groupA: PlanGroup = { ...a.group, key: `${a.group.key}-prev` };
    const groupB: PlanGroup = { ...base.groups[0]! };
    base.defs = a.defs + base.defs;
    if (cur.transition.kind === 'crossfade') groupB.opacity = progress;
    if (cur.transition.kind === 'slide') groupB.transform = `translate(${n((1 - progress) * w)} 0)`;
    if (cur.transition.kind === 'wipe') {
      const clipId = `wipe-${cur.sceneId}`;
      base.defs += `<clipPath id="${clipId}"><rect x="${n(-w / 2)}" y="-3000" width="${n(w * progress)}" height="6000"/></clipPath>`;
      groupB.clip = clipId;
    }
    base.groups = [groupA, groupB];
  }
  if (base.background) base.background = safeColor(base.background);
  return base;
}
