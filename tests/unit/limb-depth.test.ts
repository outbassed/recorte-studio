/** Profundidade de braços e mãos em relação à cabeça: automática por pose e vista, e manual. */
import { describe, expect, it } from 'vitest';
import { getBuiltinCharacter, getPose, poseRig } from '@/engine/character/presets';
import { renderCharacter, type CharacterPose } from '@/engine/character/render';
import { VIEW_ORDER } from '@/engine/character/views';
import { CharacterNodeSchema, type ViewId } from '@/engine/model/schema';
import { applyPose } from '@/engine/model/ops';

const def = getBuiltinCharacter('nina') ?? getBuiltinCharacter('helena')!;
const make = (poseId: string, view: ViewId, limbDepth: CharacterPose['limbDepth'] = {}): CharacterPose => ({
  bodyView: view, headView: view, rig: poseRig(poseId), handL: getPose(poseId)?.handL ?? 'open', handR: getPose(poseId)?.handR ?? 'open',
  limbDepth: { ...(getPose(poseId)?.limbDepth ?? {}), ...limbDepth },
  face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 },
});
const doc = (svg: string) => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, 'image/svg+xml');
/** Ordem no documento: o que vem depois é desenhado por cima. */
function order(poseId: string, view: ViewId, extra?: CharacterPose['limbDepth']) {
  const d = doc(renderCharacter(def, make(poseId, view, extra), 't').svg);
  const all = [...d.querySelectorAll('[data-part]')];
  const head = all.findIndex((e) => e.getAttribute('data-part') === 'head');
  const at = (p: string) => all.findIndex((e) => e.getAttribute('data-part') === p);
  const rel = (p: string) => { const i = at(p); return i < 0 ? 'none' : i > head ? 'front' : 'behind'; };
  return { armL: rel('arm-L'), armR: rel('arm-R'), handL: at('hand-L') < 0 ? rel('arm-L') : rel('hand-L'), handR: at('hand-R') < 0 ? rel('arm-R') : rel('hand-R') };
}

describe('profundidade automática', () => {
  it('pose neutra: braços atrás da cabeça (sem sobreposição, nada muda)', () => {
    for (const v of ['front', 'front-left', 'left'] as ViewId[]) expect(order('idle', v)).toMatchObject({ armL: 'behind', armR: 'behind' });
  });
  it('vitória de frente e 3/4: braços que cruzam a cabeça passam na frente', () => {
    const f = order('victory', 'front');
    expect(f.armL === 'front' || f.armR === 'front').toBe(true);
    for (const v of ['front-left', 'front-right'] as ViewId[]) {
      const o = order('victory', v);
      expect([o.armL, o.armR]).toContain('front');
    }
  });
  it('vitória de costas: a cabeça fica na frente', () => {
    expect(order('victory', 'back')).toMatchObject({ armL: 'behind', armR: 'behind' });
  });
  it('braços cruzados não sobem à frente da cabeça', () => {
    expect(order('arms-crossed', 'front')).toMatchObject({ armL: 'behind', armR: 'behind' });
  });
  it('mãos no rosto: as mãos ficam na frente do rosto', () => {
    const o = order('hands-face', 'front');
    expect([o.handL, o.handR]).toContain('front');
  });
  it('mãos atrás da cabeça: a pose pede braços e mãos atrás', () => {
    expect(order('hands-behind-head', 'front')).toEqual({ armL: 'behind', armR: 'behind', handL: 'behind', handR: 'behind' });
  });
  it('aceno alto em perfil: o braço do lado de cá pode passar na frente; o do lado de lá nunca', () => {
    for (const v of ['left', 'right'] as ViewId[]) {
      const o = order('wave-L', v);
      expect(['front', 'behind']).toContain(o.armL);
    }
  });
});

describe('profundidade manual (lados do personagem)', () => {
  it('braço e mão podem ser diferentes', () => {
    const o = order('victory', 'front', { armL: 'behind', handL: 'front', armR: 'front', handR: 'behind' });
    expect(o).toEqual({ armL: 'behind', handL: 'front', armR: 'front', handR: 'behind' });
  });
  it('"atrás" vence o automático da vitória', () => {
    expect(order('victory', 'front', { armL: 'behind', handL: 'behind', armR: 'behind', handR: 'behind' })).toEqual({ armL: 'behind', armR: 'behind', handL: 'behind', handR: 'behind' });
  });
  it('todas as 8 vistas desenham os dois braços uma única vez, em qualquer combinação', () => {
    const modes = ['auto', 'front', 'behind'] as const;
    for (const v of VIEW_ORDER) {
      for (const m of modes) {
        const d = doc(renderCharacter(def, make('victory', v, { armL: m, handR: m }), 'x').svg);
        expect(d.querySelectorAll('[data-part="arm-L"]').length).toBe(1);
        expect(d.querySelectorAll('[data-part="arm-R"]').length).toBe(1);
        expect(d.querySelectorAll('[data-part="hand-L"]').length).toBeLessThanOrEqual(1);
      }
    }
  });
  it('projetos antigos ganham profundidade automática; aplicar pose define a sugestão da pose', () => {
    const n = CharacterNodeSchema.parse({ id: 'a', name: 'A', kind: 'character', characterId: 'c' });
    expect(n.limbDepth).toEqual({ armL: 'auto', handL: 'auto', armR: 'auto', handR: 'auto' });
    applyPose(n, 'hands-behind-head');
    expect(n.limbDepth.armL).toBe('behind');
    applyPose(n, 'victory');
    expect(n.limbDepth.armL).toBe('auto');
  });
});

describe('captura visual de oclusão', () => {
  it('gera a folha poses × 8 vistas para revisão (test-results/limb-depth.svg)', async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const poses = ['idle', 'victory', 'wave-L', 'arms-crossed', 'hands-face', 'facepalm', 'hands-behind-head'];
    let body = '';
    poses.forEach((p, row) => VIEW_ORDER.forEach((v, col) => {
      const r = renderCharacter(def, make(p, v), `s${row}${col}`);
      body += `<g transform="translate(${110 + col * 220} ${560 + row * 600}) scale(.9)">${r.svg}</g>`;
    }));
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/limb-depth.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_ORDER.length * 220} ${poses.length * 600}" style="background:#fff">${body}</svg>`);
  });
});
