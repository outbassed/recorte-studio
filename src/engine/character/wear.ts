/**
 * Roupas e cabelos criados (Fase 3b).
 *
 * Uma peça (Wearable) tem camadas; cada camada fica PRESA a uma parte do corpo (cabeça, tronco, quadril,
 * braço, antebraço, coxa, canela) e é desenhada DENTRO do grupo dessa parte no renderizador do personagem.
 * Por isso acompanha pose, vista, animação, sentar e balançar sem "flutuar".
 *
 * As camadas são desenhadas no tamanho de um corpo de referência (adulto padrão, vista de frente). Em cada
 * personagem e vista, a camada é escalada pela razão entre a parte real e a de referência: serve em
 * crianças, corpos largos, perfis (tronco mais estreito) etc. sem redesenhar.
 */
import { CharacterDefinitionSchema, WearableSchema, type CharacterDefinition, type Piece, type Project, type Wearable, type WearAnchor, type WearLayer } from '../model/schema';
import { deepClone, uid } from '../model/ids';
import { n } from '../render/svg';
import { renderPieces, createPiece } from '../world/pieces';
import { bodyMetrics, type BodyMetrics } from './render';
import type { ViewInfo } from './views';

/** Cobertura neutra (manequim e personagem cuja roupa nativa foi substituída): opaca, sem detalhes. */
export const BASE_COVER = '#9a948c';

export const ANCHOR_LABELS: Record<WearAnchor, string> = {
  head: 'Cabeça', torso: 'Tronco', hips: 'Quadril', upperArm: 'Braços', forearm: 'Antebraços', thigh: 'Coxas', shin: 'Canelas',
};

let refCache: BodyMetrics | null = null;
/** Medidas do corpo de referência (adulto padrão): é nele que as camadas são desenhadas. */
export function refMetrics(): BodyMetrics {
  if (!refCache) refCache = bodyMetrics(CharacterDefinitionSchema.parse({ id: 'ref', name: 'Referência' }));
  return refCache;
}
export const refHalfShoulder = () => refMetrics().shoulderW / 2;
export const refHalfHip = () => refMetrics().hipW / 2 + 8;

/** Peças vetoriais apenas (sem imagem, objeto ou personagem): roupas e cabelos não dependem de mídia externa. */
export const WEAR_PIECE_KINDS: Piece['kind'][] = ['rect', 'ellipse', 'triangle', 'trapezoid', 'polygon', 'star', 'line', 'text'];

const NO_PROJECT = { customObjects: {}, assets: {} } as unknown as Project;

/** Camada visível nesta vista? */
export function layerVisible(l: WearLayer, v: ViewInfo): boolean {
  return l.side === 'both' || (l.side === 'front') === v.showsFace;
}

/**
 * Desenha uma camada no quadro de uma parte: origem e escala da parte REAL; deslocamento opcional
 * para o lado em que o personagem está virado e espelhamento quando virado para a esquerda.
 */
export function renderLayer(l: WearLayer, frame: { x: number; y: number; sx: number; sy: number; turnUnit: number }, v: ViewInfo, idp: string): string {
  const turnK = v.cls === 'profile' ? 0.55 : v.cls === 'quarter' ? 0.32 : v.cls === 'backQuarter' ? 0.18 : 0;
  const dx = l.followTurn ? v.facing * turnK * frame.turnUnit * frame.sx : 0;
  const mx = l.mirror && v.facing < 0 ? -1 : 1;
  const pieces = l.pieces.filter((p) => WEAR_PIECE_KINDS.includes(p.kind)) as Piece[];
  return `<g data-wear-layer="${l.id}" transform="translate(${n(frame.x + dx)} ${n(frame.y)}) scale(${(frame.sx * mx).toFixed(4)} ${frame.sy.toFixed(4)})">${renderPieces(pieces, { project: NO_PROJECT, url: () => undefined, idPrefix: `${idp}${l.id}` })}</g>`;
}

