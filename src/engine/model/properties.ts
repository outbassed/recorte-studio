/**
 * Esquema ÚNICO de propriedades: limites, passo, unidade e rótulo são definidos
 * aqui e reutilizados pelo inspector, pela timeline e pelo motor.
 *
 * `min`/`max` são limites REAIS do motor. `sliderMin`/`sliderMax` são apenas o
 * alcance confortável da barrinha: o campo numérico aceita valores além dele e o
 * slider fica saturado sem truncar o valor digitado.
 */
import type { KeyValue, Rig, SceneNode } from './schema';

export type PropertyKind = 'number' | 'enum' | 'boolean';

export interface PropertyDef {
  path: string;
  label: string;
  kind: PropertyKind;
  unit?: string;
  min?: number;
  max?: number;
  sliderMin?: number;
  sliderMax?: number;
  step?: number;
  /** Valor exibido = valor guardado × display (ex.: escala 1,25 → 125 %). */
  display?: number;
  decimals?: number;
  /** Para quais tipos de nó a propriedade pode ser animada. */
  appliesTo: Array<SceneNode['kind'] | 'camera'>;
}

const ALL_VISUAL: PropertyDef['appliesTo'] = ['character', 'prop', 'image', 'text', 'shape', 'light', 'group'];
const num = (
  path: string,
  label: string,
  o: Partial<PropertyDef> & { appliesTo?: PropertyDef['appliesTo'] },
): PropertyDef => ({ path, label, kind: 'number', appliesTo: ALL_VISUAL, step: 1, decimals: 1, ...o });

const rig = (path: keyof Rig, label: string, unit = '°', sliderMin = -180, sliderMax = 180, step = 1): PropertyDef =>
  num(`rig.${path}`, label, { unit, sliderMin, sliderMax, min: -720, max: 720, step, appliesTo: ['character'] });

