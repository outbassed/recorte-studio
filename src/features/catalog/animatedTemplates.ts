/**
 * Objetos animados PADRÃO (originais, desenhados com peças): servem de exemplo e ponto de partida.
 * Ao usar, o objeto entra no projeto com ID estável (tpl_<id>); "Criar cópia editável" gera ID novo.
 */
import { CustomObjectSchema, type CustomObject, type Piece } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';

export interface AnimatedTemplate { id: string; label: string; keywords: string[]; category?: string; make: () => CustomObject }
export const TEMPLATE_PREFIX = 'tpl_';
export const ANIMATED_CATEGORY = 'Efeitos animados';

const P = (kind: Piece['kind'], name: string, o: Partial<Piece>) => createPiece(kind, { id: `${name}`, name, ...o });

function fire(): CustomObject {
  const logs = (): Piece[] => [
    P('rect', 'Lenha 1', { x: -26, y: -16, w: 120, h: 24, radius: 10, rotation: 14, fill: '#7a4a2a', stroke: '#2b1a10' }),
    P('rect', 'Lenha 2', { x: 26, y: -16, w: 120, h: 24, radius: 10, rotation: -14, fill: '#8a5632', stroke: '#2b1a10' }),
  ];
  // Quatro desenhos da chama: alturas e inclinações diferentes, como num desenho animado.
  const shapes = [
    { h: 150, w: 92, r: -4, h2: 98, h3: 52 },
    { h: 168, w: 84, r: 5, h2: 112, h3: 60 },
    { h: 142, w: 98, r: 2, h2: 92, h3: 46 },
    { h: 160, w: 88, r: -7, h2: 108, h3: 58 },
  ];
  const frames = shapes.map((s, i) => ({
    id: `fogo_f${i}`,
    durationMs: 110,
    pieces: [
      ...logs(),
      P('ellipse', 'Chama', { x: 0, y: -26 - s.h / 2, w: s.w, h: s.h, rotation: s.r, fill: '#f0742c', stroke: '#8f2f12', strokeWidth: 4 }),
      P('ellipse', 'Miolo', { x: 0, y: -26 - s.h2 / 2, w: s.w * 0.62, h: s.h2, rotation: -s.r, fill: '#ffc23d', stroke: 'none', strokeWidth: 0 }),
      P('ellipse', 'Centro', { x: 0, y: -26 - s.h3 / 2, w: s.w * 0.3, h: s.h3, fill: '#fff3b0', stroke: 'none', strokeWidth: 0 }),
    ],
  }));
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}fogueira`, name: 'Fogueira', width: 180, height: 220,
    pieces: frames[0]!.pieces.slice(0, 2),
    clips: [
      { id: 'aceso', name: 'Aceso', mode: 'loop', frames },
      { id: 'apagando', name: 'Apagando', mode: 'once', frames: [frames[2]!, { ...frames[3]!, id: 'fogo_a1', pieces: [...logs(), P('ellipse', 'Brasa', { x: 0, y: -40, w: 60, h: 40, fill: '#e2582b', stroke: '#8f2f12' })] }, { id: 'fogo_a2', durationMs: 300, pieces: [...logs(), P('ellipse', 'Fumaça', { x: 6, y: -90, w: 40, h: 60, fill: '#9aa0aa', stroke: 'none', strokeWidth: 0, opacity: 0.7 })] }].map((f) => ({ ...f, durationMs: Math.max(f.durationMs, 160) })) },
    ],
    defaultClip: 'aceso', createdAt: 0, updatedAt: 0,
  });
}

function fan(): CustomObject {
  const base = (): Piece[] => [
    P('rect', 'Pé', { x: 0, y: -10, w: 120, h: 20, radius: 8, fill: '#4c5566', stroke: '#1d222b' }),
    P('rect', 'Haste', { x: 0, y: -110, w: 16, h: 190, fill: '#6b7586', stroke: '#1d222b' }),
  ];
  const blades = (deg: number): Piece[] => [0, 90, 180, 270].map((a, i) => {
    const rad = ((a + deg) * Math.PI) / 180;
    return P('ellipse', `Pá ${i + 1}`, { x: Math.cos(rad) * 46, y: -220 + Math.sin(rad) * 46, w: 92, h: 34, rotation: a + deg, fill: '#7fc8ff', stroke: '#1d222b', strokeWidth: 3 });
  });
  const hub = () => P('ellipse', 'Centro', { x: 0, y: -220, w: 34, h: 34, fill: '#d65f5f', stroke: '#1d222b' });
  const frames = [0, 22.5, 45, 67.5].map((d, i) => ({ id: `vent_f${i}`, durationMs: 50, pieces: [...base(), ...blades(d), hub()] }));
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}ventilador`, name: 'Ventilador', width: 220, height: 300,
    pieces: [...base(), ...blades(0), hub()],
    clips: [{ id: 'girando', name: 'Girando', mode: 'loop', frames }, { id: 'devagar', name: 'Devagar', mode: 'loop', frames: frames.map((f) => ({ ...f, durationMs: 160 })) }],
    defaultClip: 'girando', createdAt: 0, updatedAt: 0,
  });
}

