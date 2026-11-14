/**
 * Onde a mão de um personagem está AGORA, no mundo. Usado ao ligar o IK: o alvo nasce exatamente na mão,
 * então ligar o IK não muda nada na tela; a partir dali o alvo é que comanda o braço.
 * (Fica fora de `sceneIk.ts` para não criar ciclo com o avaliador.)
 */
import { apply } from '../model/hierarchy';
import type { CharacterNode, Project, Scene } from '../model/schema';
import { evaluateScene } from '../animation/evaluate';
import { armHandLocal, type ArmSide } from './armIk';
import { characterWorldMatrix } from './sceneIk';
import type { Vec2 } from './ik2d';

export function currentHandWorld(project: Project, scene: Scene, nodeId: string, side: ArmSide, timeMs: number): Vec2 | null {
  const ev = evaluateScene(project, scene, timeMs);
  const rc = ev.characters[nodeId];
  const node = ev.nodes[nodeId];
  if (!rc || !node || node.kind !== 'character') return null;
  const hand = armHandLocal(rc.def, rc.pose.bodyView, rc.pose.rig, side);
  const [x, y] = apply(characterWorldMatrix(scene, node as CharacterNode, ev.nodes), hand.x, hand.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