/** Todas as camadas de uma parte (de todas as peças vestidas, na ordem), filtradas por vista e profundidade. */
export function wearAt(wear: Wearable[], anchor: WearAnchor, v: ViewInfo, frame: Parameters<typeof renderLayer>[1], idp: string, depth?: WearLayer['depth']): string {
  let out = '';
  for (const w of wear) for (const l of w.layers) {
    if (l.anchor !== anchor || !layerVisible(l, v)) continue;
    if (depth && l.depth !== depth) continue;
    out += renderLayer(l, frame, v, `${idp}${w.id}`);
  }
  return out;
}

/** Profundidade efetiva de uma camada da cabeça: de costas, a parte "de trás" do cabelo é a que se vê por cima. */
export function headDepth(l: WearLayer, v: ViewInfo): WearLayer['depth'] {
  if (l.depth === 'behindBody') return 'behindBody';
  const back = v.cls === 'back' || v.cls === 'backQuarter';
  if (!back) return l.depth;
  return l.depth === 'front' ? 'behindHead' : 'front';
}

/** Efeito das peças vestidas no visual nativo. */
export function wearHides(wear: Wearable[]): { top: boolean; bottom: boolean; hair: boolean } {
  return { top: wear.some((w) => w.hides.top), bottom: wear.some((w) => w.hides.bottom), hair: wear.some((w) => w.hides.hair) };
}

/* ------------------------------ guias do corpo de referência (editor) ------------------------------ */
/** Contorno da parte de referência, no quadro da camada: onde desenhar para encaixar. */
export function anchorGuide(anchor: WearAnchor): { svg: string; box: { x: number; y: number; w: number; h: number } } {
  const m = refMetrics();
  const g = `fill="#ffffff" fill-opacity=".08" stroke="#7fc8ff" stroke-width="2" stroke-dasharray="8 6"`;
  switch (anchor) {
    case 'head': return { svg: `<ellipse cx="0" cy="0" rx="${n(m.rx)}" ry="${n(m.ry)}" ${g}/><path d="M-30 20h60" stroke="#7fc8ff" stroke-opacity=".5" stroke-width="2"/>`, box: { x: -m.rx * 1.9, y: -m.ry * 1.9, w: m.rx * 3.8, h: m.ry * 4.4 } };
    case 'torso': {
      const hs = refHalfShoulder();
      const hh = refHalfHip();
      return { svg: `<path d="M${n(-hs * 0.55)} ${n(-m.torso + 2)}L${n(-hs)} ${n(-m.torso + 20)}L${n(-hh)} 8L${n(hh)} 8L${n(hs)} ${n(-m.torso + 20)}L${n(hs * 0.55)} ${n(-m.torso + 2)}Z" ${g}/>`, box: { x: -hs * 1.8, y: -m.torso - 60, w: hs * 3.6, h: m.torso + 140 } };
    }
    case 'hips': {
      const hh = refHalfHip();
      return { svg: `<path d="M${n(-hh)} -4L${n(hh)} -4L${n(hh * 0.8)} ${n(m.thigh)}L${n(-hh * 0.8)} ${n(m.thigh)}Z" ${g}/>`, box: { x: -hh * 2.4, y: -60, w: hh * 4.8, h: m.thigh + m.shin + 80 } };
    }
    case 'upperArm': case 'forearm': {
      const len = anchor === 'upperArm' ? m.upperArm : m.forearm;
      return { svg: `<rect x="${n(-m.limbW / 2)}" y="0" width="${n(m.limbW)}" height="${n(len)}" rx="${n(m.limbW / 2)}" ${g}/>`, box: { x: -len * 0.9, y: -30, w: len * 1.8, h: len + 60 } };
    }
    case 'thigh': case 'shin': {
      const len = anchor === 'thigh' ? m.thigh : m.shin;
      return { svg: `<rect x="${n(-m.legW / 2)}" y="0" width="${n(m.legW)}" height="${n(len)}" rx="${n(m.legW / 2)}" ${g}/>`, box: { x: -len * 0.9, y: -30, w: len * 1.8, h: len + 60 } };
    }
  }
}

