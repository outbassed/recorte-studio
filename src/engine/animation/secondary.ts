/**
 * Movimento secundário: respiração, oscilação da cabeça, olhares rápidos e troca de
 * peso. Tudo é função pura de (nó, tempo): seek, reprodução e exportação dão o mesmo
 * quadro. Durante ações explícitas o movimento secundário diminui para não brigar com elas.
 */
import type { Rig, SecondaryMotion } from '../model/schema';
import { hashString } from '../render/svg';

export interface SecondarySample {
  rig: Partial<Rig>;
  gazeX: number;
  gazeY: number;
}

const TAU = Math.PI * 2;

/** Ruído suave e determinístico (soma de senos com fases do nó). */
function wobble(seed: number, t: number, base: number): number {
  const p1 = ((seed % 997) / 997) * TAU;
  const p2 = ((seed % 499) / 499) * TAU;
  return Math.sin(t * base + p1) * 0.65 + Math.sin(t * base * 2.31 + p2) * 0.35;
}

/** Valor escalonado: muda de patamar a cada período, com transição curta. */
function steps(seed: number, t: number, periodMs: number): { x: number; y: number } {
  const local = t + (seed % periodMs);
  const i = Math.floor(local / periodMs);
  const frac = (local % periodMs) / periodMs;
  const at = (k: number) => {
    const h = hashString(`${seed}:${k}`);
    return { x: ((h & 0xffff) / 0xffff) * 2 - 1, y: (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1 };
  };
  const a = at(i - 1);
  const b = at(i);
  // Olhos saltam rápido (sacada): 8% do período para mudar de ponto.
  const k = Math.min(1, frac / 0.08);
  const e = k * k * (3 - 2 * k);
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
}

export function sampleSecondary(nodeId: string, timeMs: number, cfg: SecondaryMotion, suppress: number): SecondarySample {
  if (!cfg.enabled) return { rig: {}, gazeX: 0, gazeY: 0 };
  const seed = hashString(nodeId);
  const t = timeMs / 1000;
  const k = Math.max(0, 1 - suppress);
  const breathRate = TAU / (3.4 + (seed % 7) * 0.12);
  const breath = (Math.sin(t * breathRate + (seed % 13)) + 1) / 2;
  const sway = cfg.headSway * k;
  const posture = cfg.posture * k;
  const darts = steps(seed, timeMs, 1700 + (seed % 1300));
  return {
    rig: {
      breath: breath * cfg.breathing,
      headTilt: wobble(seed, t, 0.55) * 2.2 * sway,
      headNod: wobble(seed + 7, t, 0.8) * 1.6 * sway,
      torsoLean: wobble(seed + 13, t, 0.17) * 1.4 * posture,
      armLUpper: wobble(seed + 21, t, 0.3) * 1.5 * posture,
      armRUpper: wobble(seed + 29, t, 0.27) * 1.5 * posture,
    },
    gazeX: darts.x * 0.16 * cfg.eyeDarts * k,
    gazeY: darts.y * 0.1 * cfg.eyeDarts * k,
  };
}
