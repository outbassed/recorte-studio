/**
 * IK de braços dentro do avaliador de cena: resolve o ponto-alvo no mundo, leva-o ao espaço do personagem e
 * mistura a solução com o rig já composto (pose + keyframes + ações + movimento natural).
 *
 * Tudo aqui é função de (projeto, cena, tempo): nada é guardado entre quadros. Por isso a prévia, o seek na timeline
 * e a exportação (que usam o mesmo avaliador) enxergam exatamente o mesmo braço.
 *
 * Com `ik.armX.enabled = false` (o padrão) a função devolve o MESMO objeto de rig, sem custo e sem nenhuma mudança.
 */
import { apply, localMatrix, mul, parentWorldMatrix, worldMatrix, invert, type Mat } from '../model/hierarchy';
import type { ArmIk, CharacterDefinition, CharacterNode, Project, Rig, Scene, SceneNode, ViewId } from '../model/schema';
import { bodyMetrics } from '../character/render';
import { customObjectBounds, isCustomObjectId } from '../world/pieces';
import { getProp, propBounds } from '../world/props';
import { blendArmIk, solveArmIk, type ArmSide } from './armIk';
import { blendLegIk, solveLegIk, type LegSide } from './legIk';
import type { IkLimit, Vec2 } from './ik2d';

export interface ArmIkReport {
  /** a mão chegou ao alvo? (false: fora do alcance ou travada por limite da junta) */
  reached: boolean;
  limited: IkLimit;
  /** distância entre a mão e o alvo depois de resolver, em px do personagem */
  error: number;
  /** distância ombro → alvo e alcance máximo do braço, em px do personagem */
  distance: number;
  maxReach: number;
  /** alvo no mundo (antes da câmera) */
  target: Vec2;
}

export interface LegIkReport extends ArmIkReport {
  /** Tornozelo resultante, em coordenadas do personagem; usado para depuração. */
  ankle: Vec2;
}

