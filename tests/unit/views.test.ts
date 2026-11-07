/** Regressões faciais da 0.4: boca, olhos, nariz e olhar, para todas as vistas. */
import { describe, expect, it } from 'vitest';
import { BUILTIN_CHARACTERS, getBuiltinCharacter } from '@/engine/character/presets';
import { renderCharacter, type CharacterPose } from '@/engine/character/render';
import { VIEW_ORDER, viewInfo, headViewToward } from '@/engine/character/views';
import { EXPRESSIONS, VISEMES } from '@/engine/character/expressions';
import { FAR_EYE_SCALE } from '@/engine/character/face';
import { RigSchema, type ViewId } from '@/engine/model/schema';
import { resolveGaze } from '@/engine/gaze/gaze';
import { GazeSchema } from '@/engine/model/schema';
import { evaluateScene } from '@/engine/animation/evaluate';
import { createDemoProject } from '@/features/templates/projects';
import { deleteNode, sceneOf } from '@/engine/model/ops';

const pose = (view: ViewId, f: Partial<CharacterPose['face']> = {}): CharacterPose => ({
  bodyView: view, headView: view, rig: RigSchema.parse({}), handL: 'open', handR: 'open',
  face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0, ...f },
});

const parse = (svg: string) => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, 'image/svg+xml');
const render = (id: string, p: CharacterPose) => parse(renderCharacter(getBuiltinCharacter(id)!, p, 'x').svg);
const count = (doc: Document, part: string) => doc.querySelectorAll(`[data-part="${part}"]`).length;

describe('8 vistas', () => {
  const nina = 'nina';
  const zeca = 'zeca';
  it.each(VIEW_ORDER)('vista %s de dois personagens gera SVG distinto e estável', (view) => {
    const a = renderCharacter(getBuiltinCharacter(nina)!, pose(view), 's').svg;
    const b = renderCharacter(getBuiltinCharacter(zeca)!, pose(view), 's').svg;
    expect(a).not.toEqual(b);
    expect(renderCharacter(getBuiltinCharacter(nina)!, pose(view), 's').svg).toEqual(a);
    expect(a).toMatchSnapshot(`nina-${view}`);
    expect(b).toMatchSnapshot(`zeca-${view}`);
  });

  it('todas as 8 vistas têm desenho diferente', () => {
    const set = new Set(VIEW_ORDER.map((v) => renderCharacter(getBuiltinCharacter(nina)!, pose(v), 's').svg));
    expect(set.size).toBe(8);
  });
});

describe('boca única', () => {
  const faceViews = VIEW_ORDER.filter((v) => viewInfo(v).showsFace);
  const backViews = VIEW_ORDER.filter((v) => !viewInfo(v).showsFace);

  it('uma boca por rosto em toda combinação de expressão, visema e vista', () => {
    for (const c of BUILTIN_CHARACTERS) {
      for (const view of faceViews) {
        for (const ex of EXPRESSIONS) {
          expect(count(render(c.builtinId!, pose(view, { expression: ex.id })), 'mouth')).toBe(1);
        }
        for (const v of Object.keys(VISEMES)) {
          expect(count(render(c.builtinId!, pose(view, { expression: 'angry', viseme: v, visemeAmount: 1 })), 'mouth')).toBe(1);
        }
      }
    }
  }, 60000);

  it('vista de costas não desenha boca, olhos nem nariz', () => {
    for (const view of backViews) {
      const d = render('nina', pose(view));
      expect(count(d, 'mouth')).toBe(0);
      expect(count(d, 'eye')).toBe(0);
      expect(count(d, 'nose')).toBe(0);
    }
  });

  it('falar troca a forma da boca, não adiciona outra', () => {
    const d1 = render('zeca', pose('front-right', { expression: 'happy' }));
    const d2 = render('zeca', pose('front-right', { expression: 'happy', viseme: 'A', visemeAmount: 1 }));
    expect(count(d1, 'mouth')).toBe(1);
    expect(count(d2, 'mouth')).toBe(1);
    expect(d2.querySelector('[data-part="mouth"]')!.getAttribute('data-shape')).toBe('A');
  });
});

