/**
 * Regressão visual: TODOS os penteados × as 8 vistas, com mechas e acessórios.
 * Os asserts verificam profundidade (o que fica atrás/na frente da cabeça) e recortes;
 * a folha em test-results/hair-matrix.svg é para inspeção humana.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getBuiltinCharacter } from '@/engine/character/presets';
import { renderCharacter, type CharacterPose } from '@/engine/character/render';
import { VIEW_ORDER, viewInfo } from '@/engine/character/views';
import { HAIR_STYLES } from '@/engine/character/hair';
import { RigSchema, type CharacterDefinition, type ViewId } from '@/engine/model/schema';
import { hashString } from '@/engine/render/svg';

const pose = (view: ViewId): CharacterPose => ({
  bodyView: view, headView: view, rig: RigSchema.parse({}), handL: 'open', handR: 'open',
  face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 },
});
const base = getBuiltinCharacter('helena')!;
const variant = (style: string, i: number): CharacterDefinition => ({
  ...base,
  hair: { ...base.hair, style, color: '#7a4a2f', highlight: '#f2c95c' },
  accessories: i % 3 === 0 ? [{ id: 'glasses', color: '#2b2d3a' }] : i % 3 === 1 ? [{ id: 'earrings', color: '#f2c95c' }] : [],
});
const parse = (svg: string) => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, 'image/svg+xml');

/** Posição no documento: antes da forma da cabeça = atrás dela. */
const isBefore = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('matriz cabelos × vistas', () => {
  mkdirSync('test-results', { recursive: true });

  it('renderiza tudo e gera a folha de inspeção', () => {
    let body = '';
    const hashes: Record<string, string> = {};
    HAIR_STYLES.forEach((st, i) => {
      VIEW_ORDER.forEach((v, j) => {
        const r = renderCharacter(variant(st.id, i), pose(v), `m${i}_${j}`);
        expect(r.svg, `${st.id}/${v}`).toContain('data-part="root"');
        hashes[`${st.id}/${v}`] = hashString(r.svg).toString(36);
        body += `<g transform="translate(${46 + j * 92 + (i % 2) * 760} ${118 + Math.floor(i / 2) * 120}) scale(.17)">${r.svg}</g>`;
      });
      body += `<text x="${4 + (i % 2) * 760}" y="${26 + Math.floor(i / 2) * 120}" font-size="12" font-family="Arial">${st.label}</text>`;
    });
    const rows = Math.ceil(HAIR_STYLES.length / 2);
    writeFileSync('test-results/hair-matrix.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1520" height="${rows * 120 + 20}" viewBox="0 0 1520 ${rows * 120 + 20}"><rect width="100%" height="100%" fill="#8fa3b5"/>${body}</svg>`);
    // Snapshot compacto (hash por combinação): qualquer mudança visual aparece na revisão.
    expect(hashes).toMatchSnapshot();
  });

  it('mechas e brilho ficam recortados pela calota do cabelo', () => {
    HAIR_STYLES.filter((s) => !s.bald).forEach((st, i) => {
      for (const v of VIEW_ORDER) {
        const d = parse(renderCharacter(variant(st.id, i), pose(v), 'x').svg);
        for (const hl of d.querySelectorAll('[data-part="hair-highlight"], [data-part="hair-shine"]')) {
          const clip = hl.closest('[clip-path]')?.getAttribute('clip-path') ?? hl.getAttribute('clip-path');
          expect(clip, `${st.id}/${v}`).toMatch(/^url\(#/);
        }
      }
    });
  });

  it('presos que ficam atrás da cabeça vêm antes dela; os visíveis vêm depois', () => {
    for (const id of ['ponytail', 'bun', 'pigtails', 'braids', 'puffs', 'topknot']) {
      for (const v of VIEW_ORDER) {
        const d = parse(renderCharacter(variant(id, 1), pose(v), 'x').svg);
        const head = d.querySelector('[data-part="head-shape"]')!;
        for (const el of d.querySelectorAll('[data-depth]')) {
          const depth = el.getAttribute('data-depth');
          if (depth === 'behind') expect(isBefore(el, head), `${id}/${v} deveria ficar atrás`).toBe(true);
          if (depth === 'front') expect(isBefore(head, el), `${id}/${v} deveria ficar na frente`).toBe(true);
        }
      }
    }
  });

  it('de costas, rabo de cavalo e coque aparecem POR CIMA da nuca', () => {
    for (const id of ['ponytail', 'bun']) {
      const d = parse(renderCharacter(variant(id, 1), pose('back'), 'x').svg);
      const head = d.querySelector('[data-part="head-shape"]')!;
      const tied = d.querySelector(id === 'ponytail' ? '[data-part="hair-lock"]' : '[data-part="hair-blob"]')!;
      expect(isBefore(head, tied), id).toBe(true);
    }
  });

  it('de frente, rabo de cavalo e coque ficam ATRÁS da cabeça', () => {
    for (const id of ['ponytail', 'bun']) {
      const d = parse(renderCharacter(variant(id, 1), pose('front'), 'x').svg);
      const head = d.querySelector('[data-part="head-shape"]')!;
      const tied = d.querySelector(id === 'ponytail' ? '[data-part="hair-lock"]' : '[data-part="hair-blob"]')!;
      expect(isBefore(tied, head), id).toBe(true);
    }
  });

  it('de perfil, a trança do lado de lá fica atrás da cabeça, a do lado de cá na frente', () => {
    for (const v of ['left', 'right'] as ViewId[]) {
      const d = parse(renderCharacter(variant('braids', 1), pose(v), 'x').svg);
      const head = d.querySelector('[data-part="head-shape"]')!;
      const braids = [...d.querySelectorAll('[data-part="hair-lock"]')];
      expect(braids).toHaveLength(2);
      expect(braids.filter((b) => isBefore(b, head))).toHaveLength(1);
      expect(braids.filter((b) => isBefore(head, b))).toHaveLength(1);
    }
  });

  it('cabelo longo fica atrás do corpo de frente e sobre as costas de costas', () => {
    for (const v of VIEW_ORDER) {
      const d = parse(renderCharacter(variant('long', 1), pose(v), 'x').svg);
      const torso = d.querySelector('[data-part="torso"]')!;
      const back = d.querySelector('[data-part="hair-back"]')!;
      // Frente e 3/4 de frente: atrás do tronco. Perfil e costas: sobre as costas.
      const overBody = !viewInfo(v).showsFace || viewInfo(v).cls === 'profile';
      expect(isBefore(back, torso), `long/${v}`).toBe(!overBody);
    }
  });

  it('rosto continua coerente em todas as vistas: 1 boca, olhos e nariz certos', () => {
    HAIR_STYLES.forEach((st, i) => {
      for (const v of VIEW_ORDER) {
        const d = parse(renderCharacter(variant(st.id, i), pose(v), 'x').svg);
        const info = viewInfo(v);
        expect(d.querySelectorAll('[data-part="mouth"]').length).toBe(info.showsFace ? 1 : 0);
        expect(d.querySelectorAll('[data-part="eye"]').length).toBe(!info.showsFace ? 0 : info.cls === 'profile' ? 1 : 2);
        const nose = d.querySelector('[data-part="nose"]');
        if (info.facing && nose) expect(Math.sign(Number(nose.getAttribute('data-tip-x')))).toBe(info.facing);
      }
    });
  });
});

/* ---------------- 1.2: cabelos longos, oclusão por geometria ---------------- */
import { renderHair } from '@/engine/character/hair';
const LONG = HAIR_STYLES.filter((h) => h.backLen > 0).map((h) => h.id);
/** Pares x,y de um path absoluto (M/L/C/Q/Z). */
const xsOf = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0);
const backD = (svg: string) => /data-part="hair-back"[^>]*\sd="([^"]+)"|\sd="([^"]+)"[^>]*data-part="hair-back"/.exec(svg);

describe('cabelos longos nas 8 vistas', () => {
  const rx = 100;
  const ry = 112;
  it('há estilos longos para verificar', () => expect(LONG.length).toBeGreaterThanOrEqual(6));
  for (const id of LONG) {
    it(`${id}: perfil nunca passa para a frente do pescoço; camada certa em cada vista`, () => {
      for (const v of VIEW_ORDER) {
        const view = viewInfo(v);
        const r = renderHair({ styleId: id, color: '#7a4a2f', highlight: '#f2c95c', ink: '#222', ow: 4, rx, ry, view, idPrefix: 'x' });
        const all = r.backBehindBody + r.backOverBody;
        const m = backD(all);
        expect(m, `${id} ${v} tem massa traseira`).toBeTruthy();
        const xs = xsOf((m![1] ?? m![2])!);
        if (view.cls === 'profile') {
          // Frente do rosto = lado +facing. Nada da massa traseira à frente da nuca.
          const forward = Math.max(...xs.map((x) => x * view.facing));
          expect(forward, `${id} ${v}`).toBeLessThanOrEqual(rx * 0.05);
          expect(r.backOverBody).toContain('hair-back');
        } else if (view.cls === 'back' || view.cls === 'backQuarter') {
          expect(r.backOverBody, `${id} ${v}`).toContain('hair-back');
        } else {
          expect(r.backBehindBody, `${id} ${v}`).toContain('hair-back');
          expect(r.backOverBody, `${id} ${v}`).not.toContain('hair-back');
        }
      }
    });
  }
  it('folha de inspeção dos longos em escala maior (test-results/hair-long.svg)', () => {
    let body = '';
    LONG.forEach((style, row) => VIEW_ORDER.forEach((v, col) => {
      const r = renderCharacter(variant(style, 2), pose(v), `l${row}${col}`);
      body += `<g transform="translate(${100 + col * 200} ${470 + row * 520}) scale(.8)">${r.svg}</g>`;
    }));
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/hair-long.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 ${LONG.length * 520}" style="background:#8fa3b5">${body}</svg>`);
  });
});
