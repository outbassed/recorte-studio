/**
 * Cabelos paramétricos: cada estilo é descrito por uma LINHA DO COURO CABELUDO em
 * função do azimute na cabeça. Para cada vista o gerador recorta o trecho visível
 * dessa linha, o que mantém franjas e repartes do mesmo lado do personagem em
 * todas as vistas (sem espelhar a mecha artificialmente).
 *
 * Layers: `back` fica atrás da cabeça (ou por cima do tronco nas vistas de costas)
 * e `front` fica por cima do rosto.
 */
import { clamp, n, path, shade, smoothPath, type Pt } from '../render/svg';
import { azX, azZ, type ViewInfo } from './views';

export type Edge = 'smooth' | 'spiky' | 'scallop' | 'wave' | 'fuzzy';

/** Tabela [azimute absoluto, y] para cada lado. y em frações de ry (−1 topo, 1 queixo). */
type LineTable = Array<[number, number]>;

interface Lock {
  /** azimute da raiz */
  az: number;
  /** y da raiz em frações de ry */
  y: number;
  /** comprimento em frações de ry */
  len: number;
  /** largura em px */
  w: number;
  /** ondulação */
  wave?: number;
  /** 'front' desenha por cima do rosto; 'auto' usa a profundidade */
  layer?: 'auto' | 'front';
  /** desvio lateral da ponta, em px, relativo ao lado da tela */
  drift?: number;
  band?: boolean;
  braid?: boolean;
}

interface Blob {
  az: number;
  y: number;
  r: number;
  /** distância radial da raiz, frações de rx */
  dist?: number;
  scallop?: boolean;
}

export interface HairStyleDef {
  id: string;
  label: string;
  keywords: string[];
  bald?: boolean;
  /** cobertura mínima: risco de cabelo pintado sem volume */
  flat?: boolean;
  /** volume no topo (frações de ry) */
  volume: number;
  /** volume nas laterais (frações de rx) */
  sideVolume: number;
  edge: Edge;
  edgeAmp: number;
  edgeCount: number;
  /** linha para o lado az>0 (direita da tela quando de frente) */
  lineR: LineTable;
  /** linha para o lado az<0; padrão: igual a lineR */
  lineL?: LineTable;
  /** dentes na franja */
  fringeTeeth?: number;
  /** cabelo que cai atrás, em frações de ry abaixo do centro da cabeça */
  backLen: number;
  backWidth: number;
  backEdge: Edge;
  locks: Lock[];
  blobs: Blob[];
  mohawk?: boolean;
  /** altura vertical extra que colide com chapéus */
  tall?: boolean;
  /** topo raspado e laterais: linha sem coroa */
  crownBald?: boolean;
}

const LINE = {
  short: [[0, -0.62], [35, -0.6], [65, -0.5], [90, -0.2], [125, 0.22], [180, 0.42]] as LineTable,
  crew: [[0, -0.66], [35, -0.64], [65, -0.56], [90, -0.28], [125, 0.1], [180, 0.28]] as LineTable,
  fringe: [[0, -0.42], [40, -0.42], [65, -0.42], [90, -0.05], [125, 0.32], [180, 0.5]] as LineTable,
  long: [[0, -0.6], [35, -0.55], [62, -0.42], [80, 0.45], [100, 0.8], [180, 0.9]] as LineTable,
  mid: [[0, -0.58], [35, -0.54], [62, -0.42], [80, 0.2], [100, 0.5], [180, 0.74]] as LineTable,
  sidepartHeavy: [[0, -0.56], [35, -0.46], [65, -0.42], [90, 0.05], [125, 0.26], [180, 0.42]] as LineTable,
  sidepartLight: [[0, -0.6], [30, -0.68], [65, -0.56], [90, -0.2], [125, 0.2], [180, 0.42]] as LineTable,
  receding: [[0, -0.8], [22, -0.86], [40, -0.56], [65, -0.5], [90, -0.2], [125, 0.2], [180, 0.42]] as LineTable,
  high: [[0, -0.78], [40, -0.74], [80, -0.54], [110, -0.1], [180, 0.26]] as LineTable,
  bangsLong: [[0, -0.42], [40, -0.42], [62, -0.42], [80, 0.45], [100, 0.8], [180, 0.9]] as LineTable,
};