function boat(): CustomObject {
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}barco`, name: 'Barco', width: 520, height: 300,
    pieces: [
      P('rect', 'Mastro', { x: 150, y: -170, w: 12, h: 200, fill: '#6e5038', stroke: '#23202b' }),
      P('triangle', 'Vela', { x: 102, y: -185, w: 96, h: 150, fill: '#f4f1ea', stroke: '#23202b' }),
      P('rect', 'Casco', { x: 0, y: -38, w: 500, h: 76, radius: 30, fill: '#8c5a3c', stroke: '#23202b' }),
      P('rect', 'Faixa', { x: 0, y: -50, w: 470, h: 14, radius: 7, fill: '#e0b04c', stroke: 'none', strokeWidth: 0 }),
      P('ellipse', 'Janela', { x: -150, y: -24, w: 26, h: 26, fill: '#a8d4e8', stroke: '#23202b', strokeWidth: 3 }),
      P('ellipse', 'Janela 2', { x: -90, y: -24, w: 26, h: 26, fill: '#a8d4e8', stroke: '#23202b', strokeWidth: 3 }),
    ],
    createdAt: 0, updatedAt: 0,
  });
}

/** Faixa de ondas (2200 px): 3 quadros deslocados de 1/3 do passo, em loop sem emenda. */
function waves(): CustomObject {
  const STEP = 130;
  const row = (shift: number, fill: string): Piece[] => Array.from({ length: 19 }, (_, i) => P('ellipse', `Onda ${i + 1}`, { x: -1170 + i * STEP + shift, y: -17, w: 160, h: 34, fill, stroke: 'none', strokeWidth: 0 }));
  const frames = [0, 1, 2].map((k) => ({ id: `onda_f${k}`, durationMs: 240, pieces: [P('rect', 'Água', { x: 0, y: -6, w: 2300, h: 14, fill: '#2f86c0', stroke: 'none', strokeWidth: 0 }), ...row((k * STEP) / 3, '#7cc4ea')] }));
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}ondas`, name: 'Ondas', width: 2200, height: 40, pieces: frames[0]!.pieces,
    clips: [{ id: 'mar', name: 'Mar', mode: 'loop', frames }], defaultClip: 'mar', createdAt: 0, updatedAt: 0,
  });
}

function tent(): CustomObject {
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}barraca`, name: 'Barraca', width: 360, height: 230,
    pieces: [
      P('triangle', 'Lona', { x: 0, y: -110, w: 360, h: 220, fill: '#e0b04c', stroke: '#23202b' }),
      P('triangle', 'Porta', { x: 0, y: -60, w: 120, h: 120, fill: '#5e4635', stroke: '#23202b', strokeWidth: 3 }),
      P('line', 'Corda', { x: 210, y: -60, w: 140, h: 0, rotation: 40, stroke: '#f4f1ea', strokeWidth: 3 }),
    ],
    createdAt: 0, updatedAt: 0,
  });
}

function umbrella(): CustomObject {
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}guardasol`, name: 'Guarda-sol', width: 320, height: 320,
    pieces: [
      P('rect', 'Haste', { x: 0, y: -140, w: 10, h: 280, fill: '#8c6a4f', stroke: '#23202b', strokeWidth: 2 }),
      P('triangle', 'Lona', { x: 0, y: -300, w: 320, h: 90, fill: '#d65f5f', stroke: '#23202b' }),
      P('triangle', 'Faixa', { x: 0, y: -300, w: 110, h: 90, fill: '#f4f1ea', stroke: '#23202b', strokeWidth: 2 }),
    ],
    createdAt: 0, updatedAt: 0,
  });
}

