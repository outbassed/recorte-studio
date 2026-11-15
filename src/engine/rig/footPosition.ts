/** Captura o tornozelo atual ao ativar o IK, sem pular para outro lugar. */
import { apply } from '../model/hierarchy';
import type { Project, Scene } from '../model/schema';
import { evaluateScene } from '../animation/evaluate';
import { characterWorldMatrix } from './sceneIk';
import { footAnkleLocal, type LegSide } from './legIk';
import type { Vec2 } from './ik2d';

/** Retorna null quando o personagem não está disponível ou a transformação é singular. */
export function currentFootWorld(project: Project, scene: Scene, nodeId: string, side: LegSide, timeMs: number): Vec2 | null {
  const ev = evaluateScene(project, scene, timeMs);
  const ch = ev.characters[nodeId];
  const node = ev.nodes[nodeId];
  if (!ch || !node || node.kind !== 'character') return null;
  const m = characterWorldMatrix(scene, node, ev.nodes);
  if (!Number.isFinite(m[0] * m[3] - m[1] * m[2]) || Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-9) return null;
  const foot = footAnkleLocal(ch.def, ch.pose.bodyView, ch.pose.rig, side);
  const [x, y] = apply(m, foot.x, foot.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