describe('olhos', () => {
  const eyes = (d: Document) => [...d.querySelectorAll('[data-part="eye"]')];
  const dim = (e: Element) => ({ rx: Number(e.getAttribute('data-rx')), ry: Number(e.getAttribute('data-ry')) });

  it('de frente, os dois olhos têm a mesma dimensão-base', () => {
    for (const c of BUILTIN_CHARACTERS) {
      const list = eyes(render(c.builtinId!, pose('front')));
      expect(list).toHaveLength(2);
      expect(dim(list[0]!)).toEqual(dim(list[1]!));
    }
  });

  it('em 3/4, o olho distante é menor de forma consistente, nunca maior', () => {
    for (const view of ['front-left', 'front-right'] as ViewId[]) {
      const list = eyes(render('nina', pose(view)));
      const near = dim(list.find((e) => e.getAttribute('data-eye') === 'near')!);
      const far = dim(list.find((e) => e.getAttribute('data-eye') === 'far')!);
      expect(far.rx).toBeLessThan(near.rx);
      expect(far.rx / near.rx).toBeCloseTo(FAR_EYE_SCALE, 1);
    }
  });

  it('a órbita não muda de tamanho quando a pupila se move', () => {
    const ref = eyes(render('nina', pose('front')))[0]!;
    for (const g of [[-1, -1], [1, 1], [1, -1], [0, 1]] as const) {
      const e = eyes(render('nina', pose('front', { gazeX: g[0], gazeY: g[1] })))[0]!;
      expect(dim(e)).toEqual(dim(ref));
    }
  });

  it('a pupila fica confinada dentro da órbita, em qualquer olhar e expressão', () => {
    for (const c of BUILTIN_CHARACTERS) {
      for (const view of ['front', 'front-right', 'left'] as ViewId[]) {
        for (const expression of ['neutral', 'surprised', 'scared', 'angry']) {
          for (const g of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) {
            for (const e of eyes(render(c.builtinId!, pose(view, { gazeX: g[0], gazeY: g[1], expression })))) {
              const { rx, ry } = dim(e);
              const px = Math.abs(Number(e.getAttribute('data-pupil-x')));
              const py = Math.abs(Number(e.getAttribute('data-pupil-y')));
              const r = Number(e.getAttribute('data-pupil-r'));
              expect(px + r).toBeLessThanOrEqual(rx + 1.1 + r * 0.1);
              expect(py + r).toBeLessThanOrEqual(ry + 1.1 + r * 0.1);
            }
          }
        }
      }
    }
  }, 30000);

  it('piscar transforma os olhos sem duplicá-los', () => {
    const list = eyes(render('nina', pose('front', { blink: 1 })));
    expect(list).toHaveLength(2);
    expect(list.every((e) => e.getAttribute('data-closed') === '1')).toBe(true);
    expect(list[0]!.querySelector('[data-pupil]')).toBeNull();
  });
});

describe('nariz', () => {
  const tip = (d: Document) => {
    const n = d.querySelector('[data-part="nose"]')!;
    return { tip: Number(n.getAttribute('data-tip-x')), base: Number(n.getAttribute('data-base-x')), facing: Number(n.getAttribute('data-facing')) };
  };
  it('aponta para o lado da vista, em todo o elenco', () => {
    for (const c of BUILTIN_CHARACTERS) {
      for (const v of ['front-right', 'right'] as ViewId[]) {
        const t = tip(render(c.builtinId!, pose(v)));
        expect(t.facing).toBe(1);
        expect(t.tip).toBeGreaterThan(t.base);
        expect(t.tip).toBeGreaterThan(0);
      }
      for (const v of ['front-left', 'left'] as ViewId[]) {
        const t = tip(render(c.builtinId!, pose(v)));
        expect(t.facing).toBe(-1);
        expect(t.tip).toBeLessThan(t.base);
        expect(t.tip).toBeLessThan(0);
      }
      expect(tip(render(c.builtinId!, pose('front'))).tip).toBe(0);
    }
  });
});

