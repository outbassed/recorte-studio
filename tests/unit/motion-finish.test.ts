/** Etapa 1, entrega 3: acabamento de movimento (antecipação + esmagar e esticar) no pulo. */
import { describe, expect, it } from 'vitest';
import { ACTIONS, MAX_SQUASH, getAction, jumpFinishSample, sampleActionClip } from '@/engine/animation/actions';
import { evaluateScene } from '@/engine/animation/evaluate';
import { getBuiltinCharacter, poseRig } from '@/engine/character/presets';
import { renderCharacter, squashScale, type CharacterPose } from '@/engine/character/render';
import { ActionClipSchema, ProjectSchema, type ActionClip, type Project } from '@/engine/model/schema';
import { RigSchema } from '@/engine/model/schema';
import { bakeActionClip, extractSequence, applySequence, insertAction, sceneOf } from '@/engine/model/ops';
import { getPropertyDef } from '@/engine/model/properties';
import { createDemoProject } from '@/features/templates/projects';
import { planFrame, planToSvgString } from '@/engine/render/plan';

const clip = (o: Partial<ActionClip> = {}): ActionClip => ActionClipSchema.parse({ id: 'c', kind: 'action', action: 'jump', startMs: 0, durationMs: 800, ...o });
const rigAt = (c: ActionClip, t: number) => {
  const s = sampleActionClip(c, t, 'L');
  return s ? { ...s.rig, weight: s.weight } : null;
};

describe('legado: finish ausente ou 0 não muda o pulo', () => {
  it('amostra idêntica à fórmula original', () => {
    for (const finish of [undefined, 0]) {
      const c = clip(finish === undefined ? {} : { finish });
      for (const t of [100, 250, 400, 560, 700]) {
        const local = t / 800;
        const arc = Math.sin(local * Math.PI);
        const r = getAction('jump')!.sample({ t: local, ms: t, speed: 1, intensity: 1, side: 'L', durationMs: 800, finish: finish ?? 0 });
        expect(r.rig.bodyY).toBeCloseTo(arc * 150, 9);
        expect(r.rig.armLUpper).toBeCloseTo(arc * 120, 9);
        expect(r.rig).not.toHaveProperty('squash');
        expect(sampleActionClip(c, t, 'L')!.rig).toEqual(r.rig);
      }
    }
  });
  it('clip antigo lê sem o campo e não o ganha ao salvar; valor inválido é descartado', () => {
    const old = { id: 'c', kind: 'action', action: 'jump', label: 'Pular', startMs: 0, durationMs: 800, intensity: 1, speed: 1, side: 'auto', easing: 'easeInOut' };
    const parsed = ActionClipSchema.parse(old);
    expect(parsed.finish).toBeUndefined();
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(old);
    expect(ActionClipSchema.parse({ ...old, finish: 'muito' }).finish).toBeUndefined();
    expect(ActionClipSchema.parse({ ...old, finish: 9 }).finish).toBeUndefined();
    expect(ActionClipSchema.parse({ ...old, finish: 1.5 }).finish).toBe(1.5);
  });
  it('outras ações ignoram finish', () => {
    const wave = ActionClipSchema.parse({ id: 'w', kind: 'action', action: 'wave', startMs: 0, durationMs: 1000, finish: 1 });
    const plain = ActionClipSchema.parse({ id: 'w', kind: 'action', action: 'wave', startMs: 0, durationMs: 1000 });
    expect(sampleActionClip(wave, 500, 'L')).toEqual(sampleActionClip(plain, 500, 'L'));
    expect(ACTIONS.filter((a) => a.finishable).map((a) => a.id)).toEqual(['jump']);
  });
  it('rig antigo (sem squash) continua sem o campo (dados e pacotes antigos idênticos)', () => {
    expect(RigSchema.parse({}).squash).toBeUndefined();
    expect(JSON.stringify(RigSchema.parse({ bodyY: 3 }))).not.toContain('squash');
  });
});

