/**
 * Ações: animações procedurais com parâmetros, avaliadas em função do tempo local.
 * Podem ser "assadas" em keyframes (ver ops.bakeActionClip): nada fica preso.
 */
import type { ActionClip, RigKey } from '../model/schema';
import { clamp } from '../render/svg';

export interface ActionSample {
  rig: Partial<Record<RigKey, number>>;
  expression?: string;
  handL?: 'open' | 'fist' | 'point';
  handR?: 'open' | 'fist' | 'point';
  /** Altura extra do corpo (pulo) */
}

export interface ActionDef {
  id: string;
  label: string;
  keywords: string[];
  /** Duração padrão em ms */
  duration: number;
  /** Usa braço escolhido por `side` */
  usesSide?: boolean;
  /** Blenda de entrada/saída em ms */
  blend?: number;
  sample: (ctx: { t: number; ms: number; speed: number; intensity: number; side: 'L' | 'R' }) => ActionSample;
}

const TAU = Math.PI * 2;
const sin = Math.sin;
const arm = (side: 'L' | 'R', part: 'Upper' | 'Lower'): RigKey => `arm${side}${part}` as RigKey;
const other = (s: 'L' | 'R'): 'L' | 'R' => (s === 'L' ? 'R' : 'L');
const hand = (side: 'L' | 'R', kind: 'open' | 'fist' | 'point') => (side === 'L' ? { handL: kind } : { handR: kind });