const none: Lock[] = [];
const noBlobs: Blob[] = [];

const style = (id: string, label: string, keywords: string[], o: Partial<HairStyleDef> & { lineR: LineTable }): HairStyleDef => ({
  id, label, keywords, volume: 0.08, sideVolume: 0.05, edge: 'smooth', edgeAmp: 0, edgeCount: 0, backLen: 0, backWidth: 1,
  backEdge: 'smooth', locks: none, blobs: noBlobs, ...o,
});

export const HAIR_STYLES: HairStyleDef[] = [
  style('short', 'Curto clássico', ['curto', 'simples'], { lineR: LINE.short, volume: 0.1 }),
  style('buzz', 'Raspado', ['raspado', 'maquina', 'zero'], { lineR: LINE.crew, flat: true, volume: 0.015, sideVolume: 0.01 }),
  style('fade', 'Degradê', ['degrade', 'fade', 'navalhado'], { lineR: [[0, -0.66], [35, -0.62], [70, -0.55], [90, -0.45], [125, -0.2], [180, -0.05]], volume: 0.16, sideVolume: 0 }),
  style('crew', 'Militar', ['militar', 'reco', 'quadrado'], { lineR: LINE.crew, volume: 0.05, sideVolume: 0.02, edge: 'fuzzy', edgeAmp: 3, edgeCount: 34 }),
  style('messy', 'Bagunçado', ['baguncado', 'despenteado'], { lineR: [[0, -0.5], [28, -0.6], [60, -0.46], [90, -0.12], [125, 0.2], [180, 0.42]], volume: 0.17, sideVolume: 0.1, edge: 'spiky', edgeAmp: 17, edgeCount: 15, fringeTeeth: 7 }),
  style('spiky', 'Espetado', ['espetado', 'pontas', 'arrepiado'], { lineR: LINE.short, volume: 0.12, sideVolume: 0.05, edge: 'spiky', edgeAmp: 32, edgeCount: 11 }),
  style('sidepart', 'Dividido na lateral', ['dividido', 'risca', 'lateral', 'repartido'], { lineR: LINE.sidepartHeavy, lineL: LINE.sidepartLight, volume: 0.14 }),
  style('slick', 'Penteado para trás', ['gel', 'para tras', 'lambido'], { lineR: LINE.high, volume: 0.1, sideVolume: 0.01 }),
  style('fringe', 'Franja reta', ['franja'], { lineR: LINE.fringe, volume: 0.1, sideVolume: 0.07 }),
  style('curtains', 'Franja cortina', ['cortina', 'meio', 'repartido ao meio'], {
    lineR: [[0, -0.74], [20, -0.5], [45, -0.42], [70, 0.05], [90, 0.26], [125, 0.42], [180, 0.52]], volume: 0.1, sideVolume: 0.08,
  }),
  style('bob', 'Chanel', ['chanel', 'bob'], { lineR: LINE.mid, volume: 0.1, sideVolume: 0.13, backLen: 0.78, backWidth: 1.18 }),
  style('bobfringe', 'Chanel com franja', ['chanel com franja', 'bob franja'], {
    lineR: [[0, -0.42], [40, -0.42], [62, -0.42], [80, 0.2], [100, 0.5], [180, 0.74]], volume: 0.1, sideVolume: 0.13, backLen: 0.78, backWidth: 1.18,
  }),
  style('medium', 'Médio liso', ['medio', 'ombro'], { lineR: LINE.mid, volume: 0.09, sideVolume: 0.09, backLen: 1.5, backWidth: 1.1 }),
  style('long', 'Longo liso', ['longo', 'comprido', 'liso'], { lineR: LINE.long, volume: 0.1, sideVolume: 0.1, backLen: 2.5, backWidth: 1.16 }),
  style('longbangs', 'Longo com franja', ['longo franja', 'comprido com franja'], { lineR: LINE.bangsLong, volume: 0.1, sideVolume: 0.1, backLen: 2.5, backWidth: 1.16 }),
  style('wavy', 'Ondulado', ['ondulado', 'ondas'], { lineR: LINE.long, volume: 0.14, sideVolume: 0.15, edge: 'wave', edgeAmp: 6, edgeCount: 12, backLen: 2.05, backWidth: 1.28, backEdge: 'wave' }),
  style('curly', 'Cacheado curto', ['cacheado', 'cachos'], { lineR: [[0, -0.52], [30, -0.5], [60, -0.44], [90, 0], [125, 0.3], [180, 0.45]], volume: 0.2, sideVolume: 0.16, edge: 'scallop', edgeAmp: 14, edgeCount: 13, fringeTeeth: 6 }),
  style('curlylong', 'Cacheado longo', ['cacheado longo', 'cachos longos'], { lineR: LINE.mid, volume: 0.24, sideVolume: 0.22, edge: 'scallop', edgeAmp: 14, edgeCount: 15, backLen: 1.9, backWidth: 1.42, backEdge: 'scallop' }),
  style('afro', 'Crespo volumoso', ['crespo', 'afro', 'black power'], { lineR: [[0, -0.62], [35, -0.58], [65, -0.44], [85, 0.3], [125, 0.55], [180, 0.7]], volume: 0.62, sideVolume: 0.42, edge: 'scallop', edgeAmp: 13, edgeCount: 24, tall: true }),
  style('puffs', 'Puffs crespos', ['puffs', 'bolinhas', 'dois coques crespos'], {
    lineR: LINE.short, volume: 0.05, tall: true,
    blobs: [{ az: 72, y: -0.8, r: 58, dist: 0.5, scallop: true }, { az: -72, y: -0.8, r: 58, dist: 0.5, scallop: true }],
  }),
  style('bun', 'Coque', ['coque', 'preso'], { lineR: LINE.high, volume: 0.07, sideVolume: 0.01, tall: true, blobs: [{ az: 180, y: -0.95, r: 40, dist: 0.25 }] }),
  style('topknot', 'Coque alto', ['coque alto', 'samurai'], { lineR: LINE.high, volume: 0.05, sideVolume: 0, tall: true, blobs: [{ az: 0, y: -1.28, r: 33, dist: 0 }] }),
  style('ponytail', 'Rabo de cavalo', ['rabo de cavalo', 'rabo'], {
    lineR: LINE.high, volume: 0.08,
    locks: [{ az: 180, y: -0.45, len: 1.85, w: 44, drift: 34, wave: 7, band: true }],
  }),
  style('pigtails', 'Maria-chiquinha', ['maria chiquinha', 'chiquinhas', 'dois rabos'], {
    lineR: LINE.short, volume: 0.08,
    locks: [{ az: 100, y: -0.25, len: 1.3, w: 34, drift: 26, wave: 5, band: true }, { az: -100, y: -0.25, len: 1.3, w: 34, drift: -26, wave: 5, band: true }],
  }),
  style('braids', 'Tranças', ['tranca', 'trancas', 'trançado'], {
    lineR: LINE.mid, volume: 0.08,
    locks: [{ az: 82, y: 0.3, len: 1.7, w: 26, drift: 8, braid: true, layer: 'front' }, { az: -82, y: 0.3, len: 1.7, w: 26, drift: -8, braid: true, layer: 'front' }],
  }),
  style('mohawk', 'Moicano', ['moicano', 'crista', 'punk'], { lineR: [[0, -0.92], [180, -0.92]], flat: true, volume: 0.02, sideVolume: 0, mohawk: true, tall: true }),
  style('receding', 'Com entradas', ['entradas', 'calvicie', 'um pouco careca'], { lineR: LINE.receding, volume: 0.06 }),
  style('baldtop', 'Careca com laterais', ['careca com laterais', 'coroa', 'calvo', 'pouco cabelo'], { lineR: [[0, -0.1], [50, -0.1], [90, -0.2], [180, 0.42]], crownBald: true, volume: 0.02, sideVolume: 0.05, edge: 'fuzzy', edgeAmp: 3, edgeCount: 24 }),
  style('mullet', 'Mullet', ['mullet'], { lineR: LINE.short, volume: 0.13, backLen: 1.55, backWidth: 0.88, backEdge: 'spiky' }),
  style('bald', 'Careca', ['careca', 'sem cabelo'], { lineR: [], bald: true }),
];

