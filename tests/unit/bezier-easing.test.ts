/** Etapa 1, entrega 1: easings novos, cubic-bezier real e compatibilidade dos keyframes. */
import { describe, expect, it } from 'vitest';
import { BEZIER_PRESETS, EASING_AS_HANDLES, cubicBezierEase, sanitizeHandles } from '@/engine/animation/bezier';
import { EASINGS, evaluateKeys, segmentEase } from '@/engine/animation/interp';
import { EasingSchema, KeyframeSchema, ProjectSchema, type Keyframe } from '@/engine/model/schema';
import { createKeyframe } from '@/engine/model/factory';
import { createDemoProject } from '@/features/templates/projects';
import { ensurePropertyTrack, sceneOf, setKeyframe } from '@/engine/model/ops';
import { planFrame, planToSvgString } from '@/engine/render/plan';

const key = (timeMs: number, value: number, o: Partial<Keyframe> = {}): Keyframe => createKeyframe(timeMs, value, o);

describe('easings: presets antigos continuam idênticos', () => {
  it('fórmulas originais, ponto a ponto', () => {
    const t = 0.37;
    expect(EASINGS.linear(t)).toBe(t);
    expect(EASINGS.easeIn(t)).toBe(t * t);
    expect(EASINGS.easeOut(t)).toBe(1 - (1 - t) * (1 - t));
    expect(EASINGS.easeInOut(0.25)).toBeCloseTo(0.125, 12);
    expect(EASINGS.easeInOut(0.75)).toBeCloseTo(0.875, 12);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    expect(EASINGS.backOut(0.5)).toBeCloseTo(1 + c3 * Math.pow(-0.5, 3) + c1 * 0.25, 12);
    expect(EASINGS.bounceOut(0.5)).toBeCloseTo(7.5625 * (0.5 - 1.5 / 2.75) ** 2 + 0.75, 12);
  });
  it('o enum aceita os ids antigos e os novos', () => {
    for (const id of ['linear', 'easeIn', 'easeOut', 'easeInOut', 'backOut', 'bounceOut', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'backIn', 'backInOut']) {
      expect(EasingSchema.parse(id)).toBe(id);
    }
    expect(() => EasingSchema.parse('elastic')).toThrow();
  });
});

describe('easings novos', () => {
  it('pontas exatas em todos os easings', () => {
    for (const [name, fn] of Object.entries(EASINGS)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 12);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 12);
    }
  });
  it('cúbicas: valores intermediários conhecidos', () => {
    expect(EASINGS.easeInCubic(0.5)).toBeCloseTo(0.125, 12);
    expect(EASINGS.easeOutCubic(0.5)).toBeCloseTo(0.875, 12);
    expect(EASINGS.easeInOutCubic(0.25)).toBeCloseTo(0.0625, 12);
    expect(EASINGS.easeInOutCubic(0.5)).toBeCloseTo(0.5, 12);
    expect(EASINGS.easeInOutCubic(0.75)).toBeCloseTo(0.9375, 12);
  });
  it('back: recua antes (valor negativo) e simétrico no in-out', () => {
    expect(EASINGS.backIn(0.2)).toBeLessThan(0);
    expect(EASINGS.backInOut(0.5)).toBeCloseTo(0.5, 12);
    expect(EASINGS.backInOut(0.15)).toBeLessThan(0);
    expect(EASINGS.backInOut(0.85)).toBeGreaterThan(1);
  });
  it('são usados pela interpolação de keyframes', () => {
    const keys = [key(0, 0, { interpolation: 'bezier', easing: 'easeInCubic' }), key(1000, 100)];
    expect(evaluateKeys(keys, 500)).toBeCloseTo(12.5, 9);
  });
});

