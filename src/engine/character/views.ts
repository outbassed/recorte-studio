/**
 * Sistema de vistas 2D: 8 vistas discretas. Não existe malha 3D nem interpolação
 * contínua: cada vista é um TEMPLATE explícito de posições, larguras e ordem de
 * desenho. O "yaw" é só um índice angular usado para escolher o template.
 *
 * Convenção: yaw > 0 = personagem voltado para a DIREITA DA TELA.
 */
import type { ViewId } from '../model/schema';

export const VIEW_ORDER: ViewId[] = ['front', 'front-right', 'right', 'back-right', 'back', 'back-left', 'left', 'front-left'];

export const VIEW_LABELS: Record<ViewId, string> = {
  front: 'Frente',
  'front-left': 'Frente 3/4 esquerda',
  left: 'Perfil esquerdo',
  'back-left': 'Traseiro 3/4 esquerda',
  back: 'Costas',
  'back-right': 'Traseiro 3/4 direita',
  right: 'Perfil direito',
  'front-right': 'Frente 3/4 direita',
};

export const VIEW_YAW: Record<ViewId, number> = {
  front: 0,
  'front-right': 45,
  right: 90,
  'back-right': 135,
  back: 180,
  'back-left': -135,
  left: -90,
  'front-left': -45,
};

export type ViewClass = 'front' | 'quarter' | 'profile' | 'backQuarter' | 'back';

export interface ViewInfo {
  id: ViewId;
  yaw: number;
  /** -1 voltado à esquerda da tela, 1 à direita, 0 frente/costas. */
  facing: -1 | 0 | 1;
  cls: ViewClass;
  showsFace: boolean;
  /** Multiplicador da largura do tronco. */
  bodyWidth: number;
}

const classOf = (v: ViewId): ViewClass => {
  if (v === 'front') return 'front';
  if (v === 'back') return 'back';
  if (v === 'left' || v === 'right') return 'profile';
  return v.startsWith('back') ? 'backQuarter' : 'quarter';
};

export function viewInfo(id: ViewId): ViewInfo {
  const yaw = VIEW_YAW[id];
  const cls = classOf(id);
  const facing = yaw === 0 || yaw === 180 ? 0 : yaw > 0 ? 1 : -1;
  return {
    id,
    yaw,
    facing,
    cls,
    showsFace: cls === 'front' || cls === 'quarter' || cls === 'profile',
    bodyWidth: cls === 'front' || cls === 'back' ? 1 : cls === 'profile' ? 0.62 : 0.84,
  };
}

/** Posição horizontal (−1…1) de um azimute da superfície, para a vista dada. */
export const azX = (yaw: number, azDeg: number): number => Math.sin(((yaw + azDeg) * Math.PI) / 180);
/** Profundidade: > 0 voltado ao observador. */
export const azZ = (yaw: number, azDeg: number): number => Math.cos(((yaw + azDeg) * Math.PI) / 180);

/**
 * Vista da cabeça para olhar a um alvo na horizontal. headStrength: 0 = não vira,
 * 0,5 = 3/4, 1 = perfil. O nariz SEMPRE aponta para o lado do alvo.
 */
export function headViewToward(dx: number, headStrength: number): ViewId {
  if (Math.abs(dx) < 1 || headStrength < 0.2) return 'front';
  const right = dx > 0;
  if (headStrength >= 0.75) return right ? 'right' : 'left';
  return right ? 'front-right' : 'front-left';
}

/** Corpo em modo automático acompanha a cabeça sem nunca ir além de 3/4. */
export function bodyViewFromHead(head: ViewId): ViewId {
  const f = viewInfo(head);
  if (f.cls === 'profile') return head === 'right' ? 'front-right' : 'front-left';
  return head;
}