/* ------------------------------ pontos de partida (editáveis) ------------------------------ */
const P = (kind: Piece['kind'], name: string, o: Partial<Piece>): Piece => createPiece(kind, { name, ...o });
const L = (anchor: WearAnchor, name: string, pieces: Piece[], o: Partial<WearLayer> = {}): WearLayer => ({ id: uid('wl'), name, anchor, depth: 'front', side: 'both', followTurn: false, mirror: false, pieces, ...o });
const stroke = { stroke: '#23202b', strokeWidth: 4 };

export interface WearStarter { id: string; label: string; kind: Wearable['kind']; category: string; make: (color: string) => Pick<Wearable, 'hides' | 'layers'> }
const sleeveShort = (c: string) => L('upperArm', 'Mangas', [P('rect', 'Manga', { x: 0, y: 22, w: 36, h: 46, radius: 10, fill: c, ...stroke })]);
const sleeveLong = (c: string) => [L('upperArm', 'Mangas', [P('rect', 'Manga', { x: 0, y: 38, w: 34, h: 82, radius: 10, fill: c, ...stroke })]), L('forearm', 'Punhos', [P('rect', 'Manga', { x: 0, y: 34, w: 30, h: 72, radius: 8, fill: c, ...stroke })])];
const torsoBody = (c: string) => P('trapezoid', 'Corpo', { x: 0, y: -80, w: 128, h: 172, taper: 1.18, fill: c, ...stroke });
const legs = (c: string, long: boolean) => [
  L('hips', 'Cós', [P('rect', 'Cós', { x: 0, y: 8, w: 126, h: 36, radius: 8, fill: c, ...stroke })]),
  L('thigh', 'Coxas', [P('rect', 'Perna', { x: 0, y: long ? 42 : 28, w: 42, h: long ? 92 : 60, radius: 8, fill: c, ...stroke })]),
  ...(long ? [L('shin', 'Canelas', [P('rect', 'Perna', { x: 0, y: 38, w: 38, h: 82, radius: 8, fill: c, ...stroke })])] : []),
];
export const WEAR_STARTERS: WearStarter[] = [
  { id: 'empty-clothing', label: 'Vazio (do zero)', kind: 'clothing', category: '', make: () => ({ hides: { top: false, bottom: false, hair: false }, layers: [L('torso', 'Tronco', [])] }) },
  { id: 'tshirt', label: 'Camiseta', kind: 'clothing', category: 'Camiseta', make: (c) => ({ hides: { top: true, bottom: false, hair: false }, layers: [L('torso', 'Tronco', [torsoBody(c), P('ellipse', 'Gola', { x: 0, y: -160, w: 54, h: 20, fill: '#00000033', stroke: 'none', strokeWidth: 0 })]), sleeveShort(c)] }) },
  { id: 'shirt', label: 'Camisa de manga longa', kind: 'clothing', category: 'Camisa', make: (c) => ({ hides: { top: true, bottom: false, hair: false }, layers: [L('torso', 'Tronco', [torsoBody(c)]), L('torso', 'Gola e botões (frente)', [P('triangle', 'Gola', { x: 0, y: -150, w: 60, h: 34, rotation: 180, fill: '#f4f1ea', ...stroke }), ...[0, 1, 2, 3].map((i) => P('ellipse', `Botão ${i + 1}`, { x: 0, y: -120 + i * 30, w: 8, h: 8, fill: '#23202b', stroke: 'none', strokeWidth: 0 }))], { side: 'front', followTurn: true }), ...sleeveLong(c)] }) },
  { id: 'coat', label: 'Casaco aberto', kind: 'clothing', category: 'Casaco', make: (c) => ({ hides: { top: false, bottom: false, hair: false }, layers: [L('torso', 'Tronco', [P('trapezoid', 'Lado esquerdo', { x: -40, y: -80, w: 52, h: 176, taper: 1.2, fill: c, ...stroke }), P('trapezoid', 'Lado direito', { x: 40, y: -80, w: 52, h: 176, taper: 1.2, fill: c, ...stroke })]), ...sleeveLong(c), L('hips', 'Barra', [P('trapezoid', 'Barra', { x: 0, y: 30, w: 150, h: 64, taper: 0.86, fill: c, ...stroke })])] }) },
  { id: 'dress', label: 'Vestido', kind: 'clothing', category: 'Vestido', make: (c) => ({ hides: { top: true, bottom: true, hair: false }, layers: [L('torso', 'Tronco', [torsoBody(c)]), L('hips', 'Saia', [P('trapezoid', 'Saia', { x: 0, y: 52, w: 210, h: 116, taper: 0.6, fill: c, ...stroke })])] }) },
  { id: 'pants', label: 'Calça', kind: 'clothing', category: 'Calça', make: (c) => ({ hides: { top: false, bottom: true, hair: false }, layers: legs(c, true) }) },
  { id: 'shorts', label: 'Shorts / bermuda', kind: 'clothing', category: 'Shorts', make: (c) => ({ hides: { top: false, bottom: true, hair: false }, layers: legs(c, false) }) },
  { id: 'skirt', label: 'Saia', kind: 'clothing', category: 'Saia', make: (c) => ({ hides: { top: false, bottom: true, hair: false }, layers: [L('hips', 'Saia', [P('trapezoid', 'Saia', { x: 0, y: 42, w: 176, h: 96, taper: 0.7, fill: c, ...stroke })])] }) },
  { id: 'overalls', label: 'Macacão', kind: 'clothing', category: 'Macacão', make: (c) => ({ hides: { top: false, bottom: true, hair: false }, layers: [L('torso', 'Peito', [P('rect', 'Peitilho', { x: 0, y: -60, w: 96, h: 116, radius: 8, fill: c, ...stroke }), P('line', 'Alça E', { x: -40, y: -140, w: 70, h: 8, rotation: 80, stroke: c, strokeWidth: 12 }), P('line', 'Alça D', { x: 40, y: -140, w: 70, h: 8, rotation: 100, stroke: c, strokeWidth: 12 })]), ...legs(c, true)] }) },
  { id: 'empty-hair', label: 'Vazio (do zero)', kind: 'hair', category: '', make: () => ({ hides: { top: false, bottom: false, hair: true }, layers: [L('head', 'Frente', [])] }) },
  { id: 'hair-short', label: 'Curto', kind: 'hair', category: 'Cabelo curto', make: (c) => ({ hides: { top: false, bottom: false, hair: true }, layers: [
    L('head', 'Volume de trás', [P('ellipse', 'Volume', { x: 0, y: -18, w: 236, h: 250, fill: c, ...stroke })], { depth: 'behindHead' }),
    L('head', 'Topo e franja', [P('ellipse', 'Topo', { x: 0, y: -80, w: 226, h: 104, fill: c, ...stroke }), P('trapezoid', 'Franja', { x: 18, y: -54, w: 110, h: 30, taper: 1.5, fill: c, stroke: 'none', strokeWidth: 0 })], { followTurn: true, mirror: true }),
  ] }) },
  { id: 'hair-long', label: 'Longo liso', kind: 'hair', category: 'Cabelo longo', make: (c) => ({ hides: { top: false, bottom: false, hair: true }, layers: [
    L('head', 'Comprimento (costas)', [P('rect', 'Comprimento', { x: 0, y: 150, w: 228, h: 300, radius: 70, fill: c, ...stroke })], { depth: 'behindBody' }),
    L('head', 'Volume de trás', [P('ellipse', 'Volume', { x: 0, y: -10, w: 240, h: 260, fill: c, ...stroke })], { depth: 'behindHead' }),
    L('head', 'Topo', [P('ellipse', 'Topo', { x: 0, y: -82, w: 228, h: 100, fill: c, ...stroke }), P('rect', 'Mecha E', { x: -104, y: 30, w: 34, h: 170, radius: 16, fill: c, ...stroke }), P('rect', 'Mecha D', { x: 104, y: 30, w: 34, h: 170, radius: 16, fill: c, ...stroke })], { side: 'front' }),
  ] }) },
  { id: 'hair-curly', label: 'Cacheado', kind: 'hair', category: 'Cabelo cacheado', make: (c) => ({ hides: { top: false, bottom: false, hair: true }, layers: [
    L('head', 'Volume', [P('ellipse', 'Volume', { x: 0, y: -26, w: 270, h: 270, fill: c, ...stroke })], { depth: 'behindHead' }),
    L('head', 'Cachos', [-90, -45, 0, 45, 90].map((x, i) => P('ellipse', `Cacho ${i + 1}`, { x, y: -96 + Math.abs(x) * 0.35, w: 64, h: 60, fill: c, ...stroke }))),
  ] }) },
  { id: 'hair-afro', label: 'Crespo volumoso', kind: 'hair', category: 'Cabelo crespo', make: (c) => ({ hides: { top: false, bottom: false, hair: true }, layers: [
    L('head', 'Volume', [P('ellipse', 'Volume', { x: 0, y: -46, w: 330, h: 310, fill: c, ...stroke })], { depth: 'behindHead' }),
    L('head', 'Linha da testa', [P('ellipse', 'Topo', { x: 0, y: -92, w: 220, h: 80, fill: c, stroke: 'none', strokeWidth: 0 })]),
  ] }) },
  { id: 'hair-bun', label: 'Preso (coque)', kind: 'hair', category: 'Cabelo preso', make: (c) => ({ hides: { top: false, bottom: false, hair: true }, layers: [
    L('head', 'Volume de trás', [P('ellipse', 'Volume', { x: 0, y: -24, w: 228, h: 238, fill: c, ...stroke })], { depth: 'behindHead' }),
    L('head', 'Topo e coque', [P('ellipse', 'Topo', { x: 0, y: -84, w: 222, h: 92, fill: c, ...stroke }), P('ellipse', 'Coque', { x: 0, y: -142, w: 92, h: 78, fill: c, ...stroke })]),
  ] }) },
];

