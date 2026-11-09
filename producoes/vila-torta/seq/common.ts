import type { Shot } from '../lib';

/** Poeira / fumaça: elipse que cresce, sobe e some (keyframes editáveis). */
export function puff(s: Shot, key: string, x: number, y: number, t0: number, o: { dur?: number; size?: number; rise?: number; color?: string; dx?: number } = {}) {
  const size = o.size ?? 90;
  s.shape(key, 'ellipse', { x, y, w: size, h: size * 0.75, fill: o.color ?? '#d9d2c4', stroke: '#a39b8a', sw: 3, opacity: 0, sx: 0.3, sy: 0.3 });
  const d = o.dur ?? 900;
  s.k(key, 'opacity', [[0, 0, 'hold'], [t0, 0.9, 'easeOut'], [t0 + d, 0, 'easeIn']]);
  s.k(key, 'transform.scaleX', [[t0, 0.3, 'linear'], [t0 + d, 1.5, 'easeOut']]);
  s.k(key, 'transform.scaleY', [[t0, 0.3, 'linear'], [t0 + d, 1.5, 'easeOut']]);
  s.k(key, 'transform.y', [[t0, y, 'linear'], [t0 + d, y - (o.rise ?? 60), 'easeOut']]);
  s.k(key, 'transform.x', [[t0, x, 'linear'], [t0 + d, x + (o.dx ?? 0), 'easeOut']]);
}

/** Balão de onomatopeia: estrela amarela + texto com "pulo" elástico. */
export function sfx(s: Shot, key: string, text: string, x: number, y: number, t0: number, o: { size?: number; hold?: number; rot?: number; color?: string } = {}) {
  const size = o.size ?? 110;
  const hold = o.hold ?? 1100;
  s.shape(`${key}:estrela`, 'burst', { x, y, w: size * 3.2, h: size * 2.1, fill: o.color ?? '#f2c95c', sw: 6, rot: o.rot ?? -8, sx: 0.01, sy: 0.01, opacity: 0 });
  s.text(`${key}:texto`, text, { x, y, size, color: '#fff7e6', stroke: '#23202b', sw: 10, rot: o.rot ?? -8, sx: 0.01, sy: 0.01, opacity: 0 });
  for (const k of [`${key}:estrela`, `${key}:texto`]) {
    s.k(k, 'opacity', [[0, 0, 'hold'], [t0, 1, 'hold'], [t0 + hold, 1, 'hold'], [t0 + hold + 250, 0, 'easeIn']]);
    s.k(k, 'transform.scaleX', [[t0, 0.05, 'linear'], [t0 + 220, 1.15, 'backOut'], [t0 + hold, 1, 'linear']]);
    s.k(k, 'transform.scaleY', [[t0, 0.05, 'linear'], [t0 + 220, 1.15, 'backOut'], [t0 + hold, 1, 'linear']]);
  }
}

export const RUA = { hole: { x: 150, y: 398, s: 0.9 }, carFinalX: 20, gs: 0.8, roadY: 410 };

/** Elementos fixos da Rua das Mangueiras (mesmos em todas as tomadas: continuidade). */
export function ruaSet(s: Shot, o: { hole?: boolean; sign?: boolean } = {}) {
  s.prop('mangueira-esq', 'tree', { x: -820, y: 175, scale: 0.62, a: '#4f9a5c', bottom: true, parallax: 1 });
  s.prop('mangueira-dir', 'tree', { x: 790, y: 178, scale: 0.7, a: '#4f9a5c', bottom: true });
  if (o.sign !== false) {
    s.prop('poste-rua', 'obj_placa_secao', { x: -610, y: 200, scale: 0.42, vis: false });
  }
  if (o.hole !== false) s.prop('buraco', 'obj_buraco', { x: RUA.hole.x, y: RUA.hole.y, scale: RUA.hole.s, noShadow: true });
}

import type { Builder, BgSpec, SayOpts } from '../lib';

export type Frame = ['wide'] | ['close' | 'medium' | 'full', string, { dx?: number; dy?: number; zoom?: number }?] | ['two' | 'over', [string, string], { dx?: number; dy?: number; zoom?: number }?];
export type Line = [who: string, text: string, (SayOpts & { gapBefore?: number })?];

/**
 * Tomada de conversa: posiciona o conjunto (para continuidade), enquadra e agenda as falas em sequência.
 * `extra` permite expressões, reações e movimentos específicos da tomada.
 */
export function convo(B: Builder, name: string, bg: BgSpec | string, place: (s: import('../lib').Shot) => void, frame: Frame, lines: Line[], o: { pad?: number; pre?: number; dur?: number; extra?: (s: import('../lib').Shot) => void; cam?: { to: { x?: number; y?: number; zoom?: number }; dur?: number } } = {}) {
  return B.shot(name, bg, o.dur ?? 1500, (s) => {
    place(s);
    if (frame[0] === 'wide') s.cam0({});
    else s.frame(frame[0], (Array.isArray(frame[1]) ? frame[1] : [frame[1]]) as string[], (frame[2] as { dx?: number; dy?: number; zoom?: number } | undefined) ?? {});
    s.t = o.pre ?? 350;
    o.extra?.(s);
    for (const [who, text, op] of lines) {
      if (op?.gapBefore) s.wait(op.gapBefore);
      s.say(who, text, op);
    }
    if (o.cam) s.cam(0, o.cam.to, o.cam.dur ?? Math.max(1500, s.t), 'easeInOut');
    s.end(o.pad ?? 350);
    if (o.dur) s.scene.durationMs = Math.max(o.dur, s.scene.durationMs);
  });
}

/** Figurantes (multidão) com camisetas da cor do candidato. */
export const COR = { G: '#e98f4e', P: '#3b6fb6' } as const;
export function figurante(s: import('../lib').Shot, key: string, who: 'e1' | 'e2' | 'e3' | 'e4' | 'e5' | 'e6', side: 'G' | 'P', x: number, y: number, scale: number, o: { look?: string | { x: number; y: number }; ex?: string } = {}) {
  s.actor(key, who, { x, y, scale, shirt: COR[side], look: o.look, ex: o.ex ?? (side === 'G' ? 'proud' : 'angry') });
}
