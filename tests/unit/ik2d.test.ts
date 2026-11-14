/** Núcleo de cinemática inversa 2D de dois ossos: matemática pura, testada numericamente. */
import { describe, expect, it } from 'vitest';
import { forwardTwoBone, nearestAngle, solveTwoBone, wrapAngle, type TwoBoneParams } from '@/engine/rig/ik2d';

/** Gerador pseudoaleatório com semente: os testes são repetíveis. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rad = (d: number) => (d * Math.PI) / 180;
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const CHAINS: Array<[number, number]> = [[76, 87], [76, 70], [100, 40], [40, 100], [60, 60], [1, 1], [300, 200]];

describe('IK 2D de dois ossos: alcançável', () => {
  it('a ponta cai exatamente no alvo, para muitos alvos, correntes e as duas soluções', () => {
    const r = rng(7);
    let n = 0;
    for (const [l1, l2] of CHAINS) {
      for (const bend of [1, -1] as const) {
        for (let i = 0; i < 400; i++) {
          const ang = r() * Math.PI * 2;
          const lo = Math.abs(l1 - l2) + 1e-3;
          const hi = l1 + l2 - 1e-3;
          const d = lo + r() * (hi - lo);
          const t = { x: Math.cos(ang) * d, y: Math.sin(ang) * d };
          const s = solveTwoBone(t.x, t.y, { l1, l2, bend });
          expect(s.reached).toBe(true);
          expect(s.limited).toBe('none');
          expect(dist(s.end, t)).toBeLessThan(1e-7 * Math.max(1, l1 + l2));
          // o comprimento dos ossos é preservado
          expect(near(Math.hypot(s.elbow.x, s.elbow.y), l1, 1e-7 * l1)).toBe(true);
          expect(near(dist(s.elbow, s.end), l2, 1e-7 * l2)).toBe(true);
          // a flexão tem o sinal pedido
          expect(Math.sign(s.flexion) * bend).toBeGreaterThanOrEqual(0);
          n++;
        }
      }
    }
    expect(n).toBe(CHAINS.length * 800);
  });

  it('as duas soluções são imagens espelhadas em relação à reta ombro → alvo', () => {
    const t = { x: 80, y: 90 };
    const a = solveTwoBone(t.x, t.y, { l1: 76, l2: 87, bend: 1 });
    const b = solveTwoBone(t.x, t.y, { l1: 76, l2: 87, bend: -1 });
    expect(dist(a.end, b.end)).toBeLessThan(1e-9);
    expect(near(a.flexion, -b.flexion, 1e-9)).toBe(true);
    // cotovelos em lados opostos da reta
    const cross = (e: { x: number; y: number }) => t.x * e.y - t.y * e.x;
    expect(cross(a.elbow) * cross(b.elbow)).toBeLessThan(0);
  });

  it('simetria: espelhar o alvo em x e inverter o bend espelha os ângulos', () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const d = 20 + r() * 120;
      const ang = r() * Math.PI * 2;
      const t = { x: Math.cos(ang) * d, y: Math.sin(ang) * d };
      const a = solveTwoBone(t.x, t.y, { l1: 76, l2: 87, bend: 1 });
      const m = solveTwoBone(-t.x, t.y, { l1: 76, l2: 87, bend: -1 });
      expect(near(wrapAngle(Math.PI - a.phi1 - m.phi1), 0, 1e-9)).toBe(true); // φ → π − φ
      expect(near(a.flexion, -m.flexion, 1e-9)).toBe(true);
      expect(near(a.end.x, -m.end.x, 1e-7) && near(a.end.y, m.end.y, 1e-7)).toBe(true);
    }
  });

  it('reversibilidade: ângulos → posição → IK devolve os mesmos ângulos', () => {
    const r = rng(21);
    for (const bend of [1, -1] as const) {
      for (let i = 0; i < 500; i++) {
        const l1 = 70 + r() * 20;
        const l2 = 70 + r() * 30;
        const phi1 = (r() * 2 - 1) * Math.PI;
        const flex = bend * (0.05 + r() * (Math.PI - 0.1));
        const fk = forwardTwoBone(phi1, flex, l1, l2);
        const s = solveTwoBone(fk.end.x, fk.end.y, { l1, l2, bend });
        expect(near(wrapAngle(s.phi1 - phi1), 0, 1e-6)).toBe(true);
        expect(near(s.flexion, wrapAngle(flex), 1e-6)).toBe(true);
      }
    }
  });
});

describe('IK 2D de dois ossos: alvos impossíveis', () => {
  const p: TwoBoneParams = { l1: 76, l2: 87, bend: 1 };

  it('fora do alcance: braço esticado apontando para o alvo, sem NaN, com o erro devolvido', () => {
    for (const ang of [0, 0.7, 1.9, -2.4, Math.PI]) {
      const d = 500;
      const t = { x: Math.cos(ang) * d, y: Math.sin(ang) * d };
      const s = solveTwoBone(t.x, t.y, p);
      expect(s.limited).toBe('out-of-reach');
      expect(s.reached).toBe(false);
      expect(near(s.flexion, 0, 1e-9)).toBe(true);
      expect(near(wrapAngle(s.phi1 - ang), 0, 1e-9)).toBe(true);
      expect(near(s.error, d - (p.l1 + p.l2), 1e-6)).toBe(true);
      expect(Number.isFinite(s.end.x) && Number.isFinite(s.end.y)).toBe(true);
    }
  });

  it('perto demais: dobra ao máximo, na direção do alvo, e informa', () => {
    const s = solveTwoBone(2, 0, { l1: 100, l2: 40, bend: 1 });
    expect(s.limited).toBe('too-close');
    expect(s.reached).toBe(false);
    expect(near(Math.abs(s.flexion), Math.PI, 1e-6)).toBe(true);
    expect(near(s.error, 60 - 2, 1e-6)).toBe(true);
  });

  it('alvo exatamente no ombro: resultado finito e determinístico (osso igual: dobrado)', () => {
    const a = solveTwoBone(0, 0, { l1: 60, l2: 60, bend: 1 });
    const b = solveTwoBone(0, 0, { l1: 60, l2: 60, bend: 1 });
    expect(a).toEqual(b);
    expect(Number.isFinite(a.phi1) && Number.isFinite(a.phi2)).toBe(true);
    expect(a.reached).toBe(true); // com ossos iguais a ponta volta ao ombro
    const c = solveTwoBone(0, 0, p);
    expect(Number.isFinite(c.phi1)).toBe(true);
    expect(c.limited).toBe('too-close');
  });

  it('entradas inválidas (NaN, Infinity, comprimentos nulos ou negativos) nunca geram NaN', () => {
    const bad = [NaN, Infinity, -Infinity, 0, -50, 1e300, -1e300];
    for (const tx of bad) {
      for (const ty of bad) {
        for (const l of [0, -3, NaN, 70]) {
          const s = solveTwoBone(tx, ty, { l1: l, l2: 70, bend: 1 });
          for (const v of [s.phi1, s.phi2, s.flexion, s.elbow.x, s.elbow.y, s.end.x, s.end.y, s.error, s.distance]) {
            expect(Number.isNaN(v), `tx=${tx} ty=${ty} l1=${l}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('IK 2D de dois ossos: limites de junta', () => {
  it('limite de flexão do cotovelo é respeitado e o erro resultante é informado', () => {
    // O alvo exige dobrar o cotovelo ~100°, mas o limite é 40°.
    const base: TwoBoneParams = { l1: 76, l2: 87, bend: 1 };
    const t = { x: 70, y: 60 };
    const free = solveTwoBone(t.x, t.y, base);
    expect(Math.abs(free.flexion)).toBeGreaterThan(rad(40));
    const lim = solveTwoBone(t.x, t.y, { ...base, flexMax: rad(40) });
    expect(Math.abs(lim.flexion)).toBeLessThanOrEqual(rad(40) + 1e-9);
    expect(lim.limited).toBe('elbow-limit');
    expect(lim.reached).toBe(false);
    expect(lim.error).toBeGreaterThan(1);
    // com o cotovelo travado, o osso 1 aponta a ponta na direção do alvo
    const toEnd = Math.atan2(lim.end.y, lim.end.x);
    expect(near(wrapAngle(toEnd - Math.atan2(t.y, t.x)), 0, 1e-9)).toBe(true);
  });

  it('flexão mínima: o cotovelo não estica além do permitido', () => {
    const s = solveTwoBone(500, 0, { l1: 76, l2: 87, bend: -1, flexMin: rad(10) });
    expect(Math.abs(s.flexion)).toBeGreaterThanOrEqual(rad(10) - 1e-9);
    expect(Math.sign(s.flexion)).toBe(-1);
  });

  it('limite do ombro: o osso 1 nunca sai do arco permitido, mesmo com o ângulo equivalente em outra volta', () => {
    const r = rng(5);
    for (let i = 0; i < 400; i++) {
      const ang = r() * Math.PI * 2;
      const d = 20 + r() * 180;
      const s = solveTwoBone(Math.cos(ang) * d, Math.sin(ang) * d, { l1: 76, l2: 87, bend: 1, rootMin: rad(10), rootMax: rad(170) });
      expect(s.phi1).toBeGreaterThanOrEqual(rad(10) - 1e-9);
      expect(s.phi1).toBeLessThanOrEqual(rad(170) + 1e-9);
      if (!s.reached) expect(['root-limit', 'out-of-reach', 'too-close', 'elbow-limit']).toContain(s.limited);
    }
    const hit = solveTwoBone(0, -120, { l1: 76, l2: 87, bend: 1, rootMin: rad(10), rootMax: rad(170) }); // alvo para cima: fora do arco
    expect(hit.limited).toBe('root-limit');
    expect(hit.reached).toBe(false);
  });
});

describe('IK 2D de dois ossos: determinismo, continuidade e estabilidade', () => {
  it('determinismo: depende só da entrada, não da ordem das chamadas (sem histórico)', () => {
    const r = rng(3);
    const cases = Array.from({ length: 200 }, () => ({ x: (r() - 0.5) * 400, y: (r() - 0.5) * 400, bend: (r() < 0.5 ? 1 : -1) as 1 | -1 }));
    const run = (c: (typeof cases)[number]) => solveTwoBone(c.x, c.y, { l1: 76, l2: 87, bend: c.bend });
    const forward = cases.map(run);
    const backward = [...cases].reverse().map(run).reverse();
    const again = cases.map(run);
    expect(backward).toEqual(forward);
    expect(again).toEqual(forward);
  });

  it('continuidade: um alvo que se move aos poucos move os ângulos aos poucos (inclusive cruzando o limite de alcance)', () => {
    const p: TwoBoneParams = { l1: 76, l2: 87, bend: 1 };
    const sweep = (f: (u: number) => { x: number; y: number }, steps: number, maxJump: number) => {
      let prev = solveTwoBone(f(0).x, f(0).y, p);
      for (let i = 1; i <= steps; i++) {
        const t = f(i / steps);
        const s = solveTwoBone(t.x, t.y, p);
        expect(Math.abs(wrapAngle(s.phi1 - prev.phi1))).toBeLessThan(maxJump);
        expect(Math.abs(wrapAngle(s.flexion - prev.flexion))).toBeLessThan(maxJump);
        prev = s;
      }
    };
    // círculo de raio 120 (alcançável) ao redor do ombro
    sweep((u) => ({ x: Math.cos(u * Math.PI * 2) * 120, y: Math.sin(u * Math.PI * 2) * 120 }), 3600, rad(1));
    // raio de 40 a 400, atravessando o alcance máximo (163): clampa sem saltar. Perto do esticamento total o ângulo
    // do cotovelo varia como √(distância) (propriedade da lei dos cossenos): contínuo, mas não Lipschitz.
    const step = 360 / 4000;
    sweep((u) => ({ x: 40 + u * 360, y: 30 }), 4000, 1.5 * Math.sqrt((2 * step * 163) / (76 * 87)));
    // cruza o ponto diretamente acima do ombro, onde o ângulo "dá a volta" (±π)
    sweep((u) => ({ x: (u - 0.5) * 80, y: -100 }), 2000, rad(1.5));
  });

  it('estabilidade perto do esticamento total: o erro no ângulo cresce no máximo como √(erro do alvo)', () => {
    const p: TwoBoneParams = { l1: 76, l2: 87, bend: 1 };
    const full = p.l1 + p.l2;
    for (const eps of [1e-1, 1e-2, 1e-3, 1e-4, 1e-6, 1e-9]) {
      const s = solveTwoBone(full - eps, 0, p);
      expect(Number.isFinite(s.flexion)).toBe(true);
      expect(Math.abs(s.flexion)).toBeLessThan(Math.sqrt((2 * eps * full) / (p.l1 * p.l2)) * 1.5 + 1e-6);
      expect(s.reached).toBe(true);
    }
  });

  it('estabilidade perto do ombro (alvo muito próximo da raiz) com ossos desiguais', () => {
    for (const d of [1e-12, 1e-9, 1e-6, 1e-3]) {
      const s = solveTwoBone(d, d, { l1: 76, l2: 87, bend: 1 });
      expect(Number.isFinite(s.phi1) && Number.isFinite(s.flexion)).toBe(true);
    }
  });
});

describe('IK 2D de dois ossos: zona suave (soft) perto do esticamento total', () => {
  const base: TwoBoneParams = { l1: 76, l2: 87, bend: 1 };
  const full = base.l1 + base.l2;

  it('soft = 0 (padrão) é idêntico ao IK exato', () => {
    for (const d of [20, 80, 140, 162.9, 163, 200]) {
      expect(solveTwoBone(d, 10, { ...base, soft: 0 })).toEqual(solveTwoBone(d, 10, base));
    }
  });

  it('abaixo da zona suave nada muda; dentro dela a mão freia, nunca passa do alvo nem do alcance, e a direção é exata', () => {
    const soft = 20;
    const d0 = full - soft;
    for (const d of [20, 60, 100, d0 - 0.001]) {
      const a = solveTwoBone(d, 0, { ...base, soft });
      const b = solveTwoBone(d, 0, base);
      expect(a.phi1).toBeCloseTo(b.phi1, 9);
      expect(a.flexion).toBeCloseTo(b.flexion, 9);
      expect(a.reached).toBe(true);
    }
    let prevFlex = Infinity;
    for (let d = d0; d <= full + 60; d += 0.5) {
      const s = solveTwoBone(d, 0, { ...base, soft });
      const reach = Math.hypot(s.end.x, s.end.y);
      expect(reach).toBeLessThanOrEqual(Math.min(d, full) + 1e-9); // a ponta nunca ultrapassa o alvo nem o braço
      if (d <= full) expect(d - reach).toBeLessThanOrEqual(soft + 1e-9); // dentro do alcance, a falta é limitada pela zona suave
      expect(Math.abs(Math.atan2(s.end.y, s.end.x))).toBeLessThan(1e-9); // direção exata (alvo no eixo x)
      expect(Math.abs(s.flexion)).toBeLessThanOrEqual(prevFlex + 1e-12); // estica de forma monótona
      prevFlex = Math.abs(s.flexion);
      if (d <= full && d - reach > 1e-3) expect(s.limited).toBe('soft-reach');
    }
  });

  it('bem fora do alcance o braço fica (praticamente) reto, sem NaN', () => {
    const s = solveTwoBone(full + 400, 0, { ...base, soft: 20 });
    expect(Math.abs(s.flexion)).toBeLessThan(1e-3);
    expect(s.limited).toBe('out-of-reach');
  });

  it('a resposta é muito mais suave: o salto máximo do ângulo por passo do alvo cai bastante', () => {
    const worst = (soft: number) => {
      let prev = solveTwoBone(100, 30, { ...base, soft });
      let w = 0;
      for (let i = 1; i <= 4000; i++) {
        const s = solveTwoBone(100 + i * 0.1, 30, { ...base, soft });
        w = Math.max(w, Math.abs(s.flexion - prev.flexion));
        prev = s;
      }
      return w;
    };
    const exact = worst(0);
    const soft = worst(25);
    expect(exact).toBeGreaterThan(0.03); // o estalo é real no IK exato (~3° em um passo de 0,1 px)
    expect(soft).toBeLessThan(exact * 0.25);
  });

  it('soft inválido (NaN, negativo, enorme) é tratado sem NaN', () => {
    for (const soft of [NaN, -5, 1e9, Infinity]) {
      const s = solveTwoBone(150, 20, { ...base, soft });
      expect(Number.isFinite(s.phi1) && Number.isFinite(s.flexion) && Number.isFinite(s.error)).toBe(true);
    }
  });
});

describe('IK 2D: utilidades de ângulo', () => {
  it('wrapAngle fica em (−π, π] e nearestAngle escolhe a volta mais próxima', () => {
    for (const a of [0, 1, -1, 3.5, -3.5, 10, -10, 100 * Math.PI, -100.3 * Math.PI]) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThan(-Math.PI - 1e-12);
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-12);
      expect(near(Math.cos(w), Math.cos(a), 1e-9)).toBe(true);
    }
    expect(wrapAngle(NaN)).toBe(0);
    expect(near(nearestAngle(rad(350), rad(-5)), rad(-10), 1e-9)).toBe(true);
    expect(near(nearestAngle(rad(-170), rad(190)), rad(190), 1e-9)).toBe(true);
  });
});