function palm(): CustomObject {
  const leaf = (i: number, rot: number) => P('ellipse', `Folha ${i}`, { x: Math.cos((rot * Math.PI) / 180) * 80, y: -420 + Math.sin((rot * Math.PI) / 180) * 40, w: 190, h: 46, rotation: rot, fill: '#3f9a52', stroke: '#1f4d2a', strokeWidth: 3 });
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}palmeira`, name: 'Palmeira', width: 360, height: 470,
    pieces: [
      P('rect', 'Tronco', { x: 0, y: -210, w: 34, h: 420, rotation: 4, fill: '#9a7048', stroke: '#4a3220', strokeWidth: 3 }),
      ...[-160, -110, -40, 20, 200].map((r, i) => leaf(i + 1, r)),
      P('ellipse', 'Coco', { x: -10, y: -400, w: 34, h: 34, fill: '#6e5038', stroke: '#23202b', strokeWidth: 2 }),
    ],
    createdAt: 0, updatedAt: 0,
  });
}

function rocks(): CustomObject {
  return CustomObjectSchema.parse({
    id: `${TEMPLATE_PREFIX}pedras`, name: 'Pedras', width: 260, height: 80,
    pieces: [
      P('ellipse', 'Pedra 1', { x: -80, y: -26, w: 110, h: 54, fill: '#8a8f99', stroke: '#2b2f37', strokeWidth: 3 }),
      P('ellipse', 'Pedra 2', { x: 30, y: -34, w: 120, h: 70, fill: '#a3a8b2', stroke: '#2b2f37', strokeWidth: 3 }),
      P('ellipse', 'Pedra 3', { x: 110, y: -18, w: 70, h: 38, fill: '#7a7f88', stroke: '#2b2f37', strokeWidth: 3 }),
    ],
    createdAt: 0, updatedAt: 0,
  });
}

export const ANIMATED_TEMPLATES: AnimatedTemplate[] = [
  { id: 'barco', label: 'Barco', keywords: ['barco', 'bote', 'navio', 'veiculo', 'aquatico', 'mar'], category: 'Veículos', make: boat },
  { id: 'fogueira', label: 'Fogueira', keywords: ['fogo', 'chama', 'acampamento', 'efeito', 'animado'], make: fire },
  { id: 'ventilador', label: 'Ventilador', keywords: ['ventilador', 'girar', 'pás', 'animado'], make: fan },
  { id: 'ondas', label: 'Ondas', keywords: ['mar', 'agua', 'onda', 'oceano', 'animado'], make: waves },
  { id: 'barraca', label: 'Barraca', keywords: ['barraca', 'acampamento', 'camping', 'tenda'], category: 'Natureza', make: tent },
  { id: 'guardasol', label: 'Guarda-sol', keywords: ['guarda-sol', 'praia', 'sombrinha'], category: 'Natureza', make: umbrella },
  { id: 'palmeira', label: 'Palmeira', keywords: ['palmeira', 'coqueiro', 'praia', 'arvore'], category: 'Natureza', make: palm },
  { id: 'pedras', label: 'Pedras', keywords: ['pedra', 'rocha', 'natureza'], category: 'Natureza', make: rocks },
];

const cache = new Map<string, CustomObject>();
export function animatedTemplate(id: string): CustomObject | undefined {
  const t = ANIMATED_TEMPLATES.find((x) => x.id === id);
  if (!t) return undefined;
  let o = cache.get(id);
  if (!o) cache.set(id, (o = t.make()));
  return o;
}