describe('cubic-bezier real', () => {
  it('extremos exatos e entradas fora de faixa seguras', () => {
    const h = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };
    expect(cubicBezierEase(0, h)).toBe(0);
    expect(cubicBezierEase(1, h)).toBe(1);
    expect(cubicBezierEase(-3, h)).toBe(0);
    expect(cubicBezierEase(7, h)).toBe(1);
    expect(cubicBezierEase(Number.NaN, h)).toBe(0);
    expect(cubicBezierEase(Number.POSITIVE_INFINITY, h)).toBe(1);
    expect(cubicBezierEase(Number.NEGATIVE_INFINITY, h)).toBe(0);
  });
  it('diagonal é linear', () => {
    for (const t of [0.1, 0.33, 0.5, 0.9]) expect(cubicBezierEase(t, { x1: 0, y1: 0, x2: 1, y2: 1 })).toBeCloseTo(t, 12);
    for (const t of [0.1, 0.5, 0.9]) expect(cubicBezierEase(t, { x1: 0.3, y1: 0.3, x2: 0.7, y2: 0.7 })).toBeCloseTo(t, 12);
  });
  it('resolve x(t) de verdade: confere com força bruta e difere de usar o progresso como parâmetro', () => {
    const h = { x1: 0.9, y1: 0, x2: 0.1, y2: 1 };
    const bx = (s: number) => 3 * (1 - s) * (1 - s) * s * h.x1 + 3 * (1 - s) * s * s * h.x2 + s * s * s;
    const by = (s: number) => 3 * (1 - s) * (1 - s) * s * h.y1 + 3 * (1 - s) * s * s * h.y2 + s * s * s;
    for (const t of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
      let best = 0;
      let err = Infinity;
      for (let i = 0; i <= 200000; i++) {
        const s = i / 200000;
        const e = Math.abs(bx(s) - t);
        if (e < err) { err = e; best = s; }
      }
      expect(cubicBezierEase(t, h)).toBeCloseTo(by(best), 4);
    }
    // A abordagem ingênua (t como parâmetro) daria outro valor: prova de que x(t) é resolvido.
    expect(Math.abs(cubicBezierEase(0.2, h) - by(0.2))).toBeGreaterThan(0.05);
  });
  it('valor conhecido do CSS "ease" (0.25, 0.1, 0.25, 1) em 50% ≈ 0.8024', () => {
    expect(cubicBezierEase(0.5, { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 })).toBeCloseTo(0.8024, 3);
  });
  it('é monótono no tempo quando y está em [0,1] e finito sempre', () => {
    for (const p of BEZIER_PRESETS.filter((x) => [x.handles.y1, x.handles.y2].every((y) => y >= 0 && y <= 1))) {
      let prev = -1;
      for (let i = 0; i <= 500; i++) {
        const v = cubicBezierEase(i / 500, p.handles);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });
  it('overshoot controlado: passa de 1 mas fica dentro do limite do modelo e termina em 1', () => {
    const h = { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 };
    let max = 0;
    for (let i = 0; i <= 1000; i++) max = Math.max(max, cubicBezierEase(i / 1000, h));
    expect(max).toBeGreaterThan(1.05);
    expect(max).toBeLessThan(2);
    expect(cubicBezierEase(1, h)).toBe(1);
    // y no limite máximo continua finito e limitado
    const extreme = { x1: 0.5, y1: 99, x2: 0.5, y2: 99 };
    for (let i = 0; i <= 100; i++) {
      const v = cubicBezierEase(i / 100, extreme);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThan(2.1);
    }
  });
  it('sanitiza: x limitado a [0,1], y a [-1,2], lixo vira padrão', () => {
    expect(sanitizeHandles({ x1: -4, y1: 9, x2: 8, y2: -9 })).toEqual({ x1: 0, y1: 2, x2: 1, y2: -1 });
    const bad = sanitizeHandles({ x1: Number.NaN, y1: Number.POSITIVE_INFINITY, x2: 'a', y2: undefined });
    for (const v of Object.values(bad)) expect(Number.isFinite(v)).toBe(true);
    expect(sanitizeHandles(undefined)).toEqual({ x1: 0.42, y1: 0, x2: 0.58, y2: 1 });
  });
  it('as aproximações dos easings nomeados ficam perto do easing original', () => {
    for (const id of ['easeIn', 'easeOut', 'easeInOut', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'backIn', 'backOut', 'backInOut']) {
      const h = EASING_AS_HANDLES[id]!;
      for (const t of [0.25, 0.5, 0.75]) expect(Math.abs(cubicBezierEase(t, h) - EASINGS[id as keyof typeof EASINGS](t)), `${id}@${t}`).toBeLessThan(0.1);
    }
  });
});

describe('keyframes com curva livre', () => {
  const handles = { x1: 0.9, y1: 0, x2: 0.1, y2: 1 };
  it('só vale com interpolação "bezier"; linear e hold ignoram os pontos', () => {
    const mk = (interpolation: Keyframe['interpolation']) => [key(0, 0, { interpolation, easing: 'easeIn', bezierHandles: handles }), key(1000, 100)];
    expect(evaluateKeys(mk('bezier'), 500)).toBeCloseTo(cubicBezierEase(0.5, handles) * 100, 9);
    expect(evaluateKeys(mk('linear'), 250)).toBeCloseTo(25, 9);
    expect(evaluateKeys(mk('hold'), 999)).toBe(0);
  });
  it('sem pontos, "bezier" usa o easing legado como antes', () => {
    const keys = [key(0, 0, { interpolation: 'bezier', easing: 'easeIn' }), key(1000, 100)];
    expect(evaluateKeys(keys, 500)).toBeCloseTo(25, 9);
  });
  it('pontas exatas e acesso fora de ordem dá sempre o mesmo valor', () => {
    const keys = [key(0, 10, { interpolation: 'bezier', bezierHandles: handles }), key(2000, 50, { interpolation: 'bezier', bezierHandles: { x1: 0.3, y1: 1.4, x2: 0.7, y2: 1 } }), key(3000, -20)];
    const order = [2500, 0, 1999, 2000, 3000, 500, 4000, 0, 1234, 2500];
    const first = new Map<number, unknown>();
    for (const t of order) {
      const v = evaluateKeys(keys, t);
      if (first.has(t)) expect(v).toBe(first.get(t));
      else first.set(t, v);
    }
    expect(evaluateKeys(keys, 0)).toBe(10);
    expect(evaluateKeys(keys, 2000)).toBe(50);
    expect(evaluateKeys(keys, 3000)).toBe(-20);
    expect(evaluateKeys(keys, -500)).toBe(10);
    expect(evaluateKeys(keys, 99999)).toBe(-20);
  });
  it('overshoot passa do valor final e volta', () => {
    const keys = [key(0, 0, { interpolation: 'bezier', bezierHandles: { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } }), key(1000, 100)];
    const vals = Array.from({ length: 101 }, (_, i) => evaluateKeys(keys, i * 10) as number);
    expect(Math.max(...vals)).toBeGreaterThan(105);
    expect(vals[100]).toBe(100);
  });
  it('dados corrompidos passados direto ao avaliador nunca geram NaN/Infinity', () => {
    const bad = { x1: Number.NaN, y1: Number.POSITIVE_INFINITY, x2: -50, y2: 1e9 } as unknown as Keyframe['bezierHandles'];
    const keys = [key(0, 0, { interpolation: 'bezier' }), key(1000, 100)];
    keys[0]!.bezierHandles = bad;
    for (let t = -100; t <= 1200; t += 37) expect(Number.isFinite(evaluateKeys(keys, t) as number)).toBe(true);
    expect(segmentEase({ interpolation: 'bezier', easing: 'easeIn', bezierHandles: bad }, 0.5)).toSatisfy(Number.isFinite);
  });
  it('segmento de um único intervalo curto (1 ms) não quebra', () => {
    const keys = [key(0, 0, { interpolation: 'bezier', bezierHandles: handles }), key(1, 10)];
    expect(evaluateKeys(keys, 0)).toBe(0);
    expect(evaluateKeys(keys, 1)).toBe(10);
  });
});

describe('schema e persistência', () => {
  it('keyframe antigo (sem pontos) lê igual e não ganha campo novo ao ser salvo', () => {
    const old = { id: 'k', timeMs: 100, value: 3, interpolation: 'bezier', easing: 'backOut' };
    const parsed = KeyframeSchema.parse(old);
    expect(parsed.bezierHandles).toBeUndefined();
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(old);
  });
  it('pontos válidos são mantidos; fora da faixa são limitados; malformados descartados', () => {
    const base = { id: 'k', timeMs: 0, value: 1, interpolation: 'bezier', easing: 'easeInOut' };
    expect(KeyframeSchema.parse({ ...base, bezierHandles: { x1: 0.1, y1: 1.2, x2: 0.9, y2: 0 } }).bezierHandles).toEqual({ x1: 0.1, y1: 1.2, x2: 0.9, y2: 0 });
    expect(KeyframeSchema.parse({ ...base, bezierHandles: { x1: -1, y1: 99, x2: 5, y2: -99 } }).bezierHandles).toEqual({ x1: 0, y1: 2, x2: 1, y2: -1 });
    expect(KeyframeSchema.parse({ ...base, bezierHandles: { x1: 'a' } }).bezierHandles).toBeUndefined();
    expect(KeyframeSchema.parse({ ...base, bezierHandles: 5 }).bezierHandles).toBeUndefined();
  });
  it('setKeyframe grava e troca os pontos; JSON do projeto faz ida e volta', () => {
    const p = createDemoProject();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const id = Object.keys(s.nodes)[0]!;
    const tr = ensurePropertyTrack(s, id, 'transform.x');
    const k = setKeyframe(tr, 0, 0, { interpolation: 'bezier', bezierHandles: { x1: 0.2, y1: 1.4, x2: 0.6, y2: 1 } });
    setKeyframe(tr, 2000, 300);
    expect(k.bezierHandles).toEqual({ x1: 0.2, y1: 1.4, x2: 0.6, y2: 1 });
    const again = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    const tr2 = sceneOf(again, s.id).tracks.find((t) => t.id === tr.id)!;
    if (tr2.type !== 'property') throw new Error();
    expect(tr2.keyframes[0]!.bezierHandles).toEqual({ x1: 0.2, y1: 1.4, x2: 0.6, y2: 1 });
    expect(tr2.keyframes[1]!.bezierHandles).toBeUndefined();
  });
  it('quadro com curvas extremas sai sem NaN/Infinity no SVG', () => {
    const p = createDemoProject();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const id = Object.values(s.nodes).find((n) => n.kind === 'character')!.id;
    for (const path of ['transform.x', 'transform.y', 'transform.scaleX', 'transform.rotation', 'rig.armLUpper']) {
      const tr = ensurePropertyTrack(s, id, path);
      setKeyframe(tr, 0, 0, { interpolation: 'bezier' });
      setKeyframe(tr, 1000, 100);
      tr.keyframes[0]!.bezierHandles = { x1: Number.NaN, y1: 1e12, x2: -9, y2: Number.POSITIVE_INFINITY } as never;
    }
    for (const t of [0, 1, 250, 500, 999, 1000, 3000]) {
      const svg = planToSvgString(planFrame(p, s, t, () => undefined), 160, 90);
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
});
