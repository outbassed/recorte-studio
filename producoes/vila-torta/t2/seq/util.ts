import type { Shot } from '../../lib';
export type Look = string | { x: number; y: number } | 'cam';
/** Ator rápido: A(s,'bia',x,y,escala,olhar,expressão,{who,shirt,pose…}) */
export const A = (s: Shot, key: string, x: number, y: number, scale: number, look?: Look, ex = 'neutral', o: { who?: string; shirt?: string; pose?: string; skin?: string; hair?: string; headStrength?: number } = {}) =>
  s.actor(key, o.who ?? key, { x, y, scale, look, ex, shirt: o.shirt, pose: o.pose, skin: o.skin, hair: o.hair, headStrength: o.headStrength });
/** Objeto na mão: H(s,'ing','obj_ingresso','caique:R',0.3) */
export const H = (s: Shot, key: string, id: string, held: string, scale: number) => s.prop(key, id, { x: 0, y: 0, scale, held, noShadow: true });
export const FAN = ['#7b2fbf', '#14081f', '#c2185b', '#f2c95c'];