export function newWearable(kind: Wearable['kind'], name: string, starterId?: string, color = kind === 'hair' ? '#3a2b28' : '#5b8dbe'): Wearable {
  const st = WEAR_STARTERS.find((s) => s.id === starterId && s.kind === kind) ?? WEAR_STARTERS.find((s) => s.kind === kind && s.id.startsWith('empty'))!;
  const made = st.make(color);
  const now = Date.now();
  return WearableSchema.parse({ id: uid(kind === 'hair' ? 'hair' : 'roupa'), name, kind, category: st.category, hides: made.hides, layers: made.layers, createdAt: now, updatedAt: now });
}

/* ------------------------------ manequins ------------------------------ */
export interface Mannequin { id: string; label: string; def: CharacterDefinition }
const mq = (id: string, label: string, body: Partial<CharacterDefinition['body']>): Mannequin => ({
  id, label,
  def: CharacterDefinitionSchema.parse({
    id: `mq_${id}`, name: `Manequim ${label.toLowerCase()}`, skin: '#d9cfc3', outlineColor: '#4a4540',
    body, face: { eyes: 'small', brows: 'none', nose: 'small', mouth: 'simple', lipColor: '#b8a99a', eyeColor: '#6b645c' },
    hair: { style: 'bald', color: '#9a948c' },
    outfit: { top: 'base', bottom: 'base', shoes: 'sneakers', shoeColor: '#8a847c' },
  }),
});
/** Manequins de referência (corpo neutro, cobertura opaca no peito e no quadril; nunca nudez). */
export const MANNEQUINS: Mannequin[] = [
  mq('adulto', 'Adulto', {}),
  mq('robusto', 'Robusto', { build: 1.3, belly: 0.5 }),
  mq('esguio', 'Esguio', { build: 0.85, height: 1.06 }),
  mq('adolescente', 'Adolescente', { age: 'teen' }),
  mq('crianca', 'Criança', { age: 'child' }),
  mq('idoso', 'Idoso', { age: 'elder' }),
];

/** Aplica (ou atualiza) uma peça num personagem: substitui a do mesmo ID e, se for cabelo, o outro cabelo criado. */
export function wearOn(def: CharacterDefinition, w: Wearable): void {
  def.wear = def.wear.filter((x) => x.id !== w.id && !(w.kind === 'hair' && x.kind === 'hair'));
  def.wear.push(deepClone(w));
}
