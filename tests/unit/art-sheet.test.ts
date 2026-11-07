/**
 * Gera as folhas de referência visual (test-results/*.svg). Não valida pixels: os
 * asserts de geometria estão em views.test.ts; aqui garantimos que todo o catálogo
 * renderiza sem erro e produzimos material para inspeção humana.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { BUILTIN_CHARACTERS, getBuiltinCharacter } from '@/engine/character/presets';
import { renderCharacter, type CharacterPose } from '@/engine/character/render';
import { VIEW_ORDER } from '@/engine/character/views';
import { EXPRESSIONS } from '@/engine/character/expressions';
import { HAIR_STYLES } from '@/engine/character/hair';
import { RigSchema, type ViewId } from '@/engine/model/schema';

const pose = (view: ViewId, over: Partial<CharacterPose['face']> = {}): CharacterPose => ({
  bodyView: view,
  headView: view,
  rig: RigSchema.parse({}),
  handL: 'open',
  handR: 'open',
  face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0, ...over },
});

const wrap = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

describe('folhas de referência', () => {
  mkdirSync('test-results', { recursive: true });

  it('8 vistas para todo o elenco', () => {
    let body = '';
    BUILTIN_CHARACTERS.slice(0, 6).forEach((def, row) => {
      VIEW_ORDER.forEach((view, col) => {
        const r = renderCharacter(def, pose(view), `s${row}${col}`);
        expect(r.svg).toContain('data-part="root"');
        body += `<g transform="translate(${130 + col * 225} ${270 + row * 285}) scale(.42)">${r.svg}</g>`;
      });
    });
    writeFileSync('test-results/views.svg', wrap(1800, 1730, body));
  });

  it('elenco completo de frente e 3/4', () => {
    let body = '';
    BUILTIN_CHARACTERS.forEach((def, i) => {
      const r = renderCharacter(def, pose(i % 2 ? 'front-left' : 'front-right'), `c${i}`);
      body += `<g transform="translate(${150 + (i % 6) * 290} ${590 + Math.floor(i / 6) * 620}) scale(.92)">${r.svg}</g>`;
    });
    writeFileSync('test-results/cast.svg', wrap(1800, 1250, body));
  });

  it('todos os cabelos em 4 vistas', () => {
    const base = getBuiltinCharacter('otavio')!;
    let body = '';
    HAIR_STYLES.forEach((st, i) => {
      (['front', 'front-right', 'right', 'back'] as ViewId[]).forEach((v, j) => {
        const def = { ...base, hair: { ...base.hair, style: st.id, color: '#6a4a33' }, accessories: [], face: { ...base.face, beard: 'none' } };
        const r = renderCharacter(def, pose(v), `h${i}${j}`);
        body += `<g transform="translate(${70 + (i % 6) * 300 + j * 70} ${180 + Math.floor(i / 6) * 215}) scale(.27)">${r.svg}</g>`;
      });
    });
    writeFileSync('test-results/hair.svg', wrap(1800, 1120, body));
  });

  it('todas as expressões', () => {
    const def = getBuiltinCharacter('nina')!;
    let body = '';
    EXPRESSIONS.forEach((ex, i) => {
      const r = renderCharacter(def, pose('front', { expression: ex.id }), `e${i}`);
      body += `<g transform="translate(${110 + (i % 8) * 220} ${280 + Math.floor(i / 8) * 300}) scale(.46)">${r.svg}</g>`;
      body += `<text x="${110 + (i % 8) * 220}" y="${300 + Math.floor(i / 8) * 300}" font-size="16" text-anchor="middle">${ex.label}</text>`;
    });
    writeFileSync('test-results/expressions.svg', wrap(1800, 950, body));
  });
});
