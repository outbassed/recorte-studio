/**
 * Peças 2D: base do Criador de Objetos e do Criador de Cenários.
 * Mesmo desenho na prévia, no editor e na exportação (string SVG determinística).
 */
import type { CharacterDefinition, Composition, CustomObject, ObjectClip, Piece, PieceKind, Project, StaticCharacter } from '../model/schema';
import { PieceSchema, StaticCharacterSchema } from '../model/schema';
import { uid, deepClone } from '../model/ids';
import { renderCharacter } from '../character/render';
import { getPose, poseRig } from '../character/presets';
import { getProp, propBounds, renderProp } from './props';
import { esc, n } from '../render/svg';

export const OBJECT_PREFIX = 'obj:';
export const isCustomObjectId = (propId: string) => propId.startsWith(OBJECT_PREFIX);
export const customObjectIdOf = (propId: string) => propId.slice(OBJECT_PREFIX.length);

const COLOR = /^#[0-9a-fA-F]{3,8}$|^none$|^transparent$/;
const color = (c: string, fb: string) => (COLOR.test(c) ? c : fb);

export const PIECE_LABELS: Record<PieceKind, string> = {
  rect: 'Retângulo', ellipse: 'Elipse', triangle: 'Triângulo', polygon: 'Polígono', star: 'Estrela', line: 'Linha',
  image: 'Imagem', prop: 'Objeto pronto', object: 'Meu objeto', character: 'Personagem estático',
};

export function createPiece(kind: PieceKind, o: Partial<Piece> = {}): Piece {
  return PieceSchema.parse({ id: uid('pc'), kind, name: o.name ?? PIECE_LABELS[kind], ...o });
}

/** Cópia estável de um personagem: muda só quando o usuário edita a peça. */
export function freezeCharacter(def: CharacterDefinition, o: Partial<Omit<StaticCharacter, 'def'>> = {}): StaticCharacter {
  const poseId = o.poseId ?? 'idle';
  const pose = getPose(poseId);
  return StaticCharacterSchema.parse({
    def: deepClone(def), sourceId: def.id, view: 'front', expression: 'neutral', poseId,
    rig: poseRig(poseId), handL: pose?.handL ?? 'open', handR: pose?.handR ?? 'open', limbDepth: pose?.limbDepth ?? {}, ...o,
  });
}

export interface PieceEnv {
  project: Project;
  url: (assetId: string) => string | undefined;
  /** Prefixo para ids internos (gradientes, máscaras) não colidirem. */
  idPrefix: string;
  depth?: number;
  /** Tempo local (ms) para objetos animados aninhados; sem ele, usam o primeiro quadro. */
  timeMs?: number;
}

const charCache = new WeakMap<StaticCharacter, Map<string, string>>();
function renderStaticCharacter(c: StaticCharacter, id: string): string {
  let m = charCache.get(c);
  if (!m) charCache.set(c, (m = new Map()));
  let v = m.get(id);
  if (v === undefined) {
    v = renderCharacter(c.def, {
      bodyView: c.view, headView: c.view, rig: c.rig, handL: c.handL, handR: c.handR, limbDepth: c.limbDepth,
      face: { expression: c.expression, intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 },
    }, id).svg;
    if (m.size > 30) m.clear();
    m.set(id, v);
  }
  return v;
}

function polygonPoints(sides: number, w: number, h: number, star: boolean): string {
  const pts: string[] = [];
  const count = star ? sides * 2 : sides;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / count;
    const r = star && i % 2 ? 0.45 : 1;
    pts.push(`${n((Math.cos(a) * w * r) / 2)},${n((Math.sin(a) * h * r) / 2)}`);
  }
  return pts.join(' ');
}