const BY_ID = new Map(HAIR_STYLES.map((s) => [s.id, s]));
export const getHairStyle = (id: string): HairStyleDef => BY_ID.get(id) ?? BY_ID.get('short')!;

const normAz = (az: number): number => {
  let a = az % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
};

function lookup(table: LineTable, az: number): number {
  const a = Math.abs(az);
  for (let i = 0; i < table.length - 1; i++) {
    const [a0, y0] = table[i]!;
    const [a1, y1] = table[i + 1]!;
    if (a <= a1) {
      const t = (a - a0) / (a1 - a0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return table[table.length - 1]![1];
}

export function hairlineAt(st: HairStyleDef, az: number): number {
  const a = normAz(az);
  return lookup(a >= 0 ? st.lineR : (st.lineL ?? st.lineR), a);
}

function outerRadiusMod(st: HairStyleDef, i: number): number {
  if (!st.edgeAmp || st.edge === 'smooth') return 0;
  const phase = i * 0.5;
  if (st.edge === 'spiky') return i % 2 === 0 ? st.edgeAmp : -st.edgeAmp * 0.1;
  if (st.edge === 'scallop') return Math.abs(Math.sin(phase * Math.PI)) * st.edgeAmp;
  if (st.edge === 'fuzzy') return (i % 2) * st.edgeAmp;
  return Math.sin(phase * Math.PI) * st.edgeAmp;
}

/** Calota do cabelo para uma vista: contorno externo + linha do couro cabeludo. */
function capPath(st: HairStyleDef, viewYaw: number, rx: number, ry: number): string {
  // A vista 3/4 usa o mesmo giro comprimido do template do rosto (ver faceLayout).
  const abs = Math.abs(viewYaw);
  const yaw = abs === 45 ? Math.sign(viewYaw) * 30 : viewYaw;
  const hemi = 16;
  const inner: Pt[] = [];
  for (let i = 0; i <= hemi; i++) {
    const delta = -90 + (180 * i) / hemi;
    const az = delta - yaw;
    let yN = clamp(hairlineAt(st, az), -0.97, 0.97);
    if (st.fringeTeeth && i > 1 && i < hemi - 1 && azZ(yaw, az) > 0.25) {
      yN += ((i % 2 === 0 ? 7 : -3) * (Math.abs(normAz(az)) < 60 ? 1 : 0.2)) / ry;
    }
    const lat = Math.sqrt(Math.max(0.02, 1 - yN * yN));
    inner.push([Math.sin((delta * Math.PI) / 180) * rx * lat * 1.01, yN * ry]);
  }
  const start = inner[0]!;
  const end = inner[hemi]!;
  const segs = st.edgeCount || 18;
  const outer: Pt[] = [];
  const a0 = Math.atan2(start[1] / ry, start[0] / rx);
  const a1 = Math.atan2(end[1] / ry, end[0] / rx);
  const from = a0 < 0 ? a0 : a0 - Math.PI * 2;
  const to = a1;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = from + (to - from) * t;
    const top = Math.max(0, -Math.sin(a));
    // O volume some nas pontas para a calota encostar na cabeça, sem "chifres".
    const taper = Math.pow(Math.sin(Math.PI * t), 0.45);
    const oRx = rx * (1 + st.sideVolume * taper) + st.volume * ry * 0.35 * top * taper;
    const oRy = ry * (1 + st.volume * top * taper + st.sideVolume * (1 - top) * taper * 0.4);
    const mod = outerRadiusMod(st, i) * taper * (0.6 + 0.4 * top);
    outer.push([Math.cos(a) * (oRx + mod), Math.sin(a) * (oRy + mod)]);
  }
  const reversed = [...inner].reverse();
  const outerD = st.edge === 'spiky' ? outer.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('') : smoothPath(outer);
  const innerD = st.fringeTeeth
    ? reversed.map((p) => `L${n(p[0])} ${n(p[1])}`).join('')
    : smoothPath(reversed).replace(/^M/, 'L');
  return `${outerD}${innerD}Z`;
}

function backShape(st: HairStyleDef, view: ViewInfo, rx: number, ry: number): string {
  const s = view.facing;
  const isBack = view.cls === 'back' || view.cls === 'backQuarter';
  const shift = view.cls === 'profile' ? -s * rx * 0.42 : view.cls === 'quarter' ? -s * rx * 0.16 : view.cls === 'backQuarter' ? s * rx * 0.08 : 0;
  const wMul = view.cls === 'profile' ? 0.72 : view.cls === 'quarter' || view.cls === 'backQuarter' ? 0.92 : 1;
  const w = rx * st.backWidth * wMul;
  const bottom = st.backLen * ry;
  const top = -ry * 0.25;
  const cols = st.backEdge === 'smooth' ? 5 : 9;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const rows = st.backEdge === 'smooth' ? 4 : 8;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const y = top + (bottom - top) * t;
    const taper = (1 - Math.pow(t, 3) * 0.2) * (i === 0 ? 0.62 : i === 1 ? 0.94 : 1);
    const wob = st.backEdge === 'wave' ? Math.sin(t * Math.PI * 5) * 8 : st.backEdge === 'scallop' ? Math.abs(Math.sin(t * Math.PI * 4.5)) * 13 : 0;
    left.push([shift - w * taper - wob, y]);
    right.push([shift + w * taper + wob, y]);
  }
  const pts: Pt[] = [...left];
  for (let i = 1; i < cols; i++) {
    const t = i / cols;
    const x = shift - w * 0.8 + w * 1.6 * t;
    const notch = st.backEdge === 'spiky' ? (i % 2 ? 26 : -8) : st.backEdge === 'scallop' ? (i % 2 ? 12 : -2) : Math.sin(t * Math.PI) * 10;
    pts.push([x, bottom + notch]);
  }
  pts.push(...[...right].reverse());
  void isBack;
  return st.backEdge === 'spiky'
    ? pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('') + 'Z'
    : smoothPath(pts, true);
}

function lockShape(lock: Lock, yaw: number, rx: number, ry: number, color: string, ink: string, ow: number): { svg: string; z: number } {
  const x0 = azX(yaw, lock.az) * rx * 0.96;
  const z = azZ(yaw, lock.az);
  const y0 = lock.y * ry;
  // A ponta sai para o lado visível; atrás da cabeça ela escapa pela lateral.
  const side = Math.abs(x0) < rx * 0.2 ? (lock.drift ?? 0) >= 0 ? 1 : -1 : Math.sign(x0);
  const drift = Math.abs(lock.drift ?? 0) * side;
  const start: Pt = Math.abs(x0) < rx * 0.3 && z < 0 ? [side * rx * 0.72, y0] : [x0, y0];
  const yEnd = y0 + lock.len * ry;
  const wave = lock.wave ?? 0;
  const pts: Pt[] = [];
  const steps = lock.braid ? 7 : 5;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([start[0] + drift * Math.sin(t * Math.PI * 0.75) + Math.sin(t * Math.PI * 3) * wave, start[1] + (yEnd - start[1]) * t]);
  }
  const w = lock.w;
  let out = '';
  if (lock.braid) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]!;
      const r = (w / 2) * (1 - (i / pts.length) * 0.3);
      out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(r)}" ry="${n(r * 1.08)}" fill="${color}" stroke="${ink}" stroke-width="${n(ow * 0.7)}"/>`;
      if (i > 0) out += path(`M${n(x - r * 0.7)} ${n(y - 2)}Q${n(x)} ${n(y + r * 0.6)} ${n(x + r * 0.7)} ${n(y - 2)}`, `fill="none" stroke="${shade(color, -0.3)}" stroke-width="2"`);
    }
    const [ex, ey] = pts[pts.length - 1]!;
    out += `<circle cx="${n(ex)}" cy="${n(ey + w * 0.48)}" r="${n(w * 0.22)}" fill="#e0647a" stroke="${ink}" stroke-width="2"/>`;
  } else {
    const leftEdge: Pt[] = pts.map(([x, y], i) => [x - (w / 2) * (1 - (i / steps) * 0.55), y]);
    const rightEdge: Pt[] = pts.map(([x, y], i) => [x + (w / 2) * (1 - (i / steps) * 0.55), y]);
    const outline: Pt[] = [...leftEdge, [pts[steps]![0], yEnd + w * 0.3], ...[...rightEdge].reverse()];
    out += path(smoothPath(outline, true), `fill="${color}" stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`);
    if (lock.band) out += `<ellipse cx="${n(start[0])}" cy="${n(start[1])}" rx="${n(w * 0.42)}" ry="8" fill="#e0647a" stroke="${ink}" stroke-width="2.5"/>`;
  }
  return { svg: out, z };
}

