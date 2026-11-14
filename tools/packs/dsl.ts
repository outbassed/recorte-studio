/**
 * DSL compacta para criar itens: objetos e cenários feitos de peças (retângulo, elipse, triângulo, polígono, estrela,
 * linha, texto), personagens por parâmetros e poses por ângulos de articulação. Só gera dados que o motor já suporta.
 *
 * Convenção dos OBJETOS: origem no centro da base, eixo Y para CIMA (y=0 é o chão; o DSL inverte para o motor).
 * Convenção dos CENÁRIOS: coordenadas do mundo (1920×1080 visíveis, origem no centro), eixo Y para BAIXO como no motor.
 * IDs das peças são determinísticos (p0, p1…): o mesmo código gera sempre os mesmos bytes.
 */
import { CharacterDefinitionSchema, CustomBackgroundSchema, CustomObjectSchema, PieceSchema, RigSchema, type CharacterDefinition, type CustomObject, type Piece, type Rig } from '@/engine/model/schema';
import type { BuildItem, PackItemMeta } from '@/features/packs/format';

export const OUT = '#23202b';
type Spec = Partial<Piece> & { kind: Piece['kind'] };
export interface Opt { s?: string; sw?: number; r?: number; rot?: number; op?: number; flip?: boolean; sides?: number }

const mk = (kind: Piece['kind'], x: number, y: number, w: number, h: number, fill: string, o: Opt, up: boolean): Spec => ({
  kind, x, y: up ? -y : y, w, h, fill, stroke: o.s ?? OUT, strokeWidth: o.s === 'none' ? 0 : o.sw ?? 4, radius: o.r ?? 0, rotation: o.rot ?? 0, opacity: o.op ?? 1, flipX: !!o.flip, sides: o.sides ?? 6,
});

/** Peças de OBJETO (y para cima). R = retângulo, E = elipse, T = triângulo, G = polígono, S = estrela. */
export const R = (x: number, y: number, w: number, h: number, fill: string, o: Opt = {}): Spec => mk('rect', x, y, w, h, fill, o, true);
export const E = (x: number, y: number, w: number, h: number, fill: string, o: Opt = {}): Spec => mk('ellipse', x, y, w, h, fill, o, true);
export const T = (x: number, y: number, w: number, h: number, fill: string, o: Opt = {}): Spec => mk('triangle', x, y, w, h, fill, o, true);
export const G = (x: number, y: number, w: number, h: number, sides: number, fill: string, o: Opt = {}): Spec => mk('polygon', x, y, w, h, fill, { ...o, sides }, true);
export const S = (x: number, y: number, w: number, h: number, points: number, fill: string, o: Opt = {}): Spec => mk('star', x, y, w, h, fill, { ...o, sides: points }, true);
/** Linha de (x1,y1) a (x2,y2). */
export const L = (x1: number, y1: number, x2: number, y2: number, color: string, width = 6): Spec => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return { kind: 'line', x: (x1 + x2) / 2, y: -(y1 + y2) / 2, w: len, h: 0, stroke: color, strokeWidth: width, rotation: (Math.atan2(-(y2 - y1), x2 - x1) * 180) / Math.PI };
};
export const TX = (x: number, y: number, text: string, size: number, fill = '#ffffff', o: Opt = {}): Spec => ({ kind: 'text', x, y: -y, text, fontSize: size, fill, stroke: o.s ?? 'none', strokeWidth: o.s ? o.sw ?? 3 : 0, fontWeight: '900', rotation: o.rot ?? 0 });

const finish = (specs: Spec[], tag = 'p'): Piece[] => specs.map((s, i) => PieceSchema.parse({ name: `Peça ${i + 1}`, ...s, id: `${tag}${i}` }));

const extent = (specs: Spec[]) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const s of specs) {
    const w = s.kind === 'line' ? s.w ?? 0 : s.w ?? 0, h = s.kind === 'line' ? Math.abs(Math.sin(((s.rotation ?? 0) * Math.PI) / 180)) * w : s.h ?? 0;
    const hw = s.kind === 'line' ? Math.abs(Math.cos(((s.rotation ?? 0) * Math.PI) / 180)) * w / 2 : w / 2;
    x0 = Math.min(x0, (s.x ?? 0) - hw); x1 = Math.max(x1, (s.x ?? 0) + hw);
    y0 = Math.min(y0, (s.y ?? 0) - h / 2); y1 = Math.max(y1, (s.y ?? 0) + h / 2);
  }
  // O motor mede a caixa a partir do chão (y=0) e centrada em x=0: altura = chão até o topo; largura = 2 × maior alcance lateral.
  return { w: Math.round(Math.max(2 * Math.max(Math.abs(x0), Math.abs(x1)), 40)), h: Math.round(Math.max(-y0, 40)), cx: (x0 + x1) / 2 };
};

export interface Frames { name?: string; ms?: number; mode?: 'loop' | 'once' | 'pingpong'; frames: Spec[][] }
/** Quadros calculados: `frame(k)` devolve as peças do quadro k (0..n-1). */
export const frames = (n: number, frame: (k: number) => Spec[], o: { ms?: number; name?: string; mode?: Frames['mode'] } = {}): Frames => ({ name: o.name, ms: o.ms, mode: o.mode, frames: Array.from({ length: n }, (_, k) => frame(k)) });

type Cat = [category: string, sub?: string];
export interface ObjOpts { desc?: string; tags?: string[]; anim?: Frames }