function pieceInner(p: Piece, env: PieceEnv): string {
  const fill = color(p.fill, '#f2a65a');
  const stroke = color(p.stroke, '#23202b');
  const paint = `fill="${fill}" stroke="${stroke}" stroke-width="${n(Math.max(0, p.strokeWidth))}" stroke-linejoin="round"`;
  const { w, h } = p;
  switch (p.kind) {
    case 'rect': return `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="${n(Math.max(0, p.radius))}" ${paint}/>`;
    case 'ellipse': return `<ellipse cx="0" cy="0" rx="${n(w / 2)}" ry="${n(h / 2)}" ${paint}/>`;
    case 'triangle': return `<path d="M0 ${n(-h / 2)}L${n(w / 2)} ${n(h / 2)}L${n(-w / 2)} ${n(h / 2)}Z" ${paint}/>`;
    case 'polygon': return `<polygon points="${polygonPoints(p.sides, w, h, false)}" ${paint}/>`;
    case 'star': return `<polygon points="${polygonPoints(p.sides, w, h, true)}" ${paint}/>`;
    case 'line': return `<path d="M${n(-w / 2)} 0L${n(w / 2)} 0" fill="none" stroke="${stroke}" stroke-width="${n(Math.max(1, p.strokeWidth))}" stroke-linecap="round"/>`;
    case 'image': {
      const href = p.assetId ? env.url(p.assetId) : undefined;
      if (!href) return `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" fill="#3a3f4b" stroke="#d65f5f" stroke-width="4" stroke-dasharray="12 8"/>`;
      return `<image href="${esc(href)}" x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"/>`;
    }
    case 'prop': return p.refId ? renderProp(p.refId, color(p.colorA, ''), color(p.colorB, ''), p.state) : '';
    case 'object': {
      const obj = p.refId ? env.project.customObjects[p.refId] : undefined;
      // Um objeto dentro dele mesmo (ou ciclos) para na profundidade 4.
      if (!obj || (env.depth ?? 0) >= 4) return `<rect x="-40" y="-80" width="80" height="80" fill="none" stroke="#d65f5f" stroke-width="4" stroke-dasharray="10 8"/>`;
      // Objeto animado dentro de outro (ou num cenário): toca a animação padrão no tempo de quem o contém.
      const at = objectPiecesAt(obj, '', env.timeMs ?? 0);
      return renderObjectBody(obj, { ...env, depth: (env.depth ?? 0) + 1, idPrefix: `${env.idPrefix}-${p.id}` }, at.pieces);
    }
    case 'character': return p.character ? renderStaticCharacter(p.character, `${env.idPrefix}-${p.id}`) : '';
  }
}

export function pieceTransform(p: Piece): string {
  const sx = (p.flipX ? -1 : 1) * (p.kind === 'prop' || p.kind === 'object' || p.kind === 'character' ? p.scale : 1);
  const sy = (p.flipY ? -1 : 1) * (p.kind === 'prop' || p.kind === 'object' || p.kind === 'character' ? p.scale : 1);
  return `translate(${n(p.x)} ${n(p.y)})${p.rotation ? ` rotate(${n(p.rotation)})` : ''}${sx !== 1 || sy !== 1 ? ` scale(${n(sx)} ${n(sy)})` : ''}`;
}

/** Desenha uma lista de peças na ordem (a última fica por cima). */
export function renderPieces(pieces: Piece[], env: PieceEnv): string {
  let out = '';
  for (const p of pieces) {
    if (!p.visible) continue;
    const op = Math.min(1, Math.max(0, p.opacity));
    out += `<g data-piece="${esc(p.id)}" transform="${pieceTransform(p)}"${op < 1 ? ` opacity="${n(op)}"` : ''}>${pieceInner(p, env)}</g>`;
  }
  return out;
}

/* ------------------------------ animação própria do objeto (quadros) ------------------------------ */
/** Todas as listas de peças de um objeto: desenho estático + cada quadro de cada animação. */
export const objectPieceLists = (o: CustomObject): Piece[][] => [o.pieces, ...(o.clips ?? []).flatMap((c) => c.frames.map((f) => f.pieces))];

/** Animação efetiva: '' = a padrão do objeto; 'static' (ou inexistente/sem quadros) = desenho estático. */
export function resolveClip(obj: CustomObject, clipId: string): ObjectClip | null {
  const id = clipId === '' ? obj.defaultClip : clipId;
  if (!id || id === 'static') return null;
  const c = (obj.clips ?? []).find((x) => x.id === id);
  return c && c.frames.length ? c : null;
}

export const clipDuration = (c: ObjectClip): number => c.frames.reduce((s, f) => s + f.durationMs, 0);

/**
 * Quadro da animação no tempo local (ms). Função PURA do tempo: prévia, PNG e vídeo pegam o mesmo
 * quadro no mesmo instante, sem relógio nem estado acumulado.
 */
