/** 1.1: movimento secundário, sequências, enquadramentos e cenários com horários. */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { evaluateScene } from '@/engine/animation/evaluate';
import { sampleSecondary } from '@/engine/animation/secondary';
import { autoBlink } from '@/engine/animation/lipsync';
import { applySequence, extractSequence, frameCamera, insertAction, readProperty, sceneOf, addDialogue } from '@/engine/model/ops';
import { createCharacterNode } from '@/engine/model/factory';
import { CAMERA_TARGET, ProjectSchema, SecondaryMotionSchema, type AnyClip, type Project } from '@/engine/model/schema';
import { applyCustomBackground, availableTimes, CUSTOM_RECT, createCustomBackground, customBackgroundUsage, deleteCustomBackground, resolveCustomVariant } from '@/engine/world/customBackgrounds';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { referencedAssetIds } from '@/features/projects/jrec';

const demo = () => {
  const p = createDemoProject();
  const s = sceneOf(p, p.sceneOrder[0]!);
  const nodes = Object.values(s.nodes).filter((n) => n.kind === 'character');
  return { p, s, nina: nodes.find((n) => n.name === 'Nina')!.id, zeca: nodes.find((n) => n.name === 'Zeca')!.id };
};
const enable = (p: Project, sceneId: string, id: string) => {
  const n = p.scenes[sceneId]!.nodes[id]!;
  if (n.kind === 'character') n.secondary = SecondaryMotionSchema.parse({ enabled: true });
};

describe('movimento secundário', () => {
  it('desligado não muda nada (projetos antigos ficam iguais)', () => {
    expect(sampleSecondary('x', 1234, SecondaryMotionSchema.parse({}), 0)).toEqual({ rig: {}, gazeX: 0, gazeY: 0 });
    expect(SecondaryMotionSchema.parse({}).enabled).toBe(false);
    expect(createCharacterNode('c', 'N').secondary.enabled).toBe(true);
  });
  it('é determinístico: mesmo tempo, mesmo quadro, em qualquer ordem de seek', () => {
    const { p, s, nina } = demo();
    enable(p, s.id, nina);
    const a = planToSvgString(planFrame(p, s, 2345, () => undefined), 64, 36);
    planFrame(p, s, 8000, () => undefined);
    planFrame(p, s, 10, () => undefined);
    expect(planToSvgString(planFrame(p, s, 2345, () => undefined), 64, 36)).toBe(a);
  });
  it('respira e mexe a cabeça de forma sutil e varia no tempo', () => {
    const cfg = SecondaryMotionSchema.parse({ enabled: true });
    const samples = [0, 700, 1400, 2100, 2800].map((t) => sampleSecondary('nina', t, cfg, 0));
    expect(new Set(samples.map((x) => x.rig.breath!.toFixed(3))).size).toBeGreaterThan(2);
    for (const x of samples) {
      expect(Math.abs(x.rig.headTilt!)).toBeLessThan(3);
      expect(Math.abs(x.gazeX)).toBeLessThan(0.2);
    }
  });
  it('diminui durante ações para não brigar com elas', () => {
    const cfg = SecondaryMotionSchema.parse({ enabled: true });
    const free = sampleSecondary('n', 1000, cfg, 0);
    const busy = sampleSecondary('n', 1000, cfg, 1);
    expect(busy.rig.headTilt).toBeCloseTo(0);
    expect(busy.gazeX).toBeCloseTo(0);
    expect(Math.abs(free.rig.headTilt!)).toBeGreaterThan(0);
  });
  it('olhar continua coerente com o alvo mesmo com olhares rápidos', () => {
    const { p, s, nina, zeca } = demo();
    enable(p, s.id, nina);
    enable(p, s.id, zeca);
    for (const t of [0, 1000, 3000, 7000]) {
      const r = evaluateScene(p, s, t);
      expect(r.characters[nina]!.pose.face.gazeX).toBeGreaterThan(0.5);
      expect(r.characters[zeca]!.pose.face.gazeX).toBeLessThan(-0.5);
    }
  });
  it('piscada dupla ocasional, sempre entre 0 e 1', () => {
    let doubles = 0;
    for (let c = 0; c < 200; c++) {
      let peaks = 0;
      let prev = 0;
      for (let t = c * 6000; t < c * 6000 + 6000; t += 10) {
        const v = autoBlink('nina', t);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        if (v > 0.9 && prev <= 0.9) peaks++;
        prev = v;
      }
      if (peaks >= 3) doubles++;
    }
    expect(doubles).toBeGreaterThan(0);
    // 120 mil amostras com asserções: com a máquina ocupada passa de 5 s (limite padrão do Vitest).
  }, 30_000);
});

