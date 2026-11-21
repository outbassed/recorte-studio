/** Etapa 1, entrega 4: entrada e saída animadas dos balões de diálogo. */
import { describe, expect, it } from 'vitest';
import { BUBBLE_STYLES, bubbleAnchor, bubbleAnimation, bubbleLayout, renderBubble } from '@/engine/render/bubbles';
import { evaluateScene } from '@/engine/animation/evaluate';
import { DialogueClipSchema, ProjectSchema, type DialogueClip } from '@/engine/model/schema';
import { addDialogue, applySequence, extractSequence, sceneOf } from '@/engine/model/ops';
import { createDemoProject } from '@/features/templates/projects';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { scopeRange } from '@/features/export/pipeline';

type Anim = Pick<DialogueClip, 'bubbleIn' | 'bubbleOut' | 'bubbleInMs' | 'bubbleOutMs'>;
const anim = (o: Anim, local: number, dur = 2000) => bubbleAnimation(o, local, dur - local);
const layout = (style = 'speech') => bubbleLayout({ text: 'Você sabe dançar? Eu sei!', style, scale: 1, offsetX: 0, offsetY: 0, frameW: 1920, frameH: 1080, headX: -200, headY: -180, headR: 120 });

describe('bubbleAnimation', () => {
  it('sem campos (clips antigos) é estático em qualquer instante', () => {
    for (const local of [0, 1, 50, 1000, 1999]) expect(anim({}, local)).toEqual({ scale: 1, opacity: 1 });
    expect(anim({ bubbleIn: 'none', bubbleOut: 'none' }, 5)).toEqual({ scale: 1, opacity: 1 });
  });
  it('pop de entrada: começa pequeno, passa de 1 (overshoot leve) e termina em 1 exato', () => {
    const o: Anim = { bubbleIn: 'pop', bubbleInMs: 300 };
    expect(anim(o, 0).scale).toBeCloseTo(0.6, 9);
    expect(anim(o, 0).opacity).toBe(0);
    let max = 0;
    for (let t = 0; t < 300; t += 5) max = Math.max(max, anim(o, t).scale);
    expect(max).toBeGreaterThan(1.01);
    expect(max).toBeLessThan(1.08); // sutil
    expect(anim(o, 300)).toEqual({ scale: 1, opacity: 1 });
    expect(anim(o, 1000)).toEqual({ scale: 1, opacity: 1 });
  });
  it('fade de entrada não muda a escala e é monótono de 0 a 1', () => {
    const o: Anim = { bubbleIn: 'fade', bubbleInMs: 400 };
    let prev = -1;
    for (let t = 0; t <= 400; t += 10) {
      const a = anim(o, t);
      expect(a.scale).toBe(1);
      expect(a.opacity).toBeGreaterThanOrEqual(prev);
      prev = a.opacity;
    }
    expect(anim(o, 0).opacity).toBe(0);
    expect(anim(o, 400).opacity).toBe(1);
  });
  it('pop + fade combina as duas coisas', () => {
    const a = anim({ bubbleIn: 'popFade', bubbleInMs: 300 }, 100);
    expect(a.scale).not.toBe(1);
    expect(a.opacity).toBeGreaterThan(0);
    expect(a.opacity).toBeLessThan(1);
  });
  it('saída: some até o fim do clip (fade) ou encolhe (pop), sem tocar no meio do clip', () => {
    const fade: Anim = { bubbleOut: 'fade', bubbleOutMs: 300 };
    expect(anim(fade, 1000)).toEqual({ scale: 1, opacity: 1 });
    expect(anim(fade, 1700)).toEqual({ scale: 1, opacity: 1 });
    expect(anim(fade, 1999).opacity).toBeLessThan(0.01);
    let prev = 2;
    for (let t = 1700; t < 2000; t += 10) {
      const o = anim(fade, t).opacity;
      expect(o).toBeLessThanOrEqual(prev);
      prev = o;
    }
    const pop: Anim = { bubbleOut: 'pop', bubbleOutMs: 300 };
    expect(anim(pop, 1999).scale).toBeLessThan(0.85);
    expect(anim(pop, 1999).opacity).toBeLessThan(0.05);
    const both = anim({ bubbleOut: 'popFade', bubbleOutMs: 300 }, 1850);
    expect(both.scale).toBeLessThan(1);
    expect(both.opacity).toBeLessThan(1);
  });
  it('clip curto: entrada e saída que não cabem encolhem juntas e nunca passam dos limites', () => {
    const o: Anim = { bubbleIn: 'popFade', bubbleOut: 'popFade', bubbleInMs: 240, bubbleOutMs: 200 };
    for (const dur of [1, 10, 60, 120, 440, 5000]) {
      for (let t = 0; t < dur; t += Math.max(1, dur / 40)) {
        const a = bubbleAnimation(o, t, dur - t);
        expect(Number.isFinite(a.scale) && Number.isFinite(a.opacity)).toBe(true);
        expect(a.opacity).toBeGreaterThanOrEqual(0);
        expect(a.opacity).toBeLessThanOrEqual(1);
        expect(a.scale).toBeGreaterThanOrEqual(0);
        expect(a.scale).toBeLessThanOrEqual(1.2);
      }
    }
    // clip de 200 ms (menor que 240+200): o meio já está inteiro? não, mas começa invisível e termina invisível
    expect(bubbleAnimation(o, 0, 200).opacity).toBe(0);
    expect(bubbleAnimation(o, 199, 1).opacity).toBeLessThan(0.05);
  });
  it('entradas ruins (NaN, negativos) não geram NaN', () => {
    const o: Anim = { bubbleIn: 'popFade', bubbleOut: 'popFade', bubbleInMs: Number.NaN, bubbleOutMs: -5 };
    for (const [l, r] of [[Number.NaN, 10], [-50, 100], [10, Number.NaN], [0, 0]]) {
      const a = bubbleAnimation(o, l!, r!);
      expect(Number.isFinite(a.scale) && Number.isFinite(a.opacity)).toBe(true);
    }
  });
  it('é função pura: acessar fora de ordem dá o mesmo estado', () => {
    const o: Anim = { bubbleIn: 'pop', bubbleOut: 'fade' };
    const ts = [1900, 50, 1000, 120, 1900, 50];
    const seen = new Map<number, string>();
    for (const t of ts) {
      const v = JSON.stringify(anim(o, t));
      if (seen.has(t)) expect(v).toBe(seen.get(t));
      else seen.set(t, v);
    }
  });
});