export function clipFrameIndex(c: ObjectClip, localMs: number): number {
  const count = c.frames.length;
  if (count <= 1) return 0;
  const t0 = Number.isFinite(localMs) ? localMs : 0;
  // Sequência tocada: pingue-pongue repete os quadros do meio na volta (0 1 2 3 2 1 | 0 …).
  const fwd = [...c.frames.keys()];
  const order = c.mode === 'pingpong' ? [...fwd, ...fwd.slice(1, -1).reverse()] : fwd;
  const total = order.reduce((s, i) => s + c.frames[i]!.durationMs, 0);
  if (total <= 0) return 0;
  let t: number;
  if (c.mode === 'once') {
    if (t0 >= total) return count - 1;
    t = Math.max(0, t0);
  } else t = ((t0 % total) + total) % total;
  for (const i of order) {
    const d = c.frames[i]!.durationMs;
    if (t < d) return i;
    t -= d;
  }
  return order[order.length - 1]!;
}

/** Peças a desenhar no tempo local; frame = -1 quando é o desenho estático. */
export function objectPiecesAt(obj: CustomObject, clipId: string, localMs: number): { pieces: Piece[]; clip: string; frame: number } {
  const c = resolveClip(obj, clipId);
  if (!c) return { pieces: obj.pieces, clip: 'static', frame: -1 };
  const i = clipFrameIndex(c, localMs);
  return { pieces: c.frames[i]!.pieces, clip: c.id, frame: i };
}

/**
 * Quadros dos objetos animados ANINHADOS numa lista de peças, no tempo dado (ex.: "o1:2(o2:0)").
 * Entra na chave dos caches: o desenho só é refeito quando algum quadro aninhado muda.
 */
export function nestedFrameKey(project: Pick<Project, 'customObjects'>, pieces: Piece[], timeMs: number, depth = 0): string {
  let k = '';
  for (const p of pieces) {
    if (p.kind !== 'object' || !p.refId || depth >= 4) continue;
    const o = project.customObjects[p.refId];
    if (!o) continue;
    const at = objectPiecesAt(o, '', timeMs);
    const inner = nestedFrameKey(project, at.pieces, timeMs, depth + 1);
    if (at.frame >= 0 || inner) k += `${o.id}:${at.frame}${inner ? `(${inner})` : ''};`;
  }
  return k;
}

/** Corpo do objeto: peças deslocadas pelo pivô (o pivô vira a origem do nó na cena). */
export function renderObjectBody(obj: CustomObject, env: PieceEnv, pieces: Piece[] = obj.pieces): string {
  const body = renderPieces(pieces, env);
  return obj.pivotX || obj.pivotY ? `<g transform="translate(${n(-obj.pivotX)} ${n(-obj.pivotY)})">${body}</g>` : body;
}

/**
 * Disponibilidade das imagens usadas por uma lista de peças, inclusive dentro de objetos aninhados.
 * Entra na chave dos caches: relinkar ou carregar uma mídia refaz o desenho.
 */
export function availabilityKey(project: Project, pieces: Piece[], url: PieceEnv['url'], depth = 0): string {
  let k = '';
  for (const p of pieces) {
    if (p.assetId) k += url(p.assetId) ? '1' : '0';
    if (p.character?.def.spriteAssetId) k += url(p.character.def.spriteAssetId) ? '1' : '0';
    if (p.kind === 'object' && p.refId && depth < 4) {
      const o = project.customObjects[p.refId];
      k += o ? `(${availabilityKey(project, o.pieces, url, depth + 1)})` : '?';
    }
  }
  return k;
}

/**
 * Cache dos objetos: preso à REFERÊNCIA de `project.customObjects` (o Immer troca essa referência
 * quando QUALQUER objeto muda). Assim, editar um objeto também refaz os que o contêm e os cenários que o usam.
 */
const objCache = new WeakMap<object, Map<string, string>>();
/**
 * anim = animação e tempo LOCAL da instância (já com velocidade e defasagem). Sem anim, desenha o
 * primeiro quadro da animação padrão (ou o estático): é o "estado inicial" de miniaturas e cenários.
 */
