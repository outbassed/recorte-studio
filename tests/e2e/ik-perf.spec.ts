/**
 * Desempenho REAL no Chrome (build de produção): quadros por segundo e tempo de quadro durante a reprodução da cena de
 * demonstração com IK ligado nos dois braços × desligado, no computador e com "celular" (tela pequena + CPU 4× mais lenta).
 * Limites largos para não ser instável; os números reais saem em docs/recortestudio/desempenho-ik-navegador.json
 * quando IK_PERF_WRITE=1.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEMO = resolve('docs/recortestudio/demo/ik-apontar-e-alcancar.json');
const results: Record<string, unknown> = {};

async function importDemo(page: Page, ik: boolean) {
  const project = JSON.parse(readFileSync(DEMO, 'utf8'));
  if (!ik) {
    for (const sc of Object.values(project.scenes) as Array<{ nodes: Record<string, { ik?: Record<string, { enabled: boolean }> }> }>) for (const n of Object.values(sc.nodes)) if (n.ik) for (const a of Object.values(n.ik)) a.enabled = false;
  }
  const file = resolve('test-results/e2e', `ik-perf-${ik ? 'on' : 'off'}.json`);
  mkdirSync(resolve('test-results/e2e'), { recursive: true });
  writeFileSync(file, JSON.stringify(project));
  await page.goto('/');
  await page.getByTestId('project-input').setInputFiles(file);
  const report = page.getByTestId('import-report');
  if (await report.isVisible().catch(() => false)) await report.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
}

/** Mede intervalos entre quadros (rAF) durante a reprodução. */
async function playAndMeasure(page: Page, ms: number) {
  await page.getByTestId('play').click();
  const frames = await page.evaluate((dur) => new Promise<number[]>((done) => {
    const t: number[] = [];
    let last = performance.now();
    const start = last;
    const step = (now: number) => {
      t.push(now - last);
      last = now;
      if (now - start < dur) requestAnimationFrame(step); else done(t);
    };
    requestAnimationFrame(step);
  }), ms);
  await page.getByTestId('play').click();
  const sorted = [...frames].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
  return { frames: frames.length, fps: Number((frames.length / (frames.reduce((a, b) => a + b, 0) / 1000)).toFixed(1)), p50: Number(q(0.5).toFixed(1)), p95: Number(q(0.95).toFixed(1)), worst: Number(sorted[sorted.length - 1]!.toFixed(1)) };
}

async function run(page: Page, label: string, throttle: number) {
  const cdp = await page.context().newCDPSession(page);
  for (const ik of [false, true]) {
    await importDemo(page, ik);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.waitForTimeout(300);
    results[`${label}-${ik ? 'ik-ligado' : 'ik-desligado'}`] = await playAndMeasure(page, 4000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
}

test.describe('computador 1366×768', () => {
  test('reprodução com IK: fps e tempo de quadro', async ({ page }) => {
    test.setTimeout(120_000);
    await run(page, 'computador', 1);
    const on = results['computador-ik-ligado'] as { p95: number };
    expect(on.p95).toBeLessThan(60);
  });
  test('computador com CPU 4× mais lenta (referência de celular fraco)', async ({ page }) => {
    test.setTimeout(120_000);
    await run(page, 'computador-cpu-4x', 4);
    expect((results['computador-cpu-4x-ik-ligado'] as { fps: number }).fps).toBeGreaterThan(15);
  });
});

test.describe('celular 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('celular, CPU 4× mais lenta', async ({ page }) => {
    test.setTimeout(120_000);
    await run(page, 'celular-cpu-4x', 4);
    expect((results['celular-cpu-4x-ik-ligado'] as { fps: number }).fps).toBeGreaterThan(15);
  });
});

test.afterAll(() => {
  if (process.env.IK_PERF_WRITE === '1') writeFileSync(resolve('docs/recortestudio/desempenho-ik-navegador.json'), JSON.stringify(results, null, 1) + '\n');
});