/** Objeto (item de pacote). `id` é o ID final do item (hífens, no máximo 40 caracteres). */
export function obj(id: string, name: string, cat: Cat, specs: Spec[], o: ObjOpts = {}): BuildItem {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) throw new Error(`ID inválido: ${id}`);
  const ex = extent(o.anim ? [...specs, ...o.anim.frames.flat()] : specs);
  const clips = o.anim ? [{ id: 'anim', name: o.anim.name ?? 'Animação', mode: o.anim.mode ?? 'loop', frames: o.anim.frames.map((f, k) => ({ id: `q${k}`, durationMs: o.anim!.ms ?? 120, pieces: finish(f) })) }] : [];
  const object: CustomObject = CustomObjectSchema.parse({ id, name, width: ex.w, height: ex.h, pieces: finish(specs), clips, defaultClip: o.anim ? 'anim' : '' });
  const meta: PackItemMeta = { category: cat[0], subcategory: cat[1], tags: o.tags ?? [], description: o.desc ?? '' };
  return { id, kind: 'object', name, data: { bundle: 2, object, objects: [], assets: [] }, meta };
}

/* ------------------------------ cenários ------------------------------ */
export type TimeId = 'morning' | 'day' | 'afternoon' | 'sunset' | 'night';
export interface Pal { sky: string; ground: string; far: string; mid: string; wall: string; roof: string; accent: string; light: string; ink: string }
export const PAL: Record<'day' | 'sunset' | 'night', Pal> = {
  day: { sky: '#9fd3f0', ground: '#7fbf6a', far: '#a9c9a0', mid: '#8fb783', wall: '#f1e3c4', roof: '#c9574b', accent: '#e0b04c', light: '#fff6c8', ink: OUT },
  sunset: { sky: '#f2a65a', ground: '#6f9a58', far: '#b98a74', mid: '#8a6e6a', wall: '#e8c9a0', roof: '#a8473c', accent: '#f2c95c', light: '#ffd9a0', ink: OUT },
  night: { sky: '#1b2140', ground: '#2e4a3a', far: '#2a3355', mid: '#2a3050', wall: '#6c6a86', roof: '#4a3a5c', accent: '#f2c95c', light: '#ffe9a0', ink: '#0f1020' },
};
/** Peças de CENÁRIO (y para baixo, mundo do motor). */
export const BR = (x: number, y: number, w: number, h: number, fill: string, o: Opt = {}): Spec => mk('rect', x, y, w, h, fill, { s: 'none', ...o }, false);
export const BE = (x: number, y: number, w: number, h: number, fill: string, o: Opt = {}): Spec => mk('ellipse', x, y, w, h, fill, { s: 'none', ...o }, false);
export const BT = (x: number, y: number, w: number, h: number, fill: string, o: Opt = {}): Spec => mk('triangle', x, y, w, h, fill, { s: 'none', ...o }, false);
export const BG = (x: number, y: number, w: number, h: number, sides: number, fill: string, o: Opt = {}): Spec => mk('polygon', x, y, w, h, fill, { s: 'none', ...o, sides }, false);
export const BS = (x: number, y: number, w: number, h: number, points: number, fill: string, o: Opt = {}): Spec => mk('star', x, y, w, h, fill, { s: 'none', ...o, sides: points }, false);

export interface BgOpts { desc?: string; tags?: string[]; times?: TimeId[] }
type Draw = (p: Pal, t: TimeId) => Spec[];
/** Cenário com um desenho por horário (a paleta troca; o desenho acompanha). */
export function bg(id: string, name: string, cat: Cat, draw: Draw, o: BgOpts = {}): BuildItem {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(id)) throw new Error(`ID inválido: ${id}`);
  const times = o.times ?? ['day', 'night'];
  const compositions: Record<string, { sky: string; pieces: Piece[] }> = {};
  for (const t of times) {
    const pal = PAL[t === 'night' ? 'night' : t === 'sunset' || t === 'afternoon' ? 'sunset' : 'day'];
    compositions[t] = { sky: pal.sky, pieces: finish(draw(pal, t), `${t[0]}`) };
  }
  const background = CustomBackgroundSchema.parse({ id, name, compositions });
  return { id, kind: 'background', name, data: { bundle: 2, background, objects: [], assets: [] }, meta: { category: cat[0], subcategory: cat[1], tags: o.tags ?? [], description: o.desc ?? '' } };
}

/* ------------------------------ personagens e poses ------------------------------ */
type Part<T> = { [K in keyof T]?: Partial<T[K]> };
export interface Ch { id: string; name: string; sub: string; tags?: string[]; desc?: string; def: Omit<Part<CharacterDefinition>, 'accessories'> & { accessories?: Array<[string, string]> } }
export function character(c: Ch): BuildItem {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(c.id)) throw new Error(`ID inválido: ${c.id}`);
  const { accessories, ...rest } = c.def;
  const def = CharacterDefinitionSchema.parse({ id: c.id, name: c.name, ...rest, accessories: (accessories ?? []).map(([id, color]) => ({ id, color })) });
  return { id: c.id, kind: 'character', name: c.name, data: def, meta: { category: 'Personagens', subcategory: c.sub, tags: c.tags ?? [], description: c.desc ?? '' } };
}
export interface Ps { id: string; name: string; rig: Partial<Rig>; handL?: 'open' | 'fist' | 'point'; handR?: 'open' | 'fist' | 'point'; tags?: string[]; desc?: string; sub?: string }
export function pose(p: Ps): BuildItem {
  return { id: p.id, kind: 'pose', name: p.name, data: { rig: RigSchema.parse(p.rig), handL: p.handL ?? 'open', handR: p.handR ?? 'open' }, meta: { category: 'Poses', subcategory: p.sub, tags: p.tags ?? [], description: p.desc ?? '' } };
}
