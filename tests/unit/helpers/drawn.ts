/** Auxiliares de teste: lê as transformações aninhadas de um SVG gerado e devolve onde a mão FOI DESENHADA. */
import { bodyMetrics, handSizeOf } from '@/engine/character/render';
import type { CharacterDefinition } from '@/engine/model/schema';

export type M = [number, number, number, number, number, number];
export const IDM: M = [1, 0, 0, 1, 0, 0];
export const mul = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
export const applyM = (m: M, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

export function parseTransform(t: string | null): M {
  let m: M = IDM;
  for (const tok of (t ?? '').matchAll(/(translate|rotate|scale|matrix)\(([^)]*)\)/g)) {
    const v = tok[2]!.trim().split(/[\s,]+/).map(Number);
    if (tok[1] === 'translate') m = mul(m, [1, 0, 0, 1, v[0]!, v[1] ?? 0]);
    else if (tok[1] === 'scale') m = mul(m, [v[0]!, 0, 0, v[1] ?? v[0]!, 0, 0]);
    else if (tok[1] === 'matrix') m = mul(m, v as M);
    else {
      const a = (v[0]! * Math.PI) / 180;
      const c = Math.cos(a), s = Math.sin(a);
      const rot: M = [c, s, -s, c, 0, 0];
      m = v.length >= 3 ? mul(mul(mul(m, [1, 0, 0, 1, v[1]!, v[2]!]), rot), [1, 0, 0, 1, -v[1]!, -v[2]!]) : mul(m, rot);
    }
  }
  return m;
}

export function parseSvg(svg: string): Document {
  const full = /^\s*<svg/i.test(svg) ? svg : `<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
  return new DOMParser().parseFromString(full, 'image/svg+xml');
}

/** Produto das transformações do elemento e de todos os ancestrais (do <svg> até ele). */
export function chainOf(el: Element | null, includeSelf = true): M {
  const chain: Element[] = [];
  for (let e: Element | null = includeSelf ? el : el?.parentElement ?? null; e && e.tagName.toLowerCase() !== 'svg'; e = e.parentElement) chain.unshift(e);
  let m: M = IDM;
  for (const e of chain) m = mul(m, parseTransform(e.getAttribute('transform')));
  return m;
}

/** Ponta da mão (a mesma usada pelo IK e por objetos segurados) no espaço do SVG inteiro, dentro de `root`. */
export function drawnHandIn(def: CharacterDefinition, root: Element, side: 'L' | 'R'): { x: number; y: number } {
  const g = root.querySelector(`g[data-part="arm-${side}"], g[data-part="hand-${side}"]`);
  if (!g) throw new Error('braço não encontrado no SVG');
  const lower = g.querySelector(':scope > g[transform]');
  if (!lower) throw new Error('antebraço não encontrado');
  const tip = bodyMetrics(def).forearm + handSizeOf(def) * 1.2;
  return applyM(chainOf(lower), 0, tip);
}
