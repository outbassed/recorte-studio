/** Etapa 1, entrega 2: suavização das transições de cena (montagem = prévia = exportação). */
import { describe, expect, it } from 'vitest';
import { createProject, createScene } from '@/engine/model/factory';
import { ProjectSchema, TransitionSchema, type Project, type Transition } from '@/engine/model/schema';
import { buildMontage, planMontageFrame, transitionProgress } from '@/engine/render/montage';
import { planToSvgString } from '@/engine/render/plan';
import { EASINGS } from '@/engine/animation/interp';
import { scopeRange } from '@/features/export/pipeline';

const twoScenes = (inTr: Partial<Transition>, outTr: Partial<Transition> = {}, dur = 4000): Project => {
  const p = createProject('t');
  const a = p.scenes[p.sceneOrder[0]!]!;
  a.durationMs = dur;
  const b = createScene('B', dur, 'sala');
  b.transitionIn = TransitionSchema.parse(inTr);
  a.transitionOut = TransitionSchema.parse(outTr);
  p.scenes[b.id] = b;
  p.sceneOrder.push(b.id);
  return p;
};
const frame = (p: Project, t: number) => {
  const { segments } = buildMontage(p);
  return planMontageFrame(p, segments, t, () => undefined);
};
const blackOpacities = (screen: string) => [...screen.matchAll(/fill="#000" opacity="([\d.]+)"/g)].map((m) => Number(m[1]));

describe('transitionProgress', () => {
  it('sem easing = linear, exatamente como antes', () => {
    for (const x of [0, 0.1, 0.5, 0.77, 1]) expect(transitionProgress({}, x)).toBe(x);
    expect(transitionProgress({ easing: 'linear' }, 0.3)).toBe(0.3);
  });
  it('suave usa easeInOutCubic; pontas exatas; entradas ruins são limitadas', () => {
    expect(transitionProgress({ easing: 'easeInOutCubic' }, 0)).toBe(0);
    expect(transitionProgress({ easing: 'easeInOutCubic' }, 1)).toBeCloseTo(1, 12);
    expect(transitionProgress({ easing: 'easeInOutCubic' }, 0.25)).toBeCloseTo(0.0625, 12);
    expect(transitionProgress({ easing: 'easeInOutCubic' }, 0.5)).toBeCloseTo(0.5, 12);
    expect(transitionProgress({ easing: 'easeOutCubic' }, 0.5)).toBeCloseTo(EASINGS.easeOutCubic(0.5), 12);
    expect(transitionProgress({ easing: 'easeInOutCubic' }, -4)).toBe(0);
    expect(transitionProgress({ easing: 'easeInOutCubic' }, 9)).toBeCloseTo(1, 12);
    expect(transitionProgress({ easing: 'easeInOutCubic' }, Number.NaN)).toBe(0);
  });
});

describe('crossfade, slide e wipe', () => {
  it('crossfade: opacidade da cena que entra segue a curva escolhida', () => {
    const lin = twoScenes({ kind: 'crossfade', durationMs: 1000 });
    const smooth = twoScenes({ kind: 'crossfade', durationMs: 1000, easing: 'easeInOutCubic' });
    const { segments } = buildMontage(lin);
    const t = segments[1]!.startMs + 250; // 25% da sobreposição
    expect(frame(lin, t).groups[1]!.opacity).toBeCloseTo(0.25, 9);
    expect(frame(smooth, t).groups[1]!.opacity).toBeCloseTo(0.0625, 9);
  });
  it('extremos 0% e 100%: o primeiro quadro mostra só a anterior; ao acabar a sobreposição a cena entra inteira', () => {
    for (const kind of ['crossfade', 'slide', 'wipe'] as const) {
      const p = twoScenes({ kind, durationMs: 1000, easing: 'easeInOutCubic' });
      const { segments } = buildMontage(p);
      const s1 = segments[1]!;
      const start = frame(p, s1.startMs);
      expect(start.groups.length).toBe(2);
      if (kind === 'crossfade') expect(start.groups[1]!.opacity).toBe(0);
      if (kind === 'slide') expect(start.groups[1]!.transform).toMatch(/translate\(1920 0\)/);
      if (kind === 'wipe') expect(start.defs).toMatch(/width="0"/);
      const end = frame(p, s1.startMs + s1.overlapMs);
      expect(end.groups.length).toBe(1);
    }
  });
  it('slide e wipe usam a mesma função suavizada', () => {
    const p = twoScenes({ kind: 'slide', durationMs: 1000, easing: 'easeInOutCubic' });
    const { segments } = buildMontage(p);
    const t = segments[1]!.startMs + 250;
    const m = /translate\(([-\d.]+) 0\)/.exec(frame(p, t).groups[1]!.transform)!;
    expect(Number(m[1])).toBeCloseTo((1 - 0.0625) * 1920, 0);
    const w = twoScenes({ kind: 'wipe', durationMs: 1000, easing: 'easeInOutCubic' });
    const wt = buildMontage(w).segments[1]!.startMs + 750;
    const width = /<clipPath id="wipe-[^"]+"><rect [^>]*width="([\d.]+)"/.exec(frame(w, wt).defs)!;
    expect(Number(width[1])).toBeCloseTo(1920 * 0.9375, 0);
  });
  it('sobreposição curta (limitada pela metade da cena) e duração 0 não quebram', () => {
    const short = twoScenes({ kind: 'crossfade', durationMs: 5000, easing: 'easeInOutCubic' }, {}, 500);
    const { segments } = buildMontage(short);
    expect(segments[1]!.overlapMs).toBe(250);
    for (let t = 0; t <= 800; t += 50) expect(planToSvgString(frame(short, t), 64, 36)).not.toMatch(/NaN|Infinity/);
    const zero = twoScenes({ kind: 'crossfade', durationMs: 0, easing: 'easeInOutCubic' });
    expect(buildMontage(zero).segments[1]!.overlapMs).toBe(0);
    expect(frame(zero, buildMontage(zero).segments[1]!.startMs).groups.length).toBe(1);
  });
  it('não muda duração total nem o tipo da transição', () => {
    const a = buildMontage(twoScenes({ kind: 'crossfade', durationMs: 800 }));
    const b = buildMontage(twoScenes({ kind: 'crossfade', durationMs: 800, easing: 'easeInOutCubic' }));
    expect(b.totalMs).toBe(a.totalMs);
    expect(b.segments.map((s) => s.overlapMs)).toEqual(a.segments.map((s) => s.overlapMs));
  });
});