export interface SceneIkInput {
  project: Project;
  scene: Scene;
  /** nós já resolvidos no instante (valores de keyframes aplicados) */
  nodes: Record<string, SceneNode>;
  node: CharacterNode;
  def: CharacterDefinition;
  bodyView: ViewId;
  /** rig já composto; NÃO é alterado */
  rig: Rig;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const SIDES: Array<[ArmSide, 'armL' | 'armR']> = [['L', 'armL'], ['R', 'armR']];
const LEGS: Array<[LegSide, 'legL' | 'legR']> = [['L', 'legL'], ['R', 'legR']];

/** Matriz de mundo do personagem como o desenho a usa, incluindo a escala de profundidade (perspectiva falsa). */
export function characterWorldMatrix(scene: Scene, node: SceneNode, nodes: Record<string, SceneNode>): Mat {
  const t = node.transform;
  let sx = t.scaleX;
  let sy = t.scaleY;
  if (node.useDepthScale && scene.perspective.enabled) {
    const k = clamp(1 + (t.y - scene.perspective.refY) * scene.perspective.strength, 0.1, 4);
    sx *= k;
    sy *= k;
  }
  return mul(parentWorldMatrix(scene, node.id, nodes), localMatrix({ ...t, scaleX: sx, scaleY: sy }));
}

/** Centro do elemento no seu próprio espaço (o que a seleção mostra como caixa). Personagem: altura do peito. */
function localCenter(node: SceneNode, project: Project): Vec2 {
  switch (node.kind) {
    case 'character': {
      const def = project.characters[node.characterId];
      return { x: 0, y: def ? -bodyMetrics(def).totalHeight * 0.62 : -250 };
    }
    case 'prop': {
      const b = isCustomObjectId(node.propId) ? customObjectBounds(project, node.propId) : (() => { const p = getProp(node.propId); return p ? propBounds(p) : { x: -50, y: -100, w: 100, h: 100 }; })();
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    }
    case 'text': {
      const lines = node.text.split('\n');
      const w = Math.max(...lines.map((l) => l.length)) * node.fontSize * 0.56;
      const x = node.align === 'start' ? 0 : node.align === 'end' ? -w : -w / 2;
      return { x: x + w / 2, y: -node.fontSize + (lines.length * node.fontSize * 1.2) / 2 };
    }
    default:
      return { x: 0, y: 0 };
  }
}

/** Alvo do braço no mundo, ou null quando não dá para resolver (sem elemento, o próprio personagem, objeto segurado). */
export function ikTargetWorld(cfg: ArmIk, self: CharacterNode, input: Pick<SceneIkInput, 'project' | 'scene' | 'nodes'>): Vec2 | null {
  if (cfg.targetMode === 'point') return { x: cfg.x, y: cfg.y };
  const id = cfg.targetId;
  if (!id || id === self.id) return null;
  const tgt = input.nodes[id];
  if (!tgt || !input.scene.nodes[id]) return null;
  // Objeto segurado por alguém: a posição dele só existe depois do desenho da mão. Sem alvo estável, o braço fica no rig.
  if (tgt.kind === 'prop' && tgt.heldBy) return null;
  const c = localCenter(tgt, input.project);
  const [x, y] = apply(worldMatrix(input.scene, id, input.nodes), c.x, c.y);
  return { x, y };
}

export function applySceneIk(input: SceneIkInput): { rig: Rig; reports: Partial<Record<ArmSide, ArmIkReport>>; feet: Partial<Record<LegSide, LegIkReport>> } {
  const { node } = input;
  const reports: Partial<Record<ArmSide, ArmIkReport>> = {};
  const feet: Partial<Record<LegSide, LegIkReport>> = {};
  let rig = input.rig;
  for (const [side, key] of SIDES) {
    const cfg = node.ik[key];
    if (!cfg.enabled || !(cfg.weight > 0)) continue;
    const world = ikTargetWorld(cfg, node, input);
    if (!world) continue;
    const m = characterWorldMatrix(input.scene, input.nodes[node.id] ?? node, input.nodes);
    const det = m[0] * m[3] - m[1] * m[2];
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) continue; // personagem sem área (escala 0): nada a resolver
    const [lx, ly] = apply(invert(m), world.x, world.y);
    // O IK de cada braço lê o `rig` ORIGINAL (nunca o resultado do outro braço): a ordem não importa.
    const sol = solveArmIk(input.def, input.bodyView, input.rig, side, { x: lx, y: ly }, cfg.bend, cfg.soft);
    rig = blendArmIk(rig, side, sol, cfg.weight);
    reports[side] = { reached: sol.reached, limited: sol.limited, error: sol.error, distance: sol.distance, maxReach: sol.maxReach, target: world };
  }
  // Pé fixo no mundo: ao mover o corpo, o joelho se adapta. Nunca altera o corpo,
  // somente os ângulos de coxa/canela. Para dar um passo, anime o peso e X/Y.
  for (const [side, key] of LEGS) {
    const cfg = node.ik[key];
    if (!cfg?.enabled || !(cfg.weight > 0)) continue;
    const matrix = characterWorldMatrix(input.scene, input.nodes[node.id] ?? node, input.nodes);
    const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    if (!Number.isFinite(det) || Math.abs(det) < 1e-9) continue;
    const [lx, ly] = apply(invert(matrix), cfg.x, cfg.y);
    // Ler sempre o mesmo rig original mantém a solução independente da ordem dos pés.
    const sol = solveLegIk(input.def, input.bodyView, input.rig, side, { x: lx, y: ly }, cfg.bend, cfg.soft);
    rig = blendLegIk(rig, side, sol, cfg.weight);
    feet[side] = { reached: sol.reached, limited: sol.limited, error: sol.error,
      distance: sol.distance, maxReach: sol.maxReach, ankle: sol.ankle,
      target: { x: cfg.x, y: cfg.y } };
  }
  return { rig, reports, feet };
}
