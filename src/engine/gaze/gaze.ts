/**
 * Olhar e orientação da cabeça. Regra de regressão da 0.4: Nina à esquerda olhando
 * Zeca à direita → pupilas e nariz para a DIREITA; Zeca → para a ESQUERDA.
 */
import type { Gaze, ViewId, ViewOrAuto } from '../model/schema';
import { clamp } from '../render/svg';
import { bodyViewFromHead, headViewToward } from '../character/views';

export interface GazeInput {
  gaze: Gaze;
  /** centro da cabeça no mundo */
  headX: number;
  headY: number;
  /** alvo resolvido no mundo (null = alvo ausente) */
  target: { x: number; y: number } | null;
  headView: ViewOrAuto;
  bodyView: ViewOrAuto;
  /** Vista imposta pelo movimento (andar) quando em automático. */
  motionView?: ViewId | null;
}

export interface GazeResult {
  /** pupilas (−1…1) */
  gazeX: number;
  gazeY: number;
  headView: ViewId;
  bodyView: ViewId;
  hasTarget: boolean;
  dx: number;
  dy: number;
}

/** Distância em que as pupilas já saturam no canto da órbita. */
const FULL_RANGE = 220;

export function resolveGaze(i: GazeInput): GazeResult {
  const { gaze } = i;
  let dx = 0;
  let dy = 0;
  let hasTarget = false;
  if ((gaze.mode === 'node' || gaze.mode === 'point') && i.target) {
    dx = i.target.x - i.headX;
    dy = i.target.y - i.headY;
    hasTarget = true;
  } else if (gaze.mode === 'manual') {
    dx = gaze.x;
    dy = gaze.y;
    hasTarget = dx !== 0 || dy !== 0;
  }
  const strength = clamp(gaze.strength, 0, 1);
  const gazeX = hasTarget ? clamp(dx / FULL_RANGE, -1, 1) * strength : 0;
  const gazeY = hasTarget ? clamp(dy / (FULL_RANGE * 1.6), -1, 1) * strength : 0;

  let headView: ViewId;
  if (i.headView !== 'auto') headView = i.headView;
  else if (hasTarget && gaze.followHead && gaze.mode !== 'manual') headView = headViewToward(dx, gaze.headStrength);
  else if (i.motionView) headView = i.motionView;
  else headView = 'front';

  let bodyView: ViewId;
  if (i.bodyView !== 'auto') bodyView = i.bodyView;
  else if (i.motionView) bodyView = i.motionView;
  else bodyView = bodyViewFromHead(headView);

  return { gazeX, gazeY, headView, bodyView, hasTarget, dx, dy };
}
