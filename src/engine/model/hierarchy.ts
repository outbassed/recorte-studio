/**
 * Hierarquia pai/filho dos nós (grupos). O desenho já aninha o filho dentro do <g> do grupo, então a
 * transformação do pai (posição, rotação, escala, keyframes) compõe com a do filho, e o filho mantém
 * as próprias animações no sistema local. Aqui ficam as contas para VINCULAR e DESVINCULAR sem salto:
 * matriz de mundo do nó, inversa do novo pai e decomposição de volta em x, y, rotação e escala.
 *
 * Limites honestos: a decomposição não representa cisalhamento (pai com escala não uniforme E filho
 * girado); nesse caso a posição do pivô é exata e a forma pode mudar levemente. A escala de profundidade
 * (perspectiva falsa) do nó é ignorada nas contas.
 */
import type { Scene, SceneNode } from './schema';

/** Matriz 2D no formato do SVG: [a b c d e f]. */
export type Mat = [number, number, number, number, number, number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det || !Number.isFinite(det)) return IDENTITY;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
export const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const T = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const R = (deg: number): Mat => { const r = (deg * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
const S = (x: number, y: number): Mat => [x, 0, 0, y, 0, 0];

/** Mesma ordem do desenho: translate(x y) rotate(r px py) scale(sx sy). */
export function localMatrix(t: SceneNode['transform']): Mat {
  return mul(mul(mul(mul(T(t.x, t.y), T(t.pivotX, t.pivotY)), R(t.rotationDeg)), T(-t.pivotX, -t.pivotY)), S(t.scaleX, t.scaleY));
}

/** Ancestrais do nó, do pai ao mais externo (protegido contra ciclos e referências órfãs). */
export function ancestors(scene: Scene, id: string): string[] {
  const out: string[] = [];
  const seen = new Set([id]);
  let p = scene.nodes[id]?.parentId ?? null;
  while (p && !seen.has(p) && scene.nodes[p] && out.length < 32) {
    out.push(p);
    seen.add(p);
    p = scene.nodes[p]!.parentId;
  }
  return out;
}

/** Matriz de mundo (antes da câmera) de um nó, usando os valores-base ou os resolvidos passados. */
export function worldMatrix(scene: Scene, id: string, nodes: Record<string, SceneNode> = scene.nodes): Mat {
  let m = nodes[id] ? localMatrix(nodes[id]!.transform) : IDENTITY;
  for (const a of ancestors(scene, id)) m = mul(nodes[a] ? localMatrix(nodes[a]!.transform) : IDENTITY, m);
  return m;
}

/** Decompõe uma matriz local em x, y, rotação e escala, respeitando o pivô do nó. */
export function decompose(m: Mat, pivotX: number, pivotY: number): Pick<SceneNode['transform'], 'x' | 'y' | 'rotationDeg' | 'scaleX' | 'scaleY'> {
  const sx = Math.hypot(m[0], m[1]) || 1e-6;
  const rot = Math.atan2(m[1], m[0]);
  const sy = (m[0] * m[3] - m[1] * m[2]) / sx;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  // translação de T(x)·T(p)·R·T(-p) = x + p − R·p
  const rpx = c * pivotX - s * pivotY;
  const rpy = s * pivotX + c * pivotY;
  return { x: m[4] - pivotX + rpx, y: m[5] - pivotY + rpy, rotationDeg: (rot * 180) / Math.PI, scaleX: sx, scaleY: sy };
}

/** `candidate` está dentro de `id` (ou é ele)? Impede ciclos A → B → A. */
export function isDescendant(scene: Scene, candidate: string, id: string): boolean {
  return candidate === id || ancestors(scene, candidate).includes(id);
}

/** Grupos que podem receber o nó como filho (nenhum descendente dele, nem ele mesmo). */
export function parentOptions(scene: Scene, id: string): Array<{ id: string; name: string }> {
  return Object.values(scene.nodes).filter((n) => n.kind === 'group' && !isDescendant(scene, n.id, id)).map((n) => ({ id: n.id, name: n.name }));
}

/**
 * Vincula (ou solta, com parentId null) mantendo a posição/rotação/escala no MUNDO.
 * O filho entra por cima dos outros filhos do novo pai; solto, vai para logo acima do antigo pai.
 * Devolve uma mensagem de erro ou null. Chamar dentro de um commit (um só Ctrl+Z).
 */
export function setParent(scene: Scene, id: string, parentId: string | null, keepWorld = true): string | null {
  const node = scene.nodes[id];
  if (!node) return 'Elemento inexistente.';
  if (node.parentId === parentId) return null;
  if (parentId) {
    const p = scene.nodes[parentId];
    if (!p || p.kind !== 'group') return 'Só grupos podem receber elementos vinculados.';
    if (isDescendant(scene, parentId, id)) return 'Não dá para vincular um elemento a ele mesmo ou a algo que está dentro dele.';
  }
  const world = worldMatrix(scene, id);
  const oldParent = node.parentId ? scene.nodes[node.parentId] : undefined;
  // Sai do lugar antigo.
  if (oldParent?.kind === 'group') oldParent.children = oldParent.children.filter((c) => c !== id);
  const oldTopIdx = scene.layerOrder.indexOf(id);
  if (oldTopIdx >= 0) scene.layerOrder.splice(oldTopIdx, 1);
  // Entra no novo.
  if (parentId) {
    const p = scene.nodes[parentId] as Extract<SceneNode, { kind: 'group' }>;
    p.children.push(id);
  } else {
    // Topo da cena: logo acima do grupo de onde saiu (ou do ancestral que está na lista de camadas).
    const anchor = [node.parentId, ...(node.parentId ? ancestors(scene, node.parentId) : [])].find((a) => a && scene.layerOrder.includes(a));
    const at = anchor ? scene.layerOrder.indexOf(anchor) + 1 : scene.layerOrder.length;
    scene.layerOrder.splice(at, 0, id);
  }
  node.parentId = parentId;
  if (keepWorld) {
    const pw = parentId ? worldMatrix(scene, parentId) : IDENTITY;
    Object.assign(node.transform, decompose(mul(invert(pw), world), node.transform.pivotX, node.transform.pivotY));
  }
  return null;
}