describe('renderBubble', () => {
  it('sem animação ou com estado estático o SVG é idêntico ao de antes', () => {
    for (const st of BUBBLE_STYLES) {
      const l = layout(st.id);
      expect(renderBubble(l, { scale: 1, opacity: 1 })).toBe(renderBubble(l));
      expect(renderBubble(l)).not.toContain('bubble-anim');
    }
  });
  it('mantém a âncora da cauda no lugar durante o pop (todos os estilos)', () => {
    for (const st of BUBBLE_STYLES) {
      const l = layout(st.id);
      const svg = renderBubble(l, { scale: 0.7, opacity: 0.5 });
      const m = /transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)"/.exec(svg)!;
      const [ax, ay, s, bx, by] = m.slice(1).map(Number) as [number, number, number, number, number];
      const a = bubbleAnchor(l);
      // ponto da âncora depois da transformação: ax + s*(a.x - ax') == a.x
      expect(ax + s * (a.x + bx)).toBeCloseTo(a.x, 1);
      expect(ay + s * (a.y + by)).toBeCloseTo(a.y, 1);
      expect(svg).toContain('opacity="0.500"');
      expect(svg).not.toMatch(/NaN|Infinity/);
    }
  });
  it('o texto continua inteiro, escapado e na mesma ordem', () => {
    const l = bubbleLayout({ text: '<b>oi</b> & "tchau"\nlinha dois', style: 'shout', scale: 1, offsetX: 0, offsetY: 0, frameW: 1920, frameH: 1080, headX: 0, headY: 0, headR: 100 });
    const svg = renderBubble(l, { scale: 1.04, opacity: 1 });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;oi&lt;/b&gt;');
    expect(svg).toContain('linha dois');
  });
});

