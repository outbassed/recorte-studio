import { createPiece } from '@/engine/world/pieces';
import { createCustomBackground } from '@/engine/world/customBackgrounds';
import type { Piece, Project } from '@/engine/model/schema';
import type { BgSpec } from '../lib';
import { buildBackgrounds } from '../backgrounds';

const INK = '#23202b';
const BGR = (x: number, y: number, w: number, h: number, fill: string, o: Partial<Piece> = {}) => createPiece('rect', { x, y, w, h, fill, stroke: INK, strokeWidth: 0, ...o });
const R = (x: number, y: number, w: number, h: number, fill: string, o: Partial<Piece> = {}) => createPiece('rect', { x, y, w, h, fill, stroke: INK, strokeWidth: 4, ...o });

function bastidores(): Piece[] {
  const p: Piece[] = [BGR(0, -100, 2208, 800, '#241435', { name: 'Parede' }), BGR(0, 330, 2208, 560, '#3a3345', { name: 'Chão' })];
  for (let i = -4; i <= 4; i++) p.push(R(i * 250, -150, 190, 560, '#2b1840', { name: `Cortina ${i}`, strokeWidth: 3 }));
  p.push(R(-760, 120, 260, 150, '#14141c', { name: 'Case de equipamento', radius: 8 }), R(700, 120, 300, 160, '#14141c', { name: 'Case 2', radius: 8 }), R(0, 50, 420, 70, '#7b2fbf', { name: 'Espelho de camarim', radius: 8 }));
  return p;
}

export function buildBackgrounds2(project: Project): Record<string, BgSpec> {
  const base = buildBackgrounds(project);
  const cb = createCustomBackground(project, 'Bastidores do palco');
  cb.compositions.day = { sky: '#241435', pieces: bastidores() };
  return {
    rua: { preset: 'rua', variant: 'day' }, ruaFim: { preset: 'rua', variant: 'day', tone: 'dark' }, ruaNoite: { preset: 'rua', variant: 'night' },
    praca: { preset: 'praca', variant: 'day' }, pracaTarde: { preset: 'praca', variant: 'day', tone: 'dark' }, pracaNoite: { preset: 'praca', variant: 'night' },
    sala: base.sala!, delegacia: { preset: 'delegacia' }, bastidores: { preset: `custom:${cb.id}`, tod: 'day', parallax: 0.5 }, neutro: { preset: 'neutro' }, entrada: { preset: 'entrada' },
  };
}
