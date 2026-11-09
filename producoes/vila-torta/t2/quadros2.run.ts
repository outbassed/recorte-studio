import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { produzir2 } from './produzir2';
import { planFrame, planToSvgString } from '@/engine/render/plan';
const OUT = '/tmp/claude-0/shots2';
it('quadros', () => {
  mkdirSync(OUT, { recursive: true });
  const { B, project: proj } = produzir2();
  const only = process.env.ONLY; const times = (process.env.T ?? '').split(',').filter(Boolean).map(Number);
  B.scenes.forEach((sc, i) => {
    if (only && !String(i + 1).match(new RegExp(`^(${only})$`))) return;
    const dur = proj.scenes[sc.id]!.durationMs;
    for (const t of times.length ? times : [Math.round(dur * 0.55)]) writeFileSync(`${OUT}/s${String(i + 1).padStart(3, '0')}_${t}.svg`, planToSvgString(planFrame(proj, proj.scenes[sc.id]!, Math.min(t, dur - 1), () => undefined), 1920, 1080));
  });
});