function blobShape(b: Blob, yaw: number, rx: number, ry: number, color: string, ink: string, ow: number): { svg: string; z: number } {
  const dist = b.dist ?? 0.9;
  const x = azX(yaw, b.az) * rx * dist;
  const z = azZ(yaw, b.az);
  const y = b.y * ry;
  const attrs = `fill="${color}" stroke="${ink}" stroke-width="${n(ow)}"`;
  if (b.scallop) {
    const pts: Pt[] = [];
    const cnt = 16;
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2;
      const r = b.r + (i % 2) * 8;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    return { svg: path(smoothPath(pts, true), attrs), z };
  }
  return {
    svg: `<circle cx="${n(x)}" cy="${n(y)}" r="${n(b.r)}" ${attrs}/>` + path(`M${n(x - b.r * 0.55)} ${n(y - b.r * 0.2)}Q${n(x)} ${n(y - b.r * 0.82)} ${n(x + b.r * 0.55)} ${n(y - b.r * 0.2)}`, `fill="none" stroke="${shade(color, -0.25)}" stroke-width="2.5"`),
    z,
  };
}

/** Crista do moicano: acompanha a linha sagital; estreita de frente, larga de lado. */
function mohawkShape(yaw: number, rx: number, ry: number, color: string, ink: string, ow: number): string {
  const sinY = Math.sin((yaw * Math.PI) / 180);
  const cosY = Math.abs(Math.cos((yaw * Math.PI) / 180));
  const outer: Pt[] = [];
  const base: Pt[] = [];
  const count = 11;
  for (let i = 0; i <= count; i++) {
    const e = -150 + (200 * i) / count;
    const er = (e * Math.PI) / 180;
    const f = Math.sin(er);
    const up = Math.cos(er);
    const bx = f * rx * sinY;
    const by = -up * ry;
    base.push([bx, by]);
    const h = i % 2 === 0 ? 60 : 30;
    outer.push([bx + f * sinY * h, by - up * h]);
  }
  if (cosY > 0.3) {
    // Vista frontal/costas: a crista é um leque estreito sobre o topo.
    const w = 20 * cosY + Math.abs(sinY) * 28;
    const pts: Pt[] = [[-w, -ry * 0.82], [-w * 0.9, -ry - 30], [-w * 0.4, -ry - 66], [0, -ry - 76], [w * 0.4, -ry - 66], [w * 0.9, -ry - 30], [w, -ry * 0.82]];
    return path(pts.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('') + 'Z', `fill="${color}" stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`);
  }
  const d = outer.map((p, i) => `${i ? 'L' : 'M'}${n(p[0])} ${n(p[1])}`).join('') + [...base].reverse().map((p) => `L${n(p[0])} ${n(p[1])}`).join('') + 'Z';
  return path(d, `fill="${color}" stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`);
}