export function renderCustomObject(project: Project, propId: string, url: PieceEnv['url'], nodeId = '', anim?: { clip: string; localMs: number }): string {
  const obj = project.customObjects[customObjectIdOf(propId)];
  if (!obj) return `<rect x="-50" y="-100" width="100" height="100" fill="#3a3f4b" stroke="#d65f5f" stroke-width="4" stroke-dasharray="10 8"/>`;
  const at = objectPiecesAt(obj, anim?.clip ?? '', anim?.localMs ?? 0);
  let m = objCache.get(project.customObjects);
  if (!m) objCache.set(project.customObjects, (m = new Map()));
  const localMs = anim?.localMs ?? 0;
  const key = `${propId}|${nodeId}|${at.clip}:${at.frame}|${nestedFrameKey(project, at.pieces, localMs)}|${availabilityKey(project, at.pieces, url)}`;
  let v = m.get(key);
  if (v === undefined) {
    const body = renderObjectBody(obj, { project, url, idPrefix: `o${nodeId}${at.frame >= 0 ? `f${at.frame}` : ''}`, timeMs: localMs }, at.pieces);
    v = at.frame >= 0 ? `<g data-obj-clip="${esc(at.clip)}" data-obj-frame="${at.frame}">${body}</g>` : body;
    if (m.size > 400) m.clear();
    m.set(key, v);
  }
  return v;
}

export function customObjectBounds(project: Project, propId: string): { x: number; y: number; w: number; h: number } {
  const obj = project.customObjects[customObjectIdOf(propId)];
  if (!obj) return { x: -50, y: -100, w: 100, h: 100 };
  return { x: -obj.width / 2 - obj.pivotX, y: -obj.height - obj.pivotY, w: obj.width, h: obj.height };
}

/* ------------------------------ geometria (seleção e grupos) ------------------------------ */
export type Box = { x: number; y: number; w: number; h: number };
export type Pt2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const usesScale = (p: Piece) => p.kind === 'prop' || p.kind === 'object' || p.kind === 'character';

/** Caixa da peça no espaço dela (antes de girar, espelhar e escalar). */
export function pieceLocalBox(p: Piece, project: Project): Box {
  if (p.kind === 'prop' && p.refId) {
    const d = getProp(p.refId);
    return d ? propBounds(d) : { x: -50, y: -100, w: 100, h: 100 };
  }
  if (p.kind === 'object' && p.refId) return customObjectBounds(project, OBJECT_PREFIX + p.refId);
  if (p.kind === 'character') return { x: -110, y: -560, w: 220, h: 560 };
  // Linha fina: área de toque mínima para dar para selecionar.
  if (p.kind === 'line') return { x: -p.w / 2, y: -Math.max(16, p.strokeWidth) / 2, w: p.w, h: Math.max(16, p.strokeWidth) };
  return { x: -p.w / 2, y: -p.h / 2, w: p.w, h: p.h };
}

const factors = (p: Piece): [number, number] => {
  const k = usesScale(p) ? Math.max(1e-6, p.scale) : 1;
  return [(p.flipX ? -1 : 1) * k, (p.flipY ? -1 : 1) * k];
};

/** Do espaço da peça para o mundo (mesma ordem do SVG: translate, rotate, scale). */
export function pieceToWorld(p: Piece, lx: number, ly: number): Pt2 {
  const [sx, sy] = factors(p);
  const x = lx * sx;
  const y = ly * sy;
  const c = Math.cos(rad(p.rotation));
  const s = Math.sin(rad(p.rotation));
  return [p.x + x * c - y * s, p.y + x * s + y * c];
}

/** Do mundo para o espaço da peça (inverso de pieceToWorld). */
export function pieceFromWorld(p: Piece, wx: number, wy: number): Pt2 {
  const [sx, sy] = factors(p);
  const dx = wx - p.x;
  const dy = wy - p.y;
  const c = Math.cos(rad(-p.rotation));
  const s = Math.sin(rad(-p.rotation));
  return [(dx * c - dy * s) / sx, (dx * s + dy * c) / sy];
}

/** Os 4 cantos da peça no mundo (acompanham rotação, espelho e escala). */
export function pieceCorners(p: Piece, project: Project): Pt2[] {
  const b = pieceLocalBox(p, project);
  return ([[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]] as Pt2[]).map(([x, y]) => pieceToWorld(p, x, y));
}

/** O ponto do mundo está dentro da peça (considerando a rotação)? */
export function pieceHit(p: Piece, project: Project, wx: number, wy: number): boolean {
  const b = pieceLocalBox(p, project);
  const [lx, ly] = pieceFromWorld(p, wx, wy);
  return lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h;
}