describe('transições e sequências', () => {
  it('blendMs suaviza entrada e saída do clip', () => {
    const { p, s, nina } = demo();
    insertAction(p, s, nina, 'wave', 1000, { durationMs: 2000, side: 'L' });
    const track = s.tracks.find((t) => t.type === 'action' && t.targetNodeId === nina)!;
    if (track.type !== 'action') throw new Error();
    track.clips[0]!.blendMs = 800;
    const early = evaluateScene(p, s, 1200).characters[nina]!.pose.rig.armLUpper;
    const mid = evaluateScene(p, s, 2000).characters[nina]!.pose.rig.armLUpper;
    expect(early).toBeLessThan(mid * 0.5);
  });
  it('sequência salva de um personagem pode ser aplicada em outro, como clips editáveis', () => {
    const { p, s, nina, zeca } = demo();
    insertAction(p, s, nina, 'wave', 500, { durationMs: 1000 });
    const seq = extractSequence(s, nina)!;
    expect(seq.items.length).toBeGreaterThan(1);
    expect(seq.items[0]!.offsetMs).toBe(0);
    const before = s.tracks.filter((t) => 'targetNodeId' in t && t.targetNodeId === zeca).flatMap((t) => (t.type === 'property' ? [] : (t.clips as AnyClip[]))).length;
    const n = applySequence(s, zeca, seq, 3000);
    expect(n).toBe(seq.items.length);
    const after = s.tracks.filter((t) => 'targetNodeId' in t && t.targetNodeId === zeca).flatMap((t) => (t.type === 'property' ? [] : (t.clips as AnyClip[])));
    expect(after.length).toBe(before + n);
    expect(Math.min(...after.filter((c) => c.startMs >= 3000).map((c) => c.startMs))).toBe(3000);
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });
  it('fala longa por sequência mantém o texto', () => {
    const { s, nina, zeca } = demo();
    addDialogue(s, nina, 'Ônibus 42 atrasou de novo!', 0, 2000);
    const seq = extractSequence(s, nina)!;
    applySequence(s, zeca, seq, 100);
    expect(JSON.stringify(s.tracks)).toContain('Ônibus 42 atrasou de novo!');
  });
});

describe('enquadramentos de câmera', () => {
  it('close centraliza X e Y na cabeça, com zoom maior que o plano médio', () => {
    const { p, s, nina } = demo();
    frameCamera(p, s, 'medium', [nina], 0);
    const medium = readProperty(s, CAMERA_TARGET, 'zoom', 0) as number;
    frameCamera(p, s, 'close', [nina], 2000);
    const close = readProperty(s, CAMERA_TARGET, 'zoom', 2000) as number;
    expect(close).toBeGreaterThan(medium);
    expect(readProperty(s, CAMERA_TARGET, 'x', 2000)).toBeCloseTo(s.nodes[nina]!.transform.x, 0);
    expect(readProperty(s, CAMERA_TARGET, 'y', 2000) as number).toBeLessThan(0);
    // Corte seco: antes do instante continua o enquadramento anterior.
    expect(readProperty(s, CAMERA_TARGET, 'zoom', 1999)).toBeCloseTo(medium);
  });
  it('dois personagens cabem no quadro; movimento suave interpola', () => {
    const { p, s, nina, zeca } = demo();
    expect(frameCamera(p, s, 'two-shot', [nina, zeca], 1000, 1000)).toBe(true);
    const x = readProperty(s, CAMERA_TARGET, 'x', 2000) as number;
    expect(x).toBeCloseTo((s.nodes[nina]!.transform.x + s.nodes[zeca]!.transform.x) / 2, 0);
    const mid = readProperty(s, CAMERA_TARGET, 'zoom', 1500) as number;
    expect(mid).toBeGreaterThan(Math.min(1, readProperty(s, CAMERA_TARGET, 'zoom', 2000) as number) - 0.001);
    expect(frameCamera(p, s, 'two-shot', [nina], 0)).toBe(false);
  });
});