export interface HairRender {
  /** atrás da cabeça e do tronco (vistas de frente) */
  backBehindBody: string;
  /** por cima do tronco, atrás da cabeça (vistas de costas) */
  backOverBody: string;
  /** imediatamente atrás da cabeça */
  behindHead: string;
  /** por cima do rosto */
  front: string;
}

export function renderHair(opts: {
  styleId: string; color: string; highlight: string; ink: string; ow: number; rx: number; ry: number; view: ViewInfo;
}): HairRender {
  const { color, highlight, ink, ow, rx, ry, view } = opts;
  const st = getHairStyle(opts.styleId);
  const res: HairRender = { backBehindBody: '', backOverBody: '', behindHead: '', front: '' };
  if (st.bald) return res;
  const yaw = view.yaw;
  const isBackView = view.cls === 'back' || view.cls === 'backQuarter';
  const attrs = `fill="${color}" stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`;

  if (st.backLen > 0) {
    const shape = path(backShape(st, view, rx, ry), `data-part="hair-back" ${attrs}`);
    if (isBackView) res.backOverBody += shape;
    else res.backBehindBody += shape;
  }

  for (const lock of st.locks) {
    const { svg, z } = lockShape(lock, yaw, rx, ry, color, ink, ow);
    const part = `<g data-part="hair-lock">${svg}</g>`;
    if (lock.layer === 'front' && view.showsFace) res.front += part;
    else if (z > 0.15) res.backOverBody += part;
    else res.behindHead += part;
  }
  for (const b of st.blobs) {
    const { svg, z } = blobShape(b, yaw, rx, ry, color, ink, ow);
    if (z > 0.35 && !(b.dist === 0)) res.front += svg;
    else res.behindHead += svg;
  }

  let cap = '';
  if (st.crownBald) {
    // Calvo no topo: duas faixas nas laterais/nuca, sem cobrir a coroa.
    const y0 = -ry * 0.16;
    const segments: Array<[number, number]> = [];
    let open: number | null = null;
    for (let d = -90; d <= 90; d += 6) {
      const near = Math.abs(normAz(d - yaw)) >= 58;
      if (near && open === null) open = d;
      if (!near && open !== null) {
        segments.push([open, d - 6]);
        open = null;
      }
    }
    if (open !== null) segments.push([open, 90]);
    for (const [a, b] of segments) {
      const steps = 8;
      const topEdge: Pt[] = [];
      const lowEdge: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const dl = a + ((b - a) * i) / steps;
        const az = dl - yaw;
        const sx = Math.sin((dl * Math.PI) / 180);
        const t = clamp((Math.abs(normAz(az)) - 58) / 122, 0, 1);
        const yTop = y0 - ry * 0.05 * t;
        const yLow = y0 + ry * (0.2 + 0.7 * t);
        const latT = Math.sqrt(Math.max(0.02, 1 - (yTop / ry) ** 2));
        const latL = Math.sqrt(Math.max(0.02, 1 - (yLow / ry) ** 2));
        topEdge.push([sx * rx * 1.03 * latT, yTop]);
        lowEdge.push([sx * rx * 1.02 * latL, yLow]);
      }
      const d = smoothPath([...topEdge, ...[...lowEdge].reverse()], true);
      cap += path(d, `data-part="hair-cap" ${attrs}`);
    }
  } else if (!st.mohawk) {
    cap = path(capPath(st, yaw, rx, ry), `data-part="hair-cap" ${attrs}`);
    if (st.flat) cap = path(capPath(st, yaw, rx, ry), `data-part="hair-cap" fill="${color}" fill-opacity=".75" stroke="${ink}" stroke-width="${n(ow * 0.5)}" stroke-linejoin="round"`);
  }
  res.front += cap;
  if (st.mohawk) res.front += `<g data-part="hair-mohawk">${mohawkShape(yaw, rx, ry, color, ink, ow)}</g>`;

  // Brilho do cabelo: faixa curva discreta. Mechas opcionais em outra cor.
  if (!st.flat && !st.crownBald) {
    const hl = shade(color, 0.16);
    res.front += path(
      `M${n(-rx * 0.55)} ${n(-ry * 0.82)}Q${n(-rx * 0.1)} ${n(-ry * 1.02)} ${n(rx * 0.42)} ${n(-ry * 0.85)}`,
      `fill="none" stroke="${hl}" stroke-width="7" stroke-linecap="round" stroke-opacity=".55"`,
    );
  }
  if (highlight) {
    let streaks = '';
    for (const off of [-0.5, -0.15, 0.25, 0.55]) {
      const az = off * 90;
      const x = azX(yaw, az) * rx * 0.9;
      if (azZ(yaw, az) < 0.05 && view.showsFace) continue;
      streaks += `M${n(x * 0.75)} ${n(-ry * 0.98)}Q${n(x)} ${n(-ry * 0.8)} ${n(x * 1.08)} ${n(-ry * 0.52)}`;
    }
    if (streaks) res.front += path(streaks, `data-part="hair-highlight" fill="none" stroke="${highlight}" stroke-width="7" stroke-linecap="round"`);
  }
  return res;
}

/** Estilos de cabelo que colidem com chapéus. */
export const hairCollidesWithHats = (id: string): boolean => !!getHairStyle(id).tall;