export const boundsOfPoints = (pts: Pt2[]): Box => {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

/** Caixa alinhada aos eixos que contém a peça girada. */
export function pieceBox(p: Piece, project: Project): Box {
  return boundsOfPoints(pieceCorners(p, project));
}

/** Caixa que contém todas as peças (a "caixa do grupo"). */
export function selectionBox(pieces: Piece[], project: Project): Box | null {
  if (!pieces.length) return null;
  return boundsOfPoints(pieces.flatMap((p) => pieceCorners(p, project)));
}

/**
 * Pivô do grupo: média dos centros visuais das peças. Ao girar ou escalar, esse ponto não se move,
 * então repetir a operação não faz o grupo "andar" (o centro da caixa, sim, mudaria a cada giro).
 */
export function groupPivot(pieces: Piece[], project: Project): Pt2 {
  let sx = 0;
  let sy = 0;
  for (const p of pieces) {
    const b = pieceLocalBox(p, project);
    const [x, y] = pieceToWorld(p, b.x + b.w / 2, b.y + b.h / 2);
    sx += x;
    sy += y;
  }
  return [sx / pieces.length, sy / pieces.length];
}

export interface GroupOp { rotate?: number; scale?: number; dx?: number; dy?: number }
/**
 * Move, gira e escala as peças como UM bloco, em torno do pivô do grupo.
 * Girar soma o ângulo a cada peça e gira a posição dela em torno do centro; escalar multiplica
 * posição e tamanho. Funciona também para peças já giradas ou espelhadas.
 */
export function transformPieces(pieces: Piece[], project: Project, op: GroupOp): void {
  if (!pieces.length) return;
  const [cx, cy] = groupPivot(pieces, project);
  const a = rad(op.rotate ?? 0);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = op.scale ?? 1;
  for (const p of pieces) {
    const rx = (p.x - cx) * k;
    const ry = (p.y - cy) * k;
    p.x = Math.round((cx + rx * c - ry * s + (op.dx ?? 0)) * 100) / 100;
    p.y = Math.round((cy + rx * s + ry * c + (op.dy ?? 0)) * 100) / 100;
    if (op.rotate) p.rotation = normalizeAngle(p.rotation + op.rotate);
    if (k !== 1) {
      if (usesScale(p)) p.scale = Math.min(20, Math.max(0.02, p.scale * k));
      else {
        p.w = Math.max(1, p.w * k);
        p.h = Math.max(1, p.h * k);
      }
    }
  }
}

/** Ângulo no intervalo (−180, 180], com 2 casas. */
export function normalizeAngle(d: number): number {
  let v = ((d + 180) % 360 + 360) % 360 - 180;
  if (v === -180) v = 180;
  return Math.round(v * 100) / 100;
}

/** Todas as listas de peças do projeto (objetos e composições de cenário). */
export function allPieceLists(p: Project): Piece[][] {
  const lists: Piece[][] = Object.values(p.customObjects).flatMap(objectPieceLists);
  for (const b of Object.values(p.customBackgrounds)) for (const c of Object.values(b.compositions ?? {})) if (c) lists.push(c.pieces);
  return lists;
}

/** IDs de mídia usados por peças (imagens e personagens com sprite). */
export function pieceAssetIds(p: Project): string[] {
  const out: string[] = [];
  for (const list of allPieceLists(p)) for (const pc of list) {
    if (pc.assetId) out.push(pc.assetId);
    if (pc.character?.def.spriteAssetId) out.push(pc.character.def.spriteAssetId);
  }
  return out;
}

export function remapPieceAssets(p: Project, m: (id: string) => string): void {
  for (const list of allPieceLists(p)) for (const pc of list) {
    if (pc.assetId) pc.assetId = m(pc.assetId);
    if (pc.character?.def.spriteAssetId) pc.character.def.spriteAssetId = m(pc.character.def.spriteAssetId);
  }
}

/** Uso de um objeto personalizado: nós nas cenas + peças em cenários e outros objetos. */
export function customObjectUsage(p: Project, objectId: string): number {
  let count = 0;
  for (const s of Object.values(p.scenes)) for (const nd of Object.values(s.nodes)) if (nd.kind === 'prop' && nd.propId === OBJECT_PREFIX + objectId) count++;
  for (const list of allPieceLists(p)) count += list.filter((pc) => pc.kind === 'object' && pc.refId === objectId).length;
  return count;
}

/** Composição vazia, ou cópia editável de outra (para começar um horário a partir de outro). */
export function cloneComposition(c: Composition | undefined): Composition {
  return c ? { sky: c.sky, pieces: c.pieces.map((p) => ({ ...deepClone(p), id: uid('pc') })) } : { sky: '#9fd3f0', pieces: [] };
}