describe('cenários personalizados com horários opcionais', () => {
  const withAsset = (p: Project, id: string) => {
    p.assets[id] = { id, kind: 'image', name: `${id}.png`, mime: 'image/png', size: 10, createdAt: 0 };
  };
  it('uma, três e cinco variantes', () => {
    const { p } = demo();
    const one = createCustomBackground(p, 'Só noite');
    one.variants.night = { assetId: 'media_n', fit: 'cover' };
    const three = createCustomBackground(p, 'Três');
    for (const t of ['morning', 'afternoon', 'night'] as const) three.variants[t] = { assetId: `media_${t}`, fit: 'cover' };
    const five = createCustomBackground(p, 'Cinco');
    for (const t of ['morning', 'day', 'afternoon', 'sunset', 'night'] as const) five.variants[t] = { assetId: `media_5${t}`, fit: 'cover' };
    expect(availableTimes(one)).toEqual(['night']);
    expect(availableTimes(three)).toEqual(['morning', 'afternoon', 'night']);
    expect(availableTimes(five)).toHaveLength(5);
    expect(resolveCustomVariant(one, 'day')).toEqual({ time: 'night', fallback: true });
    expect(resolveCustomVariant(three, 'sunset')).toEqual({ time: 'night', fallback: true });
    expect(resolveCustomVariant(three, 'afternoon')).toEqual({ time: 'afternoon', fallback: false });
    expect(resolveCustomVariant(createCustomBackground(p, 'vazio'), 'day')).toBeNull();
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });
  it('troca de horário usa a imagem certa, no mesmo retângulo', () => {
    const { p, s } = demo();
    const cb = createCustomBackground(p, 'Ponto de ônibus');
    cb.variants.day = { assetId: 'media_day', fit: 'cover' };
    cb.variants.night = { assetId: 'media_night', fit: 'contain' };
    withAsset(p, 'media_day');
    withAsset(p, 'media_night');
    applyCustomBackground(s, cb, 'day');
    expect(Object.values(s.nodes).some((n) => n.backgroundOwned)).toBe(false);
    const url = (id: string) => `blob:${id}`;
    const day = planToSvgString(planFrame(p, s, 0, url), 64, 36);
    expect(day).toContain('href="blob:media_day"');
    expect(day).toContain(`x="${CUSTOM_RECT.x}" y="${CUSTOM_RECT.y}" width="${CUSTOM_RECT.w}"`);
    s.background.timeOfDay = 'night';
    const night = planToSvgString(planFrame(p, s, 0, url), 64, 36);
    expect(night).toContain('href="blob:media_night"');
    expect(night).toContain('xMidYMid meet');
    expect(night).toContain(`x="${CUSTOM_RECT.x}" y="${CUSTOM_RECT.y}" width="${CUSTOM_RECT.w}"`);
  });
  it('imagem ausente mostra aviso no quadro, sem quebrar', () => {
    const { p, s } = demo();
    const cb = createCustomBackground(p, 'Sumiu');
    cb.variants.day = { assetId: 'media_x', fit: 'cover' };
    applyCustomBackground(s, cb);
    expect(planToSvgString(planFrame(p, s, 0, () => undefined), 64, 36)).toContain('imagem ausente');
  });
  it('mídias das variantes entram no .jrec; excluir avisa e volta ao neutro', () => {
    const { p, s } = demo();
    const cb = createCustomBackground(p, 'Praça');
    cb.variants.sunset = { assetId: 'media_ss', fit: 'cover' };
    applyCustomBackground(s, cb, 'sunset');
    expect(referencedAssetIds(p).has('media_ss')).toBe(true);
    expect(customBackgroundUsage(p, cb.id)).toBe(1);
    expect(deleteCustomBackground(p, cb.id)).toBe(1);
    expect(s.background.presetId).toBe('neutro');
  });
});
