/**
 * Compatibilidade visual de projetos ANTIGOS: cenas inteiras (fixture real da v0.4 migrada e projeto de demonstração)
 * têm o SVG do quadro fixado com hash ANTES da evolução do motor. Com o IK desligado (padrão) nada pode mudar.
 * Regerar de propósito: RECORTE_UPDATE_GOLDEN=1 npx vitest run tests/unit/legacy-scene-golden.test.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate04 } from '@/migrations/from04';
import { createDemoProject } from '@/features/templates/projects';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { ProjectSchema, type Project } from '@/engine/model/schema';
import fixture from '../fixtures/projeto-0.4.json';

const FILE = resolve(__dirname, 'golden/legacy-scenes.json');
const TIMES = [0, 900, 2200, 3600];

/**
 * IDs aleatórios (e o movimento natural, que usa o ID do nó como semente) viram valores fixos, na ordem em que aparecem:
 * o mesmo projeto sempre dá o mesmo desenho.
 */
function canonical(p: Project): Project {
  const seen = new Map<string, string>();
  const json = JSON.stringify(p).replace(/\b([a-z]{2,8})_[a-z0-9]{10}\b/g, (m, pre: string) => {
    if (!seen.has(m)) seen.set(m, `${pre}_${String(seen.size).padStart(10, '0')}`);
    return seen.get(m)!;
  });
  return ProjectSchema.parse(JSON.parse(json));
}

function compute(): Record<string, string> {
  const out: Record<string, string> = {};
  const projects: Array<[string, Project]> = [['v04', canonical(migrate04(fixture).project)], ['demo', canonical(createDemoProject())]];
  for (const [name, p] of projects) {
    p.sceneOrder.forEach((sid, i) => {
      const scene = p.scenes[sid]!;
      for (const t of TIMES) {
        const svg = planToSvgString(planFrame(p, scene, t, () => undefined), 64, 36);
        out[`${name}|cena${i}|${t}`] = createHash('sha256').update(svg).digest('hex').slice(0, 16);
      }
    });
  }
  return out;
}

describe('cenas de projetos antigos desenham igual (golden)', () => {
  it('hash do quadro inteiro (preview e exportação usam este mesmo SVG)', () => {
    const now = compute();
    if (process.env.RECORTE_UPDATE_GOLDEN === '1' || !existsSync(FILE)) writeFileSync(FILE, JSON.stringify(now, null, 1) + '\n');
    const golden = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, string>;
    expect(Object.keys(now).length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden).sort());
    expect(Object.keys(golden).filter((k) => golden[k] !== now[k])).toEqual([]);
  });
  it('é estável: duas execuções dão o mesmo resultado', () => {
    expect(compute()).toEqual(compute());
  });
});
