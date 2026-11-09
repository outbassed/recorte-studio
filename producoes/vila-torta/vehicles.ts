/** Veículos animados: carroceria + molas + rodas que giram de verdade (rotação = distância percorrida / raio). */
import type { Shot } from './lib';

export interface Veh {
  g: string; body: string; wf: string; wr: string; sf: string; sr: string; gs: number; baseY: number; kind: 'car' | 'truck';
  front: number; rear: number;
}
const WHEEL_R = 60;

/** Cria o veículo como grupo (editável) de nós: carroceria, molas, rodas. */
export function vehicle(s: Shot, key: string, kind: 'car' | 'truck', o: { x: number; y: number; gs?: number; bodyTilt?: number; frontDip?: number }): Veh {
  const gs = o.gs ?? 0.8;
  const front = kind === 'car' ? 210 : 200;
  const rear = -210;
  const bodyId = kind === 'car' ? 'obj_carro_corpo' : 'obj_caminhao';
  s.prop(`${key}:corpo`, bodyId, { x: 0, y: 0, scale: 1, noShadow: true, pivot: [rear, -WHEEL_R] });
  s.prop(`${key}:mola-tras`, 'obj_mola', { x: rear, y: -138, noShadow: true });
  s.prop(`${key}:mola-frente`, 'obj_mola', { x: front, y: -138, noShadow: true });
  s.prop(`${key}:roda-tras`, 'obj_roda', { x: rear, y: -WHEEL_R, noShadow: true });
  s.prop(`${key}:roda-frente`, 'obj_roda', { x: front, y: -WHEEL_R + (o.frontDip ?? 0), noShadow: true });
  const g = s.group(key, [`${key}:corpo`, `${key}:mola-tras`, `${key}:mola-frente`, `${key}:roda-tras`, `${key}:roda-frente`], { x: o.x, y: o.y, scale: gs });
  void g;
  const nb = s.scene.nodes[s.id(`${key}:corpo`)]!;
  if (o.bodyTilt) nb.transform.rotationDeg = o.bodyTilt;
  return { g: key, body: `${key}:corpo`, wf: `${key}:roda-frente`, wr: `${key}:roda-tras`, sf: `${key}:mola-frente`, sr: `${key}:mola-tras`, gs, baseY: o.y, kind, front, rear };
}

/**
 * Anda de x0 a x1 em [t0,t1] (curva de velocidade configurável) e gira as duas rodas de acordo
 * com o deslocamento real. Amostra a curva em segmentos lineares para posição e giro baterem.
 */
export function drive(s: Shot, v: Veh, t0: number, t1: number, x0: number, x1: number, o: { ease?: 'linear' | 'out' | 'in' | 'inout'; rot0?: number; steps?: number; key?: string } = {}): { rotEnd: number } {
  const steps = o.steps ?? 10;
  const f = (u: number) => (o.ease === 'out' ? 1 - (1 - u) * (1 - u) : o.ease === 'in' ? u * u : o.ease === 'inout' ? (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2) : u);
  const gk = o.key ?? v.g;
  const xs: Array<[number, number]> = [];
  const rs: Array<[number, number]> = [];
  const r0 = o.rot0 ?? 0;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = x0 + (x1 - x0) * f(u);
    const t = Math.round(t0 + (t1 - t0) * u);
    xs.push([t, x]);
    rs.push([t, r0 + ((x - x0) / (WHEEL_R * v.gs)) * (180 / Math.PI)]);
  }
  s.k(gk, 'transform.x', xs.map(([t, x]) => [t, x, 'linear'] as [number, number, 'linear']));
  s.k(v.wf, 'transform.rotationDeg', rs.map(([t, r]) => [t, r, 'linear'] as [number, number, 'linear']));
  s.k(v.wr, 'transform.rotationDeg', rs.map(([t, r]) => [t, r, 'linear'] as [number, number, 'linear']));
  return { rotEnd: rs[rs.length - 1]![1] };
}
