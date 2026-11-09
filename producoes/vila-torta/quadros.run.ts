/** Amostra quadros do episódio como SVG (conferência visual). Uso: ONLY="3|10" T=1500 npx vitest run -c producoes/vila-torta/vitest.config.ts quadros */
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { produzir } from './produzir';
import { planFrame, planToSvgString } from '@/engine/render/plan';

const OUT = process.env.OUT ?? '/tmp/claude-0/shots';
const only = process.env.ONLY;
it('quadros', () => {
  mkdirSync(OUT, { recursive: true });
  const { B, project: proj } = produzir();
  const times = (process.env.T ?? '').split(',').filter(Boolean).map(Number);
  writeFileSync(`${OUT}/index.txt`, B.scenes.map((sc, i) => `${i + 1}\t${proj.scenes[sc.id]!.durationMs}\t${sc.name}`).join('\n'));
  B.scenes.forEach((sc, i) => {
    if (only && !String(i + 1).match(new RegExp(`^(${only})$`))) return;
    const dur = proj.scenes[sc.id]!.durationMs;
    for (const t of times.length ? times : [Math.round(dur * 0.55)]) {
      const plan = planFrame(proj, proj.scenes[sc.id]!, Math.min(t, dur - 1), () => undefined);
      writeFileSync(`${OUT}/s${String(i + 1).padStart(3, '0')}_${t}.svg`, planToSvgString(plan, 1920, 1080));
    }
  });
});
