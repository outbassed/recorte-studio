/**
 * Rede de segurança do desenho: o SVG de cada personagem padrão, em cada vista e em várias poses, tem um hash
 * fixado ANTES da evolução do motor (Rig V2/IK). Se algum hash mudar, o visual dos personagens antigos mudou.
 * Para regerar de propósito (mudança visual aprovada): RECORTE_UPDATE_GOLDEN=1 npx vitest run tests/unit/character-render-golden.test.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderCharacter, type CharacterPose } from '@/engine/character/render';
import type { FaceState } from '@/engine/character/face';
import { BUILTIN_CHARACTERS, poseRig, POSES } from '@/engine/character/presets';
import { VIEW_ORDER } from '@/engine/character/views';
import type { Rig } from '@/engine/model/schema';

const FILE = resolve(__dirname, 'golden/character-render.json');
const POSE_IDS = ['idle', 'hands-up', 'arms-crossed', 'hips', 'point-L', 'point-R'];
/** Variações extremas do rig (tronco inclinado, respiração, sentado, corpo elevado, braços em ângulos fora do comum). */
const EXTRA: Record<string, Partial<Rig>> = {
  'mix-lean-breath': { torsoLean: 14, breath: 1.2, armLUpper: 70, armLLower: 40, armRUpper: -20, armRLower: 90 },
  'mix-sit-lift': { sit: 0.6, bodyY: 30, armLUpper: 120, armLLower: -30, armRUpper: 30, armRLower: 60 },
};
const face = { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 } as unknown as FaceState;

function compute(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of BUILTIN_CHARACTERS) {
    for (const view of VIEW_ORDER) {
      for (const pid of [...POSE_IDS, ...Object.keys(EXTRA)]) {
        const preset = POSES.find((p) => p.id === pid);
        const pose: CharacterPose = { bodyView: view, headView: view, rig: { ...poseRig(pid), ...(EXTRA[pid] ?? {}) } as Rig, face, handL: preset?.handL ?? 'open', handR: preset?.handR ?? 'open' };
        const r = renderCharacter(def, pose, def.id);
        out[`${def.id}|${view}|${pid}`] = createHash('sha256').update(r.svg).update(JSON.stringify([r.handL, r.handR, r.head])).digest('hex').slice(0, 16);
      }
    }
  }
  return out;
}

describe('desenho dos personagens padrão não muda (golden)', () => {
  it('hash do SVG e das posições das mãos/cabeça por personagem × vista × pose', () => {
    const now = compute();
    if (process.env.RECORTE_UPDATE_GOLDEN === '1' || !existsSync(FILE)) {
      writeFileSync(FILE, JSON.stringify(now, null, 0) + '\n');
    }
    const golden = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, string>;
    expect(Object.keys(now).length).toBe(BUILTIN_CHARACTERS.length * VIEW_ORDER.length * (POSE_IDS.length + Object.keys(EXTRA).length));
    const changed = Object.keys(golden).filter((k) => golden[k] !== now[k]);
    expect(changed).toEqual([]);
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden).sort());
  });
});