describe('pulo com acabamento', () => {
  const D = 800;
  const at = (t: number, intensity = 1, finish = 1) => jumpFinishSample(t / D, D, intensity, finish).rig;
  it('começa e termina em repouso (sem salto no primeiro nem no último quadro)', () => {
    for (const k of ['bodyY', 'squash', 'sit', 'torsoLean', 'armLUpper'] as const) {
      expect(Math.abs(at(0)[k] ?? 0), `${k}@0`).toBeLessThan(1e-9);
      expect(Math.abs(at(799.9)[k] ?? 0), `${k}@fim`).toBeLessThan(0.02 * (k === 'squash' ? 1 : 10));
    }
  });
  it('antecipação: agacha (esmaga) e o corpo ainda não sobe; braços recuam', () => {
    const r = at(120);
    expect(r.squash!).toBeGreaterThan(0.05);
    expect(r.bodyY!).toBe(0);
    expect(r.armLUpper!).toBeLessThan(0);
  });
  it('impulso: a compressão vira esticada e o corpo sobe', () => {
    const rise = at(300);
    expect(rise.bodyY!).toBeGreaterThan(40);
    expect(rise.squash!).toBeLessThan(0);
  });
  it('ápice: altura máxima igual à do pulo normal (150×intensidade) e esticada quase nula (pausa)', () => {
    let maxY = 0;
    let maxAt = 0;
    for (let t = 0; t < D; t += 4) {
      const y = at(t).bodyY!;
      if (y > maxY) { maxY = y; maxAt = t; }
    }
    expect(maxY).toBeCloseTo(150, 0);
    expect(Math.abs(at(maxAt).squash!)).toBeLessThan(0.01);
    // pausa visual: perto do topo a altura quase não muda
    expect(maxY - at(maxAt + 40).bodyY!).toBeLessThan(10);
    expect(at(300, 2).bodyY!).toBeCloseTo(at(300, 1).bodyY! * 2, 6);
  });
  it('pouso: esmaga no contato, oscila e recupera; pés no chão (bodyY 0)', () => {
    const contact = D * (1 - Math.max(110, Math.min(320, 0.24 * D)) / D);
    const land = Array.from({ length: 60 }, (_, i) => at(contact + (i * (D - contact)) / 60));
    const peak = Math.max(...land.map((r) => r.squash!));
    expect(peak).toBeGreaterThan(0.12);
    for (const r of land) expect(r.bodyY!).toBeLessThan(1e-9);
    expect(Math.abs(land[land.length - 1]!.squash!)).toBeLessThan(0.03);
  });
  it('é sutil por padrão e limitado: |squash| ≤ 0.5 mesmo com valores absurdos', () => {
    let maxAbs = 0;
    for (let t = 0; t < D; t += 5) maxAbs = Math.max(maxAbs, Math.abs(at(t).squash!));
    expect(maxAbs).toBeLessThan(0.25);
    for (const [i, f] of [[3, 2], [99, 99], [1, 5]] as const) {
      for (let t = 0; t <= D; t += 20) expect(Math.abs(at(t, i, f).squash!)).toBeLessThanOrEqual(MAX_SQUASH);
    }
  });
  it('escala com a intensidade do acabamento', () => {
    expect(Math.abs(at(120, 1, 2).squash!)).toBeGreaterThan(Math.abs(at(120, 1, 0.5).squash!) * 3);
  });
  it('clips muito curtos, tempos fora de faixa e entradas ruins sempre dão números finitos', () => {
    for (const dur of [1, 20, 90, 300, 5000]) {
      for (const t of [-1, 0, 0.01, 0.25, 0.5, 0.75, 0.999, 1, 2, Number.NaN]) {
        for (const [k, f] of [[0, 1], [1, 0.05], [3, 2], [Number.NaN, 1], [1, Number.NaN]] as const) {
          const r = jumpFinishSample(t, dur, k, f).rig;
          for (const [key, v] of Object.entries(r)) expect(Number.isFinite(v as number), `${key} dur=${dur} t=${t}`).toBe(true);
        }
      }
    }
  });
  it('é função pura do tempo (acesso fora de ordem e retroceder dão o mesmo valor)', () => {
    const c = clip({ finish: 1 });
    const order = [700, 100, 450, 0, 799, 300, 100, 700];
    const seen = new Map<number, string>();
    for (const t of order) {
      const v = JSON.stringify(rigAt(c, t));
      if (seen.has(t)) expect(v).toBe(seen.get(t));
      else seen.set(t, v);
    }
  });
  it('o clip que sai da blenda no fim volta a 0 (peso)', () => {
    const c = clip({ finish: 1, blendMs: 60 });
    expect(rigAt(c, 0)!.weight).toBeLessThan(0.01);
    expect(rigAt(c, 799)!.weight).toBeLessThan(0.05);
  });
});