describe('na cena (preview = exportação)', () => {
  const setup = (extra: Partial<DialogueClip> = {}) => {
    const p = createDemoProject();
    const s = sceneOf(p, p.sceneOrder[0]!);
    s.tracks = s.tracks.filter((t) => t.type !== 'dialogue');
    const nina = Object.values(s.nodes).find((n) => n.kind === 'character' && n.name === 'Nina')!;
    addDialogue(s, nina.id, 'Olá, tudo bem?', 1000, 2000, extra);
    return { p, s, id: nina.id };
  };
  const frame = (p: ReturnType<typeof setup>['p'], s: ReturnType<typeof setup>['s'], t: number) => planToSvgString(planFrame(p, s, t, () => undefined), 320, 180);

  it('o avaliador expõe tempo local e restante do clip', () => {
    const { p, s } = setup();
    const b = evaluateScene(p, s, 1500).bubbles[0]!;
    expect(b.localMs).toBe(500);
    expect(b.remainingMs).toBe(1500);
    expect(b.progress).toBeCloseTo(0.25, 9);
    expect(evaluateScene(p, s, 999).bubbles.length).toBe(0);
    expect(evaluateScene(p, s, 3000).bubbles.length).toBe(0);
  });
  it('clip antigo: balão estático, quadro igual antes e depois de salvar e reabrir', () => {
    const { p, s } = setup();
    expect(frame(p, s, 1010)).not.toContain('bubble-anim');
    const again = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    for (const t of [1000, 1010, 1500, 2990]) expect(frame(again, sceneOf(again, s.id), t)).toBe(frame(p, s, t));
  });
  it('entrada e saída aparecem só nas janelas certas e o meio é igual ao balão estático', () => {
    const { p, s } = setup();
    const clip = s.tracks.flatMap((t) => (t.type === 'dialogue' ? t.clips : []))[0]!;
    const times = [1000, 1050, 1299, 1300, 1800, 2700, 2900];
    const legacy = new Map(times.map((t) => [t, frame(p, s, t)]));
    Object.assign(clip, { bubbleIn: 'popFade', bubbleInMs: 300, bubbleOut: 'fade', bubbleOutMs: 300 });
    expect(frame(p, s, 1050)).toContain('bubble-anim');
    expect(frame(p, s, 2900)).toContain('bubble-anim');
    // fora das janelas, exatamente o mesmo quadro que sem animação
    for (const t of [1300, 1800, 2700]) expect(frame(p, s, t)).toBe(legacy.get(t));
    for (const t of [1000, 1050, 1299, 2900]) expect(frame(p, s, t)).not.toBe(legacy.get(t));
    // seek fora de ordem
    const x = frame(p, s, 1100);
    frame(p, s, 2950);
    frame(p, s, 0);
    expect(frame(p, s, 1100)).toBe(x);
    for (const t of [1000, 1001, 1100, 1299, 2701, 2999]) expect(frame(p, s, t)).not.toMatch(/NaN|Infinity/);
  });
  it('o quadro exportado da cena (PNG/vídeo) é idêntico ao da prévia durante a entrada e a saída', () => {
    const { p, s } = setup({ bubbleIn: 'popFade', bubbleInMs: 400, bubbleOut: 'popFade', bubbleOutMs: 400 });
    const exp = scopeRange(p, { kind: 'current', sceneId: s.id });
    for (const t of [1000, 1100, 1399, 1800, 2700, 2950]) {
      expect(exp.frameAt(t, () => undefined, false)).toBe(planToSvgString(planFrame(p, s, t, () => undefined), p.settings.width, p.settings.height));
    }
    expect(exp.frameAt(1100, () => undefined, false)).toContain('bubble-anim');
  });
  it('clip de 120 ms com entrada e saída longas funciona', () => {
    const { p, s, id } = setup();
    s.tracks = s.tracks.filter((t) => t.type !== 'dialogue');
    addDialogue(s, id, 'Oi', 500, 120, { bubbleIn: 'popFade', bubbleOut: 'popFade' });
    for (let t = 500; t < 620; t += 10) expect(frame(p, s, t)).not.toMatch(/NaN|Infinity/);
  });
});

describe('schema, persistência e sequências', () => {
  const base = { id: 'd', kind: 'dialogue', startMs: 0, durationMs: 1000, text: 'oi' };
  it('clip antigo não ganha campos ao ser lido e salvo; inválidos são descartados', () => {
    const parsed = DialogueClipSchema.parse(base);
    expect(parsed.bubbleIn).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toMatch(/bubbleIn|bubbleOut/);
    const bad = DialogueClipSchema.parse({ ...base, bubbleIn: 'explodir', bubbleOut: 3, bubbleInMs: -1, bubbleOutMs: 'x' });
    expect([bad.bubbleIn, bad.bubbleOut, bad.bubbleInMs, bad.bubbleOutMs]).toEqual([undefined, undefined, undefined, undefined]);
    const ok = DialogueClipSchema.parse({ ...base, bubbleIn: 'pop', bubbleOut: 'popFade', bubbleInMs: 200, bubbleOutMs: 150 });
    expect([ok.bubbleIn, ok.bubbleOut, ok.bubbleInMs, ok.bubbleOutMs]).toEqual(['pop', 'popFade', 200, 150]);
  });
  it('as animações fazem ida e volta pelo JSON do projeto e acompanham as sequências', () => {
    const p = createDemoProject();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const [nina, zeca] = Object.values(s.nodes).filter((n) => n.kind === 'character');
    addDialogue(s, nina!.id, 'Teste de sequência', 200, 1500, { bubbleIn: 'pop', bubbleOut: 'fade', bubbleInMs: 180, bubbleOutMs: 260 });
    const again = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    const clips = sceneOf(again, s.id).tracks.flatMap((t) => (t.type === 'dialogue' ? t.clips : []));
    expect(clips.find((c) => c.text === 'Teste de sequência')).toMatchObject({ bubbleIn: 'pop', bubbleOut: 'fade', bubbleInMs: 180, bubbleOutMs: 260 });
    const seq = extractSequence(s, nina!.id)!;
    applySequence(s, zeca!.id, seq, 5000);
    const copy = s.tracks.flatMap((t) => (t.type === 'dialogue' && t.targetNodeId === zeca!.id ? t.clips : [])).find((c) => c.text === 'Teste de sequência')!;
    expect(copy).toMatchObject({ bubbleIn: 'pop', bubbleOut: 'fade', bubbleInMs: 180, bubbleOutMs: 260 });
  });
});
