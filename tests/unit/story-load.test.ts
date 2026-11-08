/** Histórias grandes: validade, determinismo, preview × exportação e orçamento de tempo do desenho. */
import { describe, expect, it } from 'vitest';
import { ProjectSchema } from '@/engine/model/schema';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { buildMontage } from '@/engine/render/montage';
import { sceneOf } from '@/engine/model/ops';
import { bigStory, SKY } from '../fixtures/story';

const url = (id: string) => `blob:${id}`;
const dataUrl = (id: string) => `data:image/png;base64,${id}`;

describe('história grande', () => {
  it('é um projeto válido, com multidão, objetos aninhados e dois horários', () => {
    const p = bigStory();
    expect(() => ProjectSchema.parse(JSON.parse(JSON.stringify(p)))).not.toThrow();
    const cb = Object.values(p.customBackgrounds)[0]!;
    expect(cb.compositions.day!.pieces.filter((x) => x.kind === 'character')).toHaveLength(6);
    expect(cb.compositions.day!.pieces.length).toBeGreaterThan(60);
    expect(p.sceneOrder.length).toBe(5);
  });
  it('as cenas usam os horários pedidos e a montagem soma as durações', () => {
    const p = bigStory();
    const svgs = p.sceneOrder.map((id) => planToSvgString(planFrame(p, sceneOf(p, id), 500, url), 480, 270));
    expect(svgs[0]).toContain(SKY.day);
    expect(svgs[2]).toContain(SKY.night);
    expect(svgs[0]).toContain('data-composition="1"');
    const { totalMs, segments } = buildMontage(p);
    expect(segments).toHaveLength(5);
    expect(totalMs).toBeGreaterThan(20000);
  });
  it('determinismo: o mesmo instante gera exatamente o mesmo quadro, antes e depois do cache', () => {
    const p = bigStory();
    const s = sceneOf(p, p.sceneOrder[0]!);
    const a = planToSvgString(planFrame(p, s, 1234, url), 640, 360);
    const b = planToSvgString(planFrame(p, s, 1234, url), 640, 360);
    expect(a).toBe(b);
  });
  it('preview × exportação: mesmo plano, só muda de onde vêm as imagens', () => {
    const p = bigStory();
    for (const id of p.sceneOrder) {
      const s = sceneOf(p, id);
      const prev = planToSvgString(planFrame(p, s, 900, url), 960, 540);
      const exp = planToSvgString(planFrame(p, s, 900, dataUrl), 960, 540);
      expect(prev).toBe(exp);
    }
  });
  it('vertical 9:16: tudo dentro do quadro e o cenário próprio aparece', () => {
    const p = bigStory({ template: 'vertical' });
    expect(p.settings.height).toBeGreaterThan(p.settings.width);
    const s = sceneOf(p, p.sceneOrder[0]!);
    expect(planToSvgString(planFrame(p, s, 500, url), 270, 480)).toContain('data-composition="1"');
  });
  it('orçamento de tempo: 120 quadros de cena pesada (cenário de 60+ peças e 6 figurantes) em poucos segundos', () => {
    const p = bigStory({ crowd: 10, buildings: 80 });
    const s = sceneOf(p, p.sceneOrder[0]!);
    planToSvgString(planFrame(p, s, 0, url), 960, 540); // aquece os caches
    const t0 = performance.now();
    let bytes = 0;
    for (let i = 0; i < 120; i++) bytes += planToSvgString(planFrame(p, s, (i * 1000) / 30, url), 960, 540).length;
    const ms = performance.now() - t0;
    expect(bytes).toBeGreaterThan(120 * 10_000);
    // Meta folgada para o jsdom em máquinas lentas: ~25 ms por quadro. O cenário é desenhado uma vez só (cache).
    expect(ms / 120).toBeLessThan(25);
  });
  it('editar uma peça do cenário muda os quadros seguintes (cache invalida)', () => {
    const p = bigStory();
    const cb = Object.values(p.customBackgrounds)[0]!;
    const s = sceneOf(p, p.sceneOrder[0]!);
    const before = planToSvgString(planFrame(p, s, 0, url), 480, 270);
    const frozen = JSON.parse(JSON.stringify(p)) as typeof p;
    frozen.customBackgrounds[cb.id]!.compositions.day!.pieces[0]!.fill = '#123456';
    const after = planToSvgString(planFrame(frozen, sceneOf(frozen, frozen.sceneOrder[0]!), 0, url), 480, 270);
    expect(after).toContain('#123456');
    expect(before).not.toContain('#123456');
  });
});