describe('renderização do esmagar/esticar', () => {
  const def = getBuiltinCharacter('nina') ?? getBuiltinCharacter('helena')!;
  const pose = (squash: number, bodyView: CharacterPose['bodyView'] = 'front'): CharacterPose => ({
    bodyView, headView: bodyView, rig: RigSchema.parse({ ...poseRig('idle'), squash }), handL: 'open', handR: 'open',
    face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 },
  });
  const rootTransform = (svg: string) => /data-part="root"[^>]*transform="([^"]*)"/.exec(svg)![1]!;
  it('squash 0 não acrescenta escala (SVG de personagens antigos fica igual)', () => {
    expect(rootTransform(renderCharacter(def, pose(0), 't').svg)).not.toMatch(/scale/);
    const legacy = renderCharacter(def, { ...pose(0), rig: RigSchema.parse(poseRig('idle')) }, 't');
    expect(renderCharacter(def, pose(0), 't').svg).toBe(legacy.svg);
  });
  it('esmagar achata e alarga em torno dos pés, mantendo a área (volume aparente)', () => {
    const { sx, sy } = squashScale(0.2);
    expect(sy).toBeCloseTo(0.8, 9);
    expect(sx * sy).toBeCloseTo(Math.sqrt(0.8), 9);
    expect(sx).toBeGreaterThan(1);
    const st = squashScale(-0.2);
    expect(st.sy).toBeCloseTo(1.2, 9);
    expect(st.sx).toBeLessThan(1);
    expect(squashScale(Number.NaN)).toEqual({ sx: 1, sy: 1 });
    expect(squashScale(9).sy).toBeCloseTo(0.5, 9);
    expect(rootTransform(renderCharacter(def, pose(0.2), 't').svg)).toMatch(/scale\(1\.1\d* 0\.8\)/);
  });
  it('cabeça e mãos acompanham a escala (balões e objetos seguram no lugar certo)', () => {
    const a = renderCharacter(def, pose(0), 't');
    const b = renderCharacter(def, pose(0.2), 't');
    expect(b.head[1]).toBeCloseTo(a.head[1] * 0.8, 6);
    expect(b.handL[1]).toBeCloseTo(a.handL[1] * 0.8, 6);
    expect(b.handL[0]).toBeCloseTo(a.handL[0] * squashScale(0.2).sx, 6);
  });
  it('funciona em todas as vistas, com esticada e sem NaN', () => {
    for (const v of ['front', 'front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right'] as const) {
      for (const q of [-0.3, 0.3]) expect(renderCharacter(def, pose(q, v), 't').svg).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('na cena (preview = exportação)', () => {
  const setup = (finish?: number) => {
    const p = createDemoProject();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const nina = Object.values(s.nodes).find((n) => n.kind === 'character' && n.name === 'Nina')!;
    s.tracks = s.tracks.filter((t) => t.type !== 'property');
    insertAction(p, s, nina.id, 'jump', 1000, { durationMs: 800 });
    const tr = s.tracks.find((t) => t.type === 'action' && t.targetNodeId === nina.id)!;
    if (tr.type === 'action' && finish !== undefined) tr.clips[0]!.finish = finish;
    return { p, s, id: nina.id };
  };
  it('esmaga na antecipação e estica no impulso; sem finish o squash fica 0', () => {
    const on = setup(1);
    expect(evaluateScene(on.p, on.s, 1120).characters[on.id]!.pose.rig.squash).toBeGreaterThan(0.04);
    expect(evaluateScene(on.p, on.s, 1300).characters[on.id]!.pose.rig.squash).toBeLessThan(0);
    const off = setup();
    for (const t of [1000, 1120, 1300, 1500, 1700]) expect(evaluateScene(off.p, off.s, t).characters[off.id]!.pose.rig.squash ?? 0).toBe(0);
  });
  it('quadro igual em qualquer ordem de seek e sem NaN', () => {
    const { p, s } = setup(1);
    const f = (t: number) => planToSvgString(planFrame(p, s, t, () => undefined), 160, 90);
    const a = f(1650);
    f(0); f(1200); f(1120);
    expect(f(1650)).toBe(a);
    for (const t of [1000, 1050, 1120, 1250, 1400, 1650, 1700, 1799]) expect(f(t)).not.toMatch(/NaN|Infinity/);
  });
  it('personagem espelhado (escala X negativa) renderiza sem problemas', () => {
    const { p, s, id } = setup(1);
    const n = s.nodes[id]!;
    n.transform.scaleX = -Math.abs(n.transform.scaleX);
    expect(planToSvgString(planFrame(p, s, 1650, () => undefined), 160, 90)).not.toMatch(/NaN|Infinity/);
  });
  it('legado: abrir e salvar de novo não muda o quadro', () => {
    const { p, s } = setup();
    const again = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    for (const t of [900, 1120, 1400, 1700]) {
      expect(planToSvgString(planFrame(again, sceneOf(again, s.id), t, () => undefined), 160, 90)).toBe(planToSvgString(planFrame(p, s, t, () => undefined), 160, 90));
    }
  });
  it('"Converter em keyframes" inclui o esmagar/esticar com valores finitos', () => {
    const { p, s, id } = setup(1);
    const c = s.tracks.flatMap((t) => (t.type === 'action' && t.targetNodeId === id ? t.clips : [])).find((x) => x.action === 'jump')!;
    bakeActionClip(s, c.id, 20);
    const track = s.tracks.find((t) => t.type === 'property' && t.targetNodeId === id && t.propertyPath === 'rig.squash')!;
    expect(track).toBeTruthy();
    if (track.type !== 'property') throw new Error();
    expect(track.keyframes.length).toBeGreaterThan(10);
    for (const k of track.keyframes) expect(Number.isFinite(k.value as number)).toBe(true);
    expect(getPropertyDef('character', 'rig.squash')).toBeTruthy();
    expect(() => ProjectSchema.parse(JSON.parse(JSON.stringify(p)))).not.toThrow();
  });
  it('sequências salvas levam o acabamento junto', () => {
    const { s, id } = setup(1.5);
    const seq = extractSequence(s, id)!;
    expect(seq.items.find((i) => i.action === 'jump')!.finish).toBe(1.5);
    const other = Object.values(s.nodes).find((n) => n.kind === 'character' && n.id !== id)!;
    applySequence(s, other.id, seq, 4000);
    const copy = s.tracks.flatMap((t) => (t.type === 'action' && t.targetNodeId === other.id ? t.clips : [])).find((c) => c.action === 'jump')!;
    expect(copy.finish).toBe(1.5);
  });
});

export type { Project };
