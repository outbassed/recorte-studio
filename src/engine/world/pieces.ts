/**
 * Peças 2D: base do Criador de Objetos e do Criador de Cenários.
 * Mesmo desenho na prévia, no editor e na exportação (string SVG determinística).
 */
import type { CharacterDefinition, Composition, CustomObject, Piece, PieceKind, Project, StaticCharacter } from '../model/schema';
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
      return renderObjectBody(obj, { ...env, depth: (env.depth ?? 0) + 1, idPrefix: `${env.idPrefix}-${p.id}` });
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

/** Corpo do objeto: peças deslocadas pelo pivô (o pivô vira a origem do nó na cena). */
export function renderObjectBody(obj: CustomObject, env: PieceEnv): string {
  const body = renderPieces(obj.pieces, env);
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
export function renderCustomObject(project: Project, propId: string, url: PieceEnv['url'], nodeId = ''): string {
  const obj = project.customObjects[customObjectIdOf(propId)];
  if (!obj) return `<rect x="-50" y="-100" width="100" height="100" fill="#3a3f4b" stroke="#d65f5f" stroke-width="4" stroke-dasharray="10 8"/>`;
  let m = objCache.get(project.customObjects);
  if (!m) objCache.set(project.customObjects, (m = new Map()));
  const key = `${propId}|${nodeId}|${availabilityKey(project, obj.pieces, url)}`;
  let v = m.get(key);
  if (v === undefined) {
    v = renderObjectBody(obj, { project, url, idPrefix: `o${nodeId}` });
    if (m.size > 200) m.clear();
    m.set(key, v);
  }
  return v;
}

export function customObjectBounds(project: Project, propId: string): { x: number; y: number; w: number; h: number } {
  const obj = project.customObjects[customObjectIdOf(propId)];
  if (!obj) return { x: -50, y: -100, w: 100, h: 100 };
  return { x: -obj.width / 2 - obj.pivotX, y: -obj.height - obj.pivotY, w: obj.width, h: obj.height };
}

/** Caixa aproximada de uma peça (para seleção no editor). */
export function pieceBox(p: Piece, project: Project): { x: number; y: number; w: number; h: number } {
  if (p.kind === 'prop' && p.refId) {
    const d = getProp(p.refId);
    const b = d ? propBounds(d) : { x: -50, y: -100, w: 100, h: 100 };
    return { x: p.x + b.x * p.scale, y: p.y + b.y * p.scale, w: b.w * p.scale, h: b.h * p.scale };
  }
  if (p.kind === 'object' && p.refId) {
    const b = customObjectBounds(project, OBJECT_PREFIX + p.refId);
    return { x: p.x + b.x * p.scale, y: p.y + b.y * p.scale, w: b.w * p.scale, h: b.h * p.scale };
  }
  if (p.kind === 'character') return { x: p.x - 110 * p.scale, y: p.y - 560 * p.scale, w: 220 * p.scale, h: 560 * p.scale };
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}

/** Todas as listas de peças do projeto (objetos e composições de cenário). */
export function allPieceLists(p: Project): Piece[][] {
  const lists: Piece[][] = Object.values(p.customObjects).map((o) => o.pieces);
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