export const PROPERTIES: PropertyDef[] = [
  num('transform.x', 'Posição X', { unit: 'px', min: -20000, max: 20000, sliderMin: -1400, sliderMax: 1400, step: 0.5 }),
  num('transform.y', 'Posição Y', { unit: 'px', min: -20000, max: 20000, sliderMin: -800, sliderMax: 800, step: 0.5 }),
  num('transform.scaleX', 'Escala X', {
    unit: '%', display: 100, min: -10, max: 10, sliderMin: 5, sliderMax: 300, step: 1,
  }),
  num('transform.scaleY', 'Escala Y', {
    unit: '%', display: 100, min: -10, max: 10, sliderMin: 5, sliderMax: 300, step: 1,
  }),
  num('transform.rotationDeg', 'Rotação', { unit: '°', min: -3600, max: 3600, sliderMin: -180, sliderMax: 180, step: 0.5 }),
  num('opacity', 'Opacidade', { unit: '%', display: 100, min: 0, max: 1, sliderMin: 0, sliderMax: 100, step: 1 }),
  num('parallax', 'Parallax', {
    unit: '%', display: 100, min: -5, max: 5, sliderMin: 0, sliderMax: 200, step: 1,
  }),
  num('blur', 'Desfoque', { unit: 'px', min: 0, max: 60, sliderMin: 0, sliderMax: 30, step: 0.5 }),
  rig('armLUpper', 'Braço esquerdo'),
  rig('armLLower', 'Antebraço esquerdo', '°', -150, 150),
  rig('armRUpper', 'Braço direito'),
  rig('armRLower', 'Antebraço direito', '°', -150, 150),
  rig('legLUpper', 'Coxa esquerda', '°', -120, 120),
  rig('legLLower', 'Canela esquerda', '°', -150, 150),
  rig('legRUpper', 'Coxa direita', '°', -120, 120),
  rig('legRLower', 'Canela direita', '°', -150, 150),
  rig('torsoLean', 'Inclinar tronco', '°', -60, 60),
  rig('headTilt', 'Inclinar cabeça', '°', -45, 45),
  rig('headNod', 'Acenar cabeça', 'px', -30, 30),
  rig('bodyY', 'Altura do corpo', 'px', -300, 300),
  num('rig.sit', 'Sentar', { unit: '%', display: 100, min: 0, max: 1, sliderMin: 0, sliderMax: 100, appliesTo: ['character'] }),
  num('expressionIntensity', 'Intensidade da expressão', {
    unit: '%', display: 100, min: 0, max: 1.5, sliderMin: 0, sliderMax: 100, appliesTo: ['character'],
  }),
  num('gaze.x', 'Olhar X', { unit: 'px', min: -20000, max: 20000, sliderMin: -1400, sliderMax: 1400, appliesTo: ['character'] }),
  num('gaze.y', 'Olhar Y', { unit: 'px', min: -20000, max: 20000, sliderMin: -800, sliderMax: 800, appliesTo: ['character'] }),
  num('gaze.strength', 'Força do olhar', {
    unit: '%', display: 100, min: 0, max: 1, sliderMin: 0, sliderMax: 100, appliesTo: ['character'],
  }),
  num('gaze.headStrength', 'Giro da cabeça', {
    unit: '%', display: 100, min: 0, max: 1, sliderMin: 0, sliderMax: 100, appliesTo: ['character'],
  }),
  { path: 'visible', label: 'Visibilidade', kind: 'boolean', appliesTo: ALL_VISUAL },
  { path: 'expression', label: 'Expressão', kind: 'enum', appliesTo: ['character'] },
  { path: 'mouthShape', label: 'Boca (visema)', kind: 'enum', appliesTo: ['character'] },
  { path: 'bodyView', label: 'Vista do corpo', kind: 'enum', appliesTo: ['character'] },
  { path: 'headView', label: 'Vista da cabeça', kind: 'enum', appliesTo: ['character'] },
  { path: 'blinkMode', label: 'Piscar', kind: 'enum', appliesTo: ['character'] },
  { path: 'gaze.mode', label: 'Modo do olhar', kind: 'enum', appliesTo: ['character'] },
  { path: 'gaze.targetId', label: 'Alvo do olhar', kind: 'enum', appliesTo: ['character'] },
  { path: 'state', label: 'Estado do objeto', kind: 'enum', appliesTo: ['prop'] },
  { path: 'heldBy', label: 'Segurado por', kind: 'enum', appliesTo: ['prop'] },
  // Câmera
  num('x', 'Câmera X', { unit: 'px', min: -20000, max: 20000, sliderMin: -1400, sliderMax: 1400, appliesTo: ['camera'] }),
  num('y', 'Câmera Y', { unit: 'px', min: -20000, max: 20000, sliderMin: -800, sliderMax: 800, appliesTo: ['camera'] }),
  num('zoom', 'Zoom da câmera', {
    unit: '%', display: 100, min: 0.05, max: 20, sliderMin: 25, sliderMax: 400, step: 1, appliesTo: ['camera'],
  }),
  num('rotationDeg', 'Rotação da câmera', { unit: '°', min: -180, max: 180, sliderMin: -30, sliderMax: 30, step: 0.5, appliesTo: ['camera'] }),
];

const BY_KEY = new Map<string, PropertyDef>();
for (const p of PROPERTIES) for (const k of p.appliesTo) BY_KEY.set(`${k}:${p.path}`, p);

export function getPropertyDef(target: SceneNode['kind'] | 'camera', path: string): PropertyDef | undefined {
  return BY_KEY.get(`${target}:${path}`);
}

/** Aplica os limites reais do motor. Valores fora do slider permanecem válidos. */
export function clampToDef(def: Pick<PropertyDef, 'min' | 'max'>, v: number): number {
  let out = v;
  if (def.min !== undefined) out = Math.max(def.min, out);
  if (def.max !== undefined) out = Math.min(def.max, out);
  return out;
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setPath(obj: unknown, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]!];
    if (next === null || typeof next !== 'object') return;
    cur = next as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

export function formatKeyValue(v: KeyValue, def?: PropertyDef): string {
  if (typeof v === 'number') {
    const shown = v * (def?.display ?? 1);
    return `${Number(shown.toFixed(def?.decimals ?? 1)).toLocaleString('pt-BR')}${def?.unit ? ` ${def.unit}` : ''}`;
  }
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
}