export const ACTIONS: ActionDef[] = [
  {
    id: 'walk', label: 'Andar', keywords: ['andar', 'anda', 'caminhar', 'caminha'], duration: 2000,
    sample: ({ ms, speed, intensity }) => {
      const ph = (ms / 1000) * speed * TAU * 1.05;
      const s = sin(ph);
      const c = Math.cos(ph);
      const k = intensity;
      return { rig: {
        legLUpper: s * 28 * k, legRUpper: -s * 28 * k,
        legLLower: Math.max(0, -c) * 38 * k, legRLower: Math.max(0, c) * 38 * k,
        armLUpper: -s * 22 * k, armRUpper: s * 22 * k,
        armLLower: 12 * k, armRLower: 12 * k,
        bodyY: Math.abs(c) * 7 * k, torsoLean: 0, headNod: Math.abs(s) * 2,
      } };
    },
  },
  {
    id: 'run', label: 'Correr', keywords: ['correr', 'corre', 'corrida', 'perseguir'], duration: 1600,
    sample: ({ ms, speed, intensity }) => {
      const ph = (ms / 1000) * speed * TAU * 1.9;
      const s = sin(ph);
      const c = Math.cos(ph);
      const k = intensity;
      return { rig: {
        legLUpper: s * 46 * k, legRUpper: -s * 46 * k,
        legLLower: (Math.max(0, -c) * 62 + 12) * k, legRLower: (Math.max(0, c) * 62 + 12) * k,
        armLUpper: -s * 44 * k, armRUpper: s * 44 * k,
        armLLower: 72 * k, armRLower: 72 * k,
        bodyY: Math.abs(c) * 20 * k,
      }, handL: 'fist', handR: 'fist' };
    },
  },
  {
    id: 'gesture', label: 'Gesticular falando', keywords: ['gesticular', 'explicar'], duration: 2000, usesSide: true,
    sample: ({ ms, speed, intensity, side }) => {
      const t = (ms / 1000) * speed;
      return { rig: {
        [arm(side, 'Upper')]: (28 + sin(t * 5.1) * 13) * intensity,
        [arm(side, 'Lower')]: (58 + sin(t * 7.3) * 15) * intensity,
        headTilt: sin(t * 3.1) * 3 * intensity,
        headNod: sin(t * 6.7) * 2.2 * intensity,
      } };
    },
  },
  {
    id: 'wave', label: 'Acenar', keywords: ['acenar', 'acena', 'tchau', 'cumprimentar'], duration: 1500, usesSide: true,
    sample: ({ ms, speed, intensity, side }) => ({ rig: {
      [arm(side, 'Upper')]: 136 * intensity,
      [arm(side, 'Lower')]: (22 + sin((ms / 1000) * speed * 11) * 24) * intensity,
    } }),
  },
  {
    id: 'point', label: 'Apontar', keywords: ['apontar', 'aponta', 'indicar'], duration: 1400, usesSide: true,
    sample: ({ intensity, side }) => ({ rig: { [arm(side, 'Upper')]: 92 * intensity, [arm(side, 'Lower')]: 4 }, ...hand(side, 'point') }),
  },
  {
    id: 'crossArms', label: 'Cruzar os braços', keywords: ['cruzar', 'cruza', 'braços cruzados'], duration: 2000,
    sample: ({ intensity }) => ({ rig: { armLUpper: -10 * intensity, armRUpper: -10 * intensity, armLLower: 125 * intensity, armRLower: 125 * intensity }, handL: 'fist', handR: 'fist' }),
  },
  {
    id: 'sit', label: 'Sentar', keywords: ['sentar', 'senta', 'sentado'], duration: 1000, blend: 450,
    sample: ({ intensity }) => ({ rig: { sit: clamp(intensity, 0, 1) } }),
  },
  {
    id: 'standUp', label: 'Levantar', keywords: ['levantar', 'levanta'], duration: 900, blend: 1,
    sample: ({ t, intensity }) => ({ rig: { sit: clamp((1 - t) * intensity, 0, 1) } }),
  },
  {
    id: 'laugh', label: 'Rir', keywords: ['rir', 'ri', 'risada', 'gargalhar'], duration: 1600,
    sample: ({ ms, speed, intensity }) => {
      const b = sin((ms / 1000) * speed * 21);
      return { rig: { headNod: b * 3 * intensity, bodyY: Math.abs(b) * 4 * intensity, torsoLean: b * 1.5, armLUpper: 12 * intensity, armRUpper: 12 * intensity }, expression: 'laughing' };
    },
  },
  {
    id: 'cry', label: 'Chorar', keywords: ['chorar', 'chora', 'choro'], duration: 2000,
    sample: ({ ms, speed, intensity }) => ({ rig: { headNod: 6 * intensity + sin((ms / 1000) * speed * 9) * 2, armLUpper: 40 * intensity, armLLower: 130 * intensity, torsoLean: sin((ms / 1000) * speed * 7) * 1.5 }, expression: 'crying' }),
  },
  {
    id: 'react', label: 'Reagir (susto)', keywords: ['reagir', 'reage', 'susto', 'assustar', 'surpresa'], duration: 1200, blend: 90,
    sample: ({ ms, speed, intensity }) => {
      const hop = Math.max(0, 1 - (ms / 300) * speed);
      return { rig: { bodyY: hop * 34 * intensity, armLUpper: 58 * intensity, armRUpper: 58 * intensity, armLLower: 96 * intensity, armRLower: 96 * intensity, torsoLean: -3 }, expression: 'surprised' };
    },
  },
  {
    id: 'jump', label: 'Pular', keywords: ['pular', 'pula', 'saltar'], duration: 800, blend: 60,
    sample: ({ t, intensity }) => {
      const arc = sin(t * Math.PI);
      return { rig: { bodyY: arc * 150 * intensity, legLUpper: arc * 22, legRUpper: -arc * 16, legLLower: arc * 42, legRLower: arc * 42, armLUpper: arc * 120 * intensity, armRUpper: arc * 120 * intensity } };
    },
  },
  {
    id: 'crouch', label: 'Abaixar', keywords: ['abaixar', 'abaixa', 'agachar'], duration: 1000, blend: 260,
    sample: ({ intensity }) => ({ rig: { sit: 0.62 * intensity, torsoLean: 7 } }),
  },
  {
    id: 'dance', label: 'Dançar', keywords: ['dançar', 'dança', 'dancar', 'danca', 'passinho'], duration: 3000,
    sample: ({ ms, speed, intensity }) => {
      const t = (ms / 1000) * speed;
      const s = sin(t * 7.2);
      const c = Math.cos(t * 7.2);
      return { rig: {
        armLUpper: (92 + s * 56) * intensity, armRUpper: (92 - s * 56) * intensity,
        armLLower: (30 + c * 26) * intensity, armRLower: (30 - c * 26) * intensity,
        legLUpper: Math.max(0, s) * 20, legRUpper: Math.max(0, -s) * 20,
        legLLower: Math.max(0, s) * 32, legRLower: Math.max(0, -s) * 32,
        bodyY: Math.abs(c) * 20 * intensity, torsoLean: s * 8 * intensity, headTilt: -s * 9 * intensity,
      } };
    },
  },
  {
    id: 'nod', label: 'Concordar (sim)', keywords: ['concordar', 'concorda', 'assentir'], duration: 900,
    sample: ({ ms, speed, intensity }) => ({ rig: { headNod: sin((ms / 1000) * speed * 13) * 8 * intensity } }),
  },
  {
    id: 'shakeHead', label: 'Negar (não)', keywords: ['negar', 'nega', 'discordar'], duration: 1000,
    sample: ({ ms, speed, intensity }) => ({ rig: { headTilt: sin((ms / 1000) * speed * 15) * 10 * intensity } }),
  },
  {
    id: 'shrug', label: 'Dar de ombros', keywords: ['ombros', 'nao sei'], duration: 1100,
    sample: ({ intensity }) => ({ rig: { armLUpper: 42 * intensity, armRUpper: 42 * intensity, armLLower: 72 * intensity, armRLower: 72 * intensity, headTilt: -6 * intensity } }),
  },
  {
    id: 'think', label: 'Pensar', keywords: ['pensar', 'pensa'], duration: 2000, usesSide: true,
    sample: ({ intensity, side }) => ({ rig: { [arm(side, 'Upper')]: 26 * intensity, [arm(side, 'Lower')]: 138 * intensity, headTilt: 8 * intensity }, ...hand(side, 'fist'), expression: 'thinking' }),
  },
  {
    id: 'facepalm', label: 'Mão na testa', keywords: ['testa', 'facepalm'], duration: 1400, usesSide: true,
    sample: ({ intensity, side }) => ({ rig: { [arm(side, 'Upper')]: 42 * intensity, [arm(side, 'Lower')]: 142 * intensity, headTilt: 11 * intensity, headNod: 5 }, expression: 'tired' }),
  },
  {
    id: 'pick', label: 'Pegar objeto', keywords: ['pegar', 'pega', 'segurar'], duration: 900, usesSide: true,
    sample: ({ t, intensity, side }) => ({ rig: { sit: sin(t * Math.PI) * 0.35, torsoLean: sin(t * Math.PI) * 10, [arm(side, 'Upper')]: (30 + sin(t * Math.PI) * 24) * intensity, [arm(side, 'Lower')]: 35 * intensity } }),
  },
  {
    id: 'drop', label: 'Soltar objeto', keywords: ['soltar', 'solta', 'largar'], duration: 700, usesSide: true,
    sample: ({ t, intensity, side }) => ({ rig: { [arm(side, 'Upper')]: (55 * (1 - t)) * intensity, [arm(side, 'Lower')]: 35 * (1 - t) * intensity }, ...hand(side, 'open') }),
  },
  {
    id: 'hold', label: 'Segurar à frente', keywords: ['mostrar', 'erguer'], duration: 2000, usesSide: true,
    sample: ({ intensity, side }) => ({ rig: { [arm(side, 'Upper')]: 44 * intensity, [arm(side, 'Lower')]: 68 * intensity }, ...hand(side, 'fist') }),
  },
  {
    id: 'phone', label: 'Falar ao telefone', keywords: ['telefone', 'ligacao', 'ligar', 'celular'], duration: 2500, usesSide: true,
    sample: ({ ms, speed, intensity, side }) => ({ rig: { [arm(side, 'Upper')]: 34 * intensity, [arm(side, 'Lower')]: 150 * intensity, [arm(other(side), 'Upper')]: 8, headTilt: sin((ms / 1000) * speed * 1.7) * 3 }, ...hand(side, 'fist') }),
  },
];

const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));
export const getAction = (id: string): ActionDef | undefined => BY_ID.get(id);

/** Avalia um clip no tempo absoluto da cena (retorna null se fora do intervalo). */
export function sampleActionClip(clip: ActionClip, timeMs: number, sideAuto: 'L' | 'R'): (ActionSample & { weight: number }) | null {
  const def = BY_ID.get(clip.action);
  if (!def) return null;
  const local = timeMs - clip.startMs;
  if (local < 0 || local >= clip.durationMs) return null;
  const blend = Math.min(def.blend ?? 180, clip.durationMs / 2);
  const weight = Math.min(1, local / blend, (clip.durationMs - local) / blend);
  const eased = weight * weight * (3 - 2 * weight);
  const side = clip.side === 'auto' ? sideAuto : clip.side;
  const s = def.sample({ t: local / clip.durationMs, ms: local, speed: clip.speed, intensity: clip.intensity, side });
  return { ...s, weight: eased };
}

/** Ações cujo efeito permanece depois do clip (sentar continua sentado etc.). */
export const HOLD_AFTER: Record<string, Partial<Record<RigKey, number>>> = {
  sit: { sit: 1 },
};