describe('fades de entrada e saída (avaliados separadamente)', () => {
  it('fade de entrada: preto vai de 100% a 0% e a curva suave começa e termina devagar', () => {
    const lin = twoScenes({ kind: 'fade', durationMs: 1000 });
    const smooth = twoScenes({ kind: 'fade', durationMs: 1000, easing: 'easeInOutCubic' });
    const start = buildMontage(lin).segments[1]!.startMs;
    expect(blackOpacities(frame(lin, start).screen)[0]).toBeCloseTo(1, 2);
    expect(blackOpacities(frame(smooth, start).screen)[0]).toBeCloseTo(1, 2);
    expect(blackOpacities(frame(lin, start + 250).screen)[0]).toBeCloseTo(0.75, 2);
    expect(blackOpacities(frame(smooth, start + 250).screen)[0]).toBeCloseTo(1 - 0.0625, 2);
    expect(blackOpacities(frame(smooth, start + 1000).screen).length).toBe(0);
  });
  it('fade de saída usa a suavização da própria saída, sem depender da entrada da próxima cena', () => {
    const p = twoScenes({ kind: 'cut' }, { kind: 'fade', durationMs: 1000, easing: 'easeInOutCubic' });
    // 250 ms depois de a saída começar (cena A tem 4000 ms): progresso 25% → preto = 0.0625
    expect(blackOpacities(frame(p, 3250).screen)[0]).toBeCloseTo(0.0625, 2);
    expect(blackOpacities(frame(p, 3999).screen)[0]).toBeGreaterThan(0.99);
    const lin = twoScenes({ kind: 'cut' }, { kind: 'fade', durationMs: 1000 });
    expect(blackOpacities(frame(lin, 3250).screen)[0]).toBeCloseTo(0.25, 2);
  });
});

describe('exportação usa o mesmo quadro da prévia', () => {
  it('quadro exportado do projeto inteiro é idêntico ao da montagem, com e sem suavização', () => {
    for (const easing of [undefined, 'easeInOutCubic'] as const) {
      const p = twoScenes({ kind: 'crossfade', durationMs: 1000, easing }, { kind: 'fade', durationMs: 500, easing });
      const { segments } = buildMontage(p);
      const exp = scopeRange(p, { kind: 'project' });
      const { w, h } = { w: p.settings.width, h: p.settings.height };
      for (const t of [segments[1]!.startMs + 100, segments[1]!.startMs + 500, 3700, 5000]) {
        expect(exp.frameAt(t, () => undefined, false)).toBe(planToSvgString(planMontageFrame(p, segments, t, () => undefined), w, h));
      }
    }
  });
});

describe('compatibilidade', () => {
  it('transição antiga (sem easing) lê como antes e não ganha o campo ao salvar', () => {
    const old = { kind: 'crossfade', durationMs: 500 };
    const parsed = TransitionSchema.parse(old);
    expect(parsed.easing).toBeUndefined();
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(old);
  });
  it('valor desconhecido vira linear (campo descartado)', () => {
    expect(TransitionSchema.parse({ kind: 'wipe', durationMs: 300, easing: 'elastic' }).easing).toBeUndefined();
  });
  it('projeto com o novo campo faz ida e volta pelo JSON', () => {
    const p = twoScenes({ kind: 'slide', durationMs: 600, easing: 'easeInOutCubic' });
    const again = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(again.scenes[again.sceneOrder[1]!]!.transitionIn.easing).toBe('easeInOutCubic');
  });
  it('projeto legado: o quadro é idêntico antes e depois de abrir e salvar', () => {
    const p = twoScenes({ kind: 'crossfade', durationMs: 800 }, { kind: 'fade', durationMs: 400 });
    const again = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    const { segments } = buildMontage(p);
    for (const t of [0, 1000, segments[1]!.startMs + 300, 3700, 6000]) {
      expect(planToSvgString(frame(again, t), 160, 90)).toBe(planToSvgString(frame(p, t), 160, 90));
    }
  });
});