describe('olhar', () => {
  const base = { headX: 0, headY: 0, headView: 'auto' as const, bodyView: 'auto' as const };
  const gaze = GazeSchema.parse({ mode: 'point', followHead: true, headStrength: 0.5 });
  it('alvo à direita: pupilas à direita e cabeça 3/4 direita', () => {
    const r = resolveGaze({ ...base, gaze, target: { x: 500, y: 0 } });
    expect(r.gazeX).toBeGreaterThan(0);
    expect(r.headView).toBe('front-right');
  });
  it('alvo à esquerda', () => {
    const r = resolveGaze({ ...base, gaze, target: { x: -500, y: 0 } });
    expect(r.gazeX).toBeLessThan(0);
    expect(r.headView).toBe('front-left');
  });
  it('alvo acima e abaixo move a pupila na vertical', () => {
    expect(resolveGaze({ ...base, gaze, target: { x: 0, y: -400 } }).gazeY).toBeLessThan(0);
    expect(resolveGaze({ ...base, gaze, target: { x: 0, y: 400 } }).gazeY).toBeGreaterThan(0);
  });
  it('alvo muito próximo não satura a pupila e não vira a cabeça à toa', () => {
    const r = resolveGaze({ ...base, gaze, target: { x: 0.4, y: 0 } });
    expect(Math.abs(r.gazeX)).toBeLessThan(0.1);
    expect(r.headView).toBe('front');
  });
  it('alvo ausente: olhar neutro para a câmera, sem erro', () => {
    const r = resolveGaze({ ...base, gaze: { ...gaze, mode: 'node', targetId: 'sumiu' }, target: null });
    expect(r.gazeX).toBe(0);
    expect(r.hasTarget).toBe(false);
    expect(r.headView).toBe('front');
  });
  it('força de cabeça 1 vira perfil; 0 não vira', () => {
    expect(headViewToward(100, 1)).toBe('right');
    expect(headViewToward(-100, 1)).toBe('left');
    expect(headViewToward(100, 0)).toBe('front');
  });
  it('orientação manual tem prioridade sobre o automático', () => {
    const r = resolveGaze({ ...base, gaze, target: { x: 500, y: 0 }, headView: 'left' });
    expect(r.headView).toBe('left');
    expect(r.gazeX).toBeGreaterThan(0);
  });

  it('REGRESSÃO "Você sabe dançar?": Nina olha e aponta o nariz para Zeca, e vice-versa', () => {
    const p = createDemoProject();
    const scene = sceneOf(p, p.sceneOrder[0]!);
    const nodes = Object.values(scene.nodes).filter((n) => n.kind === 'character');
    const nina = nodes.find((n) => n.name === 'Nina')!;
    const zeca = nodes.find((n) => n.name === 'Zeca')!;
    expect(nina.transform.x).toBeLessThan(zeca.transform.x);
    const r = evaluateScene(p, scene, 500);
    const rn = r.characters[nina.id]!;
    const rz = r.characters[zeca.id]!;
    expect(rn.pose.face.gazeX).toBeGreaterThan(0);
    expect(rz.pose.face.gazeX).toBeLessThan(0);
    expect(viewInfo(rn.pose.headView).facing).toBe(1);
    expect(viewInfo(rz.pose.headView).facing).toBe(-1);
    const nDoc = parse(renderCharacter(rn.def, rn.pose, 'n').svg);
    const zDoc = parse(renderCharacter(rz.def, rz.pose, 'z').svg);
    expect(Number(nDoc.querySelector('[data-part="nose"]')!.getAttribute('data-tip-x'))).toBeGreaterThan(0);
    expect(Number(zDoc.querySelector('[data-part="nose"]')!.getAttribute('data-tip-x'))).toBeLessThan(0);
  });

  it('se Nina atravessa a cena, o olhar de Zeca acompanha', () => {
    const p = createDemoProject();
    const scene = sceneOf(p, p.sceneOrder[0]!);
    const nina = Object.values(scene.nodes).find((n) => n.name === 'Nina')!;
    const zeca = Object.values(scene.nodes).find((n) => n.name === 'Zeca')!;
    nina.transform.x = zeca.transform.x + 500;
    const r = evaluateScene(p, scene, 0);
    expect(r.characters[zeca.id]!.pose.face.gazeX).toBeGreaterThan(0);
    expect(viewInfo(r.characters[zeca.id]!.pose.headView).facing).toBe(1);
  });

  it('excluir o alvo não quebra o olhar', () => {
    const p = createDemoProject();
    const scene = sceneOf(p, p.sceneOrder[0]!);
    const nina = Object.values(scene.nodes).find((n) => n.name === 'Nina')!;
    const zeca = Object.values(scene.nodes).find((n) => n.name === 'Zeca')!;
    deleteNode(scene, zeca.id);
    const n = scene.nodes[nina.id]!;
    expect(n.kind === 'character' && n.gaze.targetId).toBeNull();
    // Sem alvo: só os olhares rápidos sutis do movimento secundário (1.1).
    expect(Math.abs(evaluateScene(p, scene, 0).characters[nina.id]!.pose.face.gazeX)).toBeLessThan(0.2);
  });
});
